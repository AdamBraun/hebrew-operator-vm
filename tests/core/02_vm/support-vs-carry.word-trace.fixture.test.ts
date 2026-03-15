import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotHandle = {
  id: string;
  kind?: string;
  policy?: string;
  edge_mode?: string;
  meta?: Record<string, unknown>;
};

type TokenSnapshot = {
  vm?: { F?: string };
  handles?: SnapshotHandle[];
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  links?: Array<{ from: string; to: string; label: string }>;
};

type WordTraceArtifact = {
  word: string;
  targetTokenRaw: string;
  focus: {
    before: string;
    after: string;
  };
  emitted: {
    cont: string[];
    carry: string[];
    supp: string[];
    head_of: string[];
    sub: string[];
    links: Array<{ from: string; to: string; label: string }>;
    createdHandles: Array<{
      id: string;
      kind: string;
      policy: string;
      edge_mode: string;
      meta: Record<string, unknown>;
    }>;
  };
  carryLedger: {
    before: string[];
    after: string[];
    newEntries: string[];
    unresolvedAfter: string[];
  };
};

type WordTraceFixture = {
  scenario: "token_exit_word_trace";
  cases: WordTraceArtifact[];
};

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "support-vs-carry.word-traces.json"
);

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function normalizeValue(value: unknown, ids: Record<string, string>): unknown {
  if (typeof value === "string") {
    return ids[value] ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry, ids));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, normalizeValue(entry, ids)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeEdges(edges: string[] | undefined, ids: Record<string, string>): string[] {
  return (edges ?? [])
    .map((edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    })
    .sort();
}

function diffEdges(
  after: string[] | undefined,
  before: string[] | undefined,
  ids: Record<string, string>
): string[] {
  const previous = new Set(before ?? []);
  return (after ?? [])
    .filter((edge) => !previous.has(edge))
    .map((edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    })
    .sort();
}

function diffLinks(
  after: Array<{ from: string; to: string; label: string }> | undefined,
  before: Array<{ from: string; to: string; label: string }> | undefined,
  ids: Record<string, string>
): Array<{ from: string; to: string; label: string }> {
  const previous = new Set((before ?? []).map((link) => `${link.from}:${link.to}:${link.label}`));
  return (after ?? [])
    .filter((link) => !previous.has(`${link.from}:${link.to}:${link.label}`))
    .map((link) => ({
      from: ids[link.from] ?? link.from,
      to: ids[link.to] ?? link.to,
      label: link.label
    }))
    .sort((left, right) =>
      `${left.from}:${left.to}:${left.label}`.localeCompare(
        `${right.from}:${right.to}:${right.label}`
      )
    );
}

function normalizeCreatedHandles(
  after: SnapshotHandle[] | undefined,
  before: SnapshotHandle[] | undefined,
  ids: Record<string, string>
): Array<{
  id: string;
  kind: string;
  policy: string;
  edge_mode: string;
  meta: Record<string, unknown>;
}> {
  const previous = new Set((before ?? []).map((handle) => handle.id));
  return (after ?? [])
    .filter((handle) => !previous.has(handle.id))
    .map((handle) => ({
      id: ids[handle.id] ?? handle.id,
      kind: String(handle.kind ?? ""),
      policy: String(handle.policy ?? ""),
      edge_mode: String(handle.edge_mode ?? ""),
      meta: normalizeValue(handle.meta ?? {}, ids) as Record<string, unknown>
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function hasSupp(snapshot: TokenSnapshot, closer: string, origin: string): boolean {
  return (snapshot.supp ?? []).includes(`${closer}->${origin}`);
}

function buildContSuccessors(snapshot: TokenSnapshot): Map<string, string[]> {
  const bySource = new Map<string, Set<string>>();
  for (const edge of snapshot.cont ?? []) {
    const [from, to] = parseEdge(edge);
    const successors = bySource.get(from) ?? new Set<string>();
    successors.add(to);
    bySource.set(from, successors);
  }
  return new Map(
    [...bySource.entries()].map(([source, targets]) => [
      source,
      [...targets].sort((left, right) => left.localeCompare(right))
    ])
  );
}

function isCarryResolvedInSnapshot(
  snapshot: TokenSnapshot,
  source: string,
  target: string,
  focusNodeId: string
): boolean {
  const successors = buildContSuccessors(snapshot);
  const visited = new Set<string>([target]);
  const queue: string[] = [target];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    if (hasSupp(snapshot, current, source)) {
      return true;
    }
    if (current === focusNodeId) {
      continue;
    }
    for (const next of successors.get(current) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      queue.push(next);
    }
  }

  return false;
}

function unresolvedCarryEdges(snapshot: TokenSnapshot, ids: Record<string, string>): string[] {
  const focusNodeId = String(snapshot.vm?.F ?? "");
  return (snapshot.carry ?? [])
    .filter((edge) => {
      const [source, target] = parseEdge(edge);
      return !isCarryResolvedInSnapshot(snapshot, source, target, focusNodeId);
    })
    .map((edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    })
    .sort();
}

function snapshotForPhase(word: string, phaseName: string): TokenSnapshot {
  const { deepTrace } = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });
  const entry = deepTrace.find((row) => row.token_raw === word);
  const snapshot = entry?.phases.find((phase) => phase.phase === phaseName)?.snapshot;
  if (!snapshot) {
    throw new Error(`Missing ${phaseName} snapshot for '${word}'`);
  }
  return snapshot as TokenSnapshot;
}

function baselineId(snapshot: TokenSnapshot): string {
  const id = snapshot.handles?.find((handle) => handle.meta?.construct_role === "baseline")?.id;
  if (!id) {
    throw new Error("Missing baseline handle");
  }
  return id;
}

function handleById(snapshot: TokenSnapshot, id: string): SnapshotHandle {
  const handle = snapshot.handles?.find((entry) => entry.id === id);
  if (!handle) {
    throw new Error(`Missing handle '${id}'`);
  }
  return handle;
}

function idsForSnapshot(snapshot: TokenSnapshot): Record<string, string> {
  const baseline = baselineId(snapshot);
  const focusId = String(snapshot.vm?.F ?? "");
  const focusHandle = handleById(snapshot, focusId);
  const ids: Record<string, string> = {
    [baseline]: "BASE",
    Ω: "OMEGA",
    [focusId]: "FOCUS"
  };

  const detachedLeg = focusHandle.meta?.detached_leg;
  if (typeof detachedLeg === "string") {
    ids[detachedLeg] = "LEG";
  }

  const aliasHandles = (snapshot.handles ?? []).filter(
    (handle) => handle.kind === "alias" && handle.id !== focusId
  );
  if (aliasHandles.length > 1) {
    throw new Error("Expected at most one alias handle in support-vs-carry fixture");
  }
  if (aliasHandles[0]) {
    ids[aliasHandles[0].id] = "ALIAS";
  }

  return ids;
}

function buildArtifact(word: string): WordTraceArtifact {
  const previous = snapshotForPhase(word, "word_entry_context");
  const current = snapshotForPhase(word, "token_exit");
  const ids = idsForSnapshot(current);

  return {
    word,
    targetTokenRaw: word,
    focus: {
      before: ids[String(previous.vm?.F ?? "")] ?? String(previous.vm?.F ?? ""),
      after: ids[String(current.vm?.F ?? "")] ?? String(current.vm?.F ?? "")
    },
    emitted: {
      cont: diffEdges(current.cont, previous.cont, ids),
      carry: diffEdges(current.carry, previous.carry, ids),
      supp: diffEdges(current.supp, previous.supp, ids),
      head_of: diffEdges(current.head_of, previous.head_of, ids),
      sub: diffEdges(current.sub, previous.sub, ids),
      links: diffLinks(current.links, previous.links, ids),
      createdHandles: normalizeCreatedHandles(current.handles, previous.handles, ids)
    },
    carryLedger: {
      before: normalizeEdges(previous.carry, ids),
      after: normalizeEdges(current.carry, ids),
      newEntries: diffEdges(current.carry, previous.carry, ids),
      unresolvedAfter: unresolvedCarryEdges(current, ids)
    }
  };
}

function currentArtifacts(): WordTraceFixture {
  return {
    scenario: "token_exit_word_trace",
    cases: ["ד", "ה", "ן", "כ", "נ", "ע", "ר"].map(buildArtifact)
  };
}

describe("support vs carry word traces", () => {
  it("matches the committed token-exit fixtures and keeps direct support distinct from live carry", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as WordTraceFixture;
    const current = currentArtifacts();

    expect(current).toEqual(fixture);

    const byWord = Object.fromEntries(current.cases.map((entry) => [entry.word, entry]));

    expect(byWord["ד"]).toMatchObject({
      focus: { before: "BASE", after: "FOCUS" },
      emitted: {
        cont: ["OMEGA->FOCUS"],
        carry: [],
        supp: ["FOCUS->OMEGA"],
        head_of: ["FOCUS->OMEGA"],
        sub: []
      },
      carryLedger: {
        before: [],
        after: [],
        newEntries: [],
        unresolvedAfter: []
      }
    });
    expect(byWord["ה"]).toMatchObject({
      focus: { before: "BASE", after: "FOCUS" },
      emitted: {
        cont: ["FOCUS->LEG", "OMEGA->FOCUS"],
        carry: [],
        supp: ["FOCUS->OMEGA", "LEG->FOCUS"],
        head_of: ["FOCUS->OMEGA"],
        sub: ["FOCUS->LEG"]
      },
      carryLedger: {
        before: [],
        after: [],
        newEntries: [],
        unresolvedAfter: []
      }
    });
    expect(byWord["ן"]).toMatchObject({
      emitted: {
        cont: ["BASE->FOCUS"],
        carry: [],
        supp: ["FOCUS->BASE"],
        head_of: [],
        sub: []
      },
      carryLedger: {
        before: [],
        after: [],
        newEntries: [],
        unresolvedAfter: []
      }
    });
    expect(byWord["כ"]).toMatchObject({
      emitted: {
        cont: ["BASE->FOCUS"],
        carry: [],
        supp: ["FOCUS->BASE"],
        head_of: [],
        sub: []
      },
      carryLedger: {
        before: [],
        after: [],
        newEntries: [],
        unresolvedAfter: []
      }
    });
    expect(byWord["נ"]).toMatchObject({
      emitted: {
        cont: ["BASE->FOCUS"],
        carry: ["BASE->FOCUS"],
        supp: [],
        head_of: [],
        sub: []
      },
      carryLedger: {
        before: [],
        after: ["BASE->FOCUS"],
        newEntries: ["BASE->FOCUS"],
        unresolvedAfter: ["BASE->FOCUS"]
      }
    });
    expect(byWord["ע"]).toMatchObject({
      emitted: {
        cont: ["BASE->FOCUS"],
        carry: ["BASE->FOCUS"],
        supp: [],
        head_of: [],
        sub: []
      },
      carryLedger: {
        before: [],
        after: ["BASE->FOCUS"],
        newEntries: ["BASE->FOCUS"],
        unresolvedAfter: ["BASE->FOCUS"]
      }
    });
    expect(byWord["ר"]).toMatchObject({
      emitted: {
        cont: ["OMEGA->FOCUS"],
        carry: ["OMEGA->FOCUS"],
        supp: [],
        head_of: ["FOCUS->OMEGA"],
        sub: []
      },
      carryLedger: {
        before: [],
        after: ["OMEGA->FOCUS"],
        newEntries: ["OMEGA->FOCUS"],
        unresolvedAfter: ["OMEGA->FOCUS"]
      }
    });

    for (const word of ["ד", "ה", "ן", "כ"] as const) {
      expect(byWord[word]?.emitted.carry, word).toEqual([]);
      expect(byWord[word]?.carryLedger.unresolvedAfter, word).toEqual([]);
    }

    for (const word of ["נ", "ע", "ר"] as const) {
      expect(byWord[word]?.emitted.carry, word).toEqual(byWord[word]?.carryLedger.newEntries);
      expect(byWord[word]?.carryLedger.after, word).toEqual(
        byWord[word]?.carryLedger.unresolvedAfter
      );
      expect(byWord[word]?.emitted.supp, word).toEqual([]);
    }

    expect(byWord["ע"]?.emitted.createdHandles.map((handle) => handle.id)).toEqual([
      "ALIAS",
      "FOCUS"
    ]);
    expect(byWord["ה"]?.emitted.createdHandles.map((handle) => handle.id)).toEqual([
      "FOCUS",
      "LEG"
    ]);
  });
});
