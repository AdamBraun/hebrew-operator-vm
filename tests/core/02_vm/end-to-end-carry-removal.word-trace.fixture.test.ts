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

type SnapshotBoundary = {
  id: string;
  inside: string;
  outside: string;
  kind?: string;
  open?: boolean;
  closed?: boolean;
};

type TokenExitSnapshot = {
  vm?: { F?: string };
  handles?: SnapshotHandle[];
  cont?: string[];
  carry?: string[];
  supp?: string[];
  links?: Array<{ from: string; to: string; label: string }>;
  boundaries?: SnapshotBoundary[];
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
    links: Array<{ from: string; to: string; label: string }>;
    createdHandles: Array<{
      id: string;
      kind: string;
      policy: string;
      edge_mode: string;
      meta: Record<string, unknown>;
    }>;
    boundariesAdded: Array<{
      id: string;
      inside: string;
      outside: string;
      kind?: string;
      open?: boolean;
      closed?: boolean;
    }>;
  };
  boundariesAfter: Array<{
    id: string;
    inside: string;
    outside: string;
    kind?: string;
    open?: boolean;
    closed?: boolean;
  }>;
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

type TokenEntry = {
  token_raw: string;
  snapshot: TokenExitSnapshot;
};

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "end-to-end-carry-removal.word-traces.json"
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

function normalizeLinks(
  links: Array<{ from: string; to: string; label: string }> | undefined,
  ids: Record<string, string>
): Array<{ from: string; to: string; label: string }> {
  return (links ?? [])
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

function normalizeBoundaries(
  boundaries: SnapshotBoundary[] | undefined,
  ids: Record<string, string>
): Array<{
  id: string;
  inside: string;
  outside: string;
  kind?: string;
  open?: boolean;
  closed?: boolean;
}> {
  return (boundaries ?? [])
    .map((boundary) => ({
      id: ids[boundary.id] ?? boundary.id,
      inside: ids[boundary.inside] ?? boundary.inside,
      outside: ids[boundary.outside] ?? boundary.outside,
      kind: boundary.kind,
      open: boundary.open,
      closed: boundary.closed
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function diffBoundaries(
  after: SnapshotBoundary[] | undefined,
  before: SnapshotBoundary[] | undefined,
  ids: Record<string, string>
): Array<{
  id: string;
  inside: string;
  outside: string;
  kind?: string;
  open?: boolean;
  closed?: boolean;
}> {
  const previous = new Set((before ?? []).map((boundary) => boundary.id));
  return normalizeBoundaries(
    (after ?? []).filter((boundary) => !previous.has(boundary.id)),
    ids
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

function hasSupp(snapshot: TokenExitSnapshot, closer: string, origin: string): boolean {
  return (snapshot.supp ?? []).includes(`${closer}->${origin}`);
}

function buildContSuccessors(snapshot: TokenExitSnapshot): Map<string, string[]> {
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
  snapshot: TokenExitSnapshot,
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

function unresolvedCarryEdges(snapshot: TokenExitSnapshot, ids: Record<string, string>): string[] {
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

function tokenEntries(word: string): TokenEntry[] {
  const { deepTrace } = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });
  return deepTrace
    .filter((entry) => entry.token_raw !== "□")
    .map((entry) => {
      const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
      if (!snapshot) {
        throw new Error(`Missing token_exit snapshot for '${entry.token_raw}' in '${word}'`);
      }
      return {
        token_raw: entry.token_raw,
        snapshot: snapshot as TokenExitSnapshot
      };
    });
}

function baselineId(snapshot: TokenExitSnapshot): string {
  const id = snapshot.handles?.find((handle) => handle.meta?.construct_role === "baseline")?.id;
  if (!id) {
    throw new Error("Missing baseline handle");
  }
  return id;
}

function handleById(snapshot: TokenExitSnapshot, id: string): SnapshotHandle {
  const handle = snapshot.handles?.find((entry) => entry.id === id);
  if (!handle) {
    throw new Error(`Missing handle '${id}'`);
  }
  return handle;
}

function buildNahHetArtifact(): WordTraceArtifact {
  const [nun, het] = tokenEntries("נח");
  const previous = nun.snapshot;
  const current = het.snapshot;

  const baseline = baselineId(current);
  const interfaceId = String(current.vm?.F ?? "");
  const iface = handleById(current, interfaceId);
  const inside = String(iface.meta?.inside ?? "");
  const outside = String(iface.meta?.outside ?? "");
  const pIn = String(iface.meta?.p_in ?? "");
  const pOut = String(iface.meta?.p_out ?? "");

  const ids: Record<string, string> = {
    [baseline]: "BASE",
    [inside]: "N",
    [outside]: "OMEGA",
    [pIn]: "P_IN",
    [pOut]: "P_OUT",
    [interfaceId]: "I"
  };

  return {
    word: "נח",
    targetTokenRaw: "ח",
    focus: {
      before: ids[String(previous.vm?.F ?? "")] ?? String(previous.vm?.F ?? ""),
      after: ids[String(current.vm?.F ?? "")] ?? String(current.vm?.F ?? "")
    },
    emitted: {
      cont: diffEdges(current.cont, previous.cont, ids),
      carry: diffEdges(current.carry, previous.carry, ids),
      supp: diffEdges(current.supp, previous.supp, ids),
      links: diffLinks(current.links, previous.links, ids),
      createdHandles: normalizeCreatedHandles(current.handles, previous.handles, ids),
      boundariesAdded: diffBoundaries(current.boundaries, previous.boundaries, ids)
    },
    boundariesAfter: normalizeBoundaries(current.boundaries, ids),
    carryLedger: {
      before: normalizeEdges(previous.carry, ids),
      after: normalizeEdges(current.carry, ids),
      newEntries: diffEdges(current.carry, previous.carry, ids),
      unresolvedAfter: unresolvedCarryEdges(current, ids)
    }
  };
}

function buildMelekhFinalKafArtifact(): WordTraceArtifact {
  const [, lamed, finalKaf] = tokenEntries("מלך");
  const previous = lamed.snapshot;
  const current = finalKaf.snapshot;

  const baseline = baselineId(current);
  const boundary = current.boundaries?.[0];
  const finalId = String(current.vm?.F ?? "");
  const finalHandle = handleById(current, finalId);
  const memInside = String(boundary?.inside ?? "");
  const memHold = String(boundary?.outside ?? "");
  const boundaryId = String(boundary?.id ?? "");
  const lamedExterior = String(finalHandle.meta?.heldFrom ?? previous.vm?.F ?? "");

  if (!boundaryId || !memInside || !memHold || !lamedExterior) {
    throw new Error("Failed to derive מלך artifact identifiers");
  }

  const ids: Record<string, string> = {
    [baseline]: "BASE",
    [memHold]: "MEM_H",
    [memInside]: "MEM_I",
    [boundaryId]: "MEM_B",
    [lamedExterior]: "L_OUT",
    [finalId]: "FINAL"
  };

  return {
    word: "מלך",
    targetTokenRaw: "ך",
    focus: {
      before: ids[String(previous.vm?.F ?? "")] ?? String(previous.vm?.F ?? ""),
      after: ids[String(current.vm?.F ?? "")] ?? String(current.vm?.F ?? "")
    },
    emitted: {
      cont: diffEdges(current.cont, previous.cont, ids),
      carry: diffEdges(current.carry, previous.carry, ids),
      supp: diffEdges(current.supp, previous.supp, ids),
      links: diffLinks(current.links, previous.links, ids),
      createdHandles: normalizeCreatedHandles(current.handles, previous.handles, ids),
      boundariesAdded: diffBoundaries(current.boundaries, previous.boundaries, ids)
    },
    boundariesAfter: normalizeBoundaries(current.boundaries, ids),
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
    cases: [buildNahHetArtifact(), buildMelekhFinalKafArtifact()]
  };
}

describe("end-to-end carry-removal word traces", () => {
  it("matches the committed נח/מלך token-exit fixtures and keeps target letters off the live carry ledger", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as WordTraceFixture;
    const current = currentArtifacts();

    expect(current).toEqual(fixture);

    const nahHet = current.cases.find((entry) => entry.word === "נח");
    const melekh = current.cases.find((entry) => entry.word === "מלך");
    if (!nahHet || !melekh) {
      throw new Error("Missing expected word-trace cases");
    }

    expect(nahHet.focus).toEqual({ before: "N", after: "I" });
    expect(nahHet.emitted.cont).toEqual(["N->P_IN", "OMEGA->P_OUT"]);
    expect(nahHet.emitted.carry).toEqual([]);
    expect(nahHet.emitted.supp).toEqual(["P_IN->N", "P_OUT->OMEGA"]);
    expect(nahHet.carryLedger.newEntries).toEqual([]);
    expect(nahHet.carryLedger.unresolvedAfter).toEqual(["BASE->N"]);

    expect(melekh.focus).toEqual({ before: "L_OUT", after: "FINAL" });
    expect(melekh.emitted.cont).toEqual(["L_OUT->FINAL"]);
    expect(melekh.emitted.carry).toEqual([]);
    expect(melekh.emitted.supp).toEqual(["FINAL->L_OUT"]);
    expect(melekh.carryLedger.after).toEqual([]);
    expect(melekh.carryLedger.newEntries).toEqual([]);
    expect(melekh.carryLedger.unresolvedAfter).toEqual([]);
  });
});
