import { describe, expect, it } from "vitest";
import { eff, resolveCarry, type WitnessBundle } from "@ref/state/eff";
import { assertStateInvariants } from "@ref/state/invariants";
import { contReachable } from "@ref/state/relations";
import { createInitialState, type State } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

const AMBIENT_WITNESS = { ambient: 1 };
const FIRST_HOLD_WITNESS = { firstHold: 1 };
const EXTERIOR_WITNESS = { exterior: 1 };

type SnapshotHandle = {
  id: string;
  kind?: string;
  policy?: string;
  edge_mode?: string;
  meta?: Record<string, any>;
};

type SnapshotBoundary = {
  id: string;
  inside: string;
  outside: string;
  kind?: string;
  open?: boolean;
  closed?: boolean;
  close_mode?: string;
  closed_by?: string;
};

type SnapshotEvent = {
  type: string;
  tau: number;
  data: Record<string, any>;
};

type TokenExitSnapshot = {
  vm?: {
    F?: string;
    H?: SnapshotEvent[];
  };
  handles?: SnapshotHandle[];
  cont?: string[];
  carry?: string[];
  supp?: string[];
  links?: Array<{ from: string; to: string; label: string }>;
  boundaries?: SnapshotBoundary[];
};

type TokenTrace = {
  token: string;
  token_raw: string;
  snapshot: TokenExitSnapshot;
};

type WordRun = {
  state: State;
  tokens: TokenTrace[];
};

type EffContribution = {
  source: string;
  target: string;
  targetDistance: number;
  resolution: "resolved" | "unresolved";
  closer: string | null;
  witness: WitnessBundle;
};

function runWord(word: string): WordRun {
  const { state, deepTrace } = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });

  return {
    state,
    tokens: deepTrace
      .filter((entry) => entry.token_raw !== "□")
      .map((entry) => {
        const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
        if (!snapshot) {
          throw new Error(`Missing token_exit snapshot for '${entry.token_raw}' in '${word}'`);
        }
        return {
          token: entry.token,
          token_raw: entry.token_raw,
          snapshot: snapshot as TokenExitSnapshot
        };
      })
  };
}

function baselineId(snapshot: TokenExitSnapshot): string {
  const id = snapshot.handles?.find((handle) => handle.meta?.construct_role === "baseline")?.id;
  if (!id) {
    throw new Error("Missing baseline handle in snapshot");
  }
  return id;
}

function baselineIdFromState(state: State): string {
  for (const [id, handle] of state.handles.entries()) {
    if (handle.meta?.construct_role === "baseline") {
      return id;
    }
  }
  throw new Error("Missing baseline handle in state");
}

function handleById(snapshot: TokenExitSnapshot, id: string): SnapshotHandle {
  const handle = snapshot.handles?.find((entry) => entry.id === id);
  if (!handle) {
    throw new Error(`Missing handle '${id}' in snapshot`);
  }
  return handle;
}

function lastEvent(snapshot: TokenExitSnapshot, type: string): SnapshotEvent {
  const events = snapshot.vm?.H?.filter((event) => event.type === type) ?? [];
  const event = events[events.length - 1];
  if (!event) {
    throw new Error(`Missing event '${type}'`);
  }
  return event;
}

function boundaryById(snapshot: TokenExitSnapshot, id: string): SnapshotBoundary {
  const boundary = snapshot.boundaries?.find((entry) => entry.id === id);
  if (!boundary) {
    throw new Error(`Missing boundary '${id}'`);
  }
  return boundary;
}

function seedWitness(state: State, nodeId: string, witness: WitnessBundle): void {
  const handle = state.handles.get(nodeId);
  if (!handle) {
    throw new Error(`Missing handle '${nodeId}'`);
  }
  handle.meta = { ...(handle.meta ?? {}), witness };
}

function parseEdge(edge: string): [string, string] | null {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    return null;
  }
  const source = edge.slice(0, pivot);
  const target = edge.slice(pivot + 2);
  if (!source || !target) {
    return null;
  }
  return [source, target];
}

function buildContPredecessorIndex(state: State): Map<string, string[]> {
  const byTarget = new Map<string, Set<string>>();
  for (const edge of state.cont) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const predecessors = byTarget.get(target) ?? new Set<string>();
    predecessors.add(source);
    byTarget.set(target, predecessors);
  }
  const out = new Map<string, string[]>();
  for (const [target, predecessors] of byTarget.entries()) {
    out.set(
      target,
      [...predecessors].sort((left, right) => left.localeCompare(right))
    );
  }
  return out;
}

function collectBackwardContNodes(
  state: State,
  startNodeId: string
): Array<{ nodeId: string; distance: number }> {
  const predecessors = buildContPredecessorIndex(state);
  const distanceByNode = new Map<string, number>([[startNodeId, 0]]);
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const distance = distanceByNode.get(current) ?? 0;
    for (const previous of predecessors.get(current) ?? []) {
      if (distanceByNode.has(previous)) {
        continue;
      }
      distanceByNode.set(previous, distance + 1);
      queue.push(previous);
    }
  }

  return [...distanceByNode.entries()]
    .map(([nodeId, distance]) => ({ nodeId, distance }))
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      return left.nodeId.localeCompare(right.nodeId);
    });
}

function witnessBundleFromSource(state: State, sourceNodeId: string): WitnessBundle {
  const candidate =
    state.handles.get(sourceNodeId)?.meta?.witness ??
    state.handles.get(sourceNodeId)?.meta?.witness_bundle ??
    null;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }
  return candidate;
}

function effProfile(
  state: State,
  focusNodeId: string
): {
  bundle: WitnessBundle;
  visited: Array<{ nodeId: string; distance: number }>;
  contributions: EffContribution[];
} {
  const visited = collectBackwardContNodes(state, focusNodeId);
  const distanceByNode = new Map(
    visited.map(({ nodeId, distance }) => [nodeId, distance] as const)
  );
  const contributions = [...state.carry]
    .map((edge) => {
      const parsed = parseEdge(edge);
      if (!parsed) {
        return null;
      }
      const [source, target] = parsed;
      const targetDistance = distanceByNode.get(target);
      if (targetDistance === undefined) {
        return null;
      }
      const witness = witnessBundleFromSource(state, source);
      if (Object.keys(witness).length === 0) {
        return null;
      }
      const resolution = resolveCarry(state, source, target, { focusNodeId });
      return {
        source,
        target,
        targetDistance,
        resolution: resolution.status,
        closer: resolution.closer,
        witness
      } satisfies EffContribution;
    })
    .filter((entry): entry is EffContribution => entry !== null)
    .sort((left, right) => {
      if (left.targetDistance !== right.targetDistance) {
        return left.targetDistance - right.targetDistance;
      }
      if (left.target !== right.target) {
        return left.target.localeCompare(right.target);
      }
      return left.source.localeCompare(right.source);
    });

  return {
    bundle: eff(state, focusNodeId, { focusNodeId }),
    visited,
    contributions
  };
}

function collectReferencedHandles(state: State): Set<string> {
  const referenced = new Set<string>();

  const add = (value: unknown): void => {
    if (typeof value === "string") {
      if (state.handles.has(value)) {
        referenced.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        add(entry);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const entry of Object.values(value as Record<string, unknown>)) {
      add(entry);
    }
  };

  add(state.vm.D);
  add(state.vm.F);
  add(state.vm.R);
  add(state.vm.K);
  add(state.vm.A);
  add(state.vm.W);
  add(state.vm.E);
  add(state.vm.wordEntryFocus);
  add(state.vm.activeConstruct);
  add(state.vm.wordLastSealedArtifact);
  add(state.vm.OStack_word);
  add(state.vm.H);
  add(state.vm.aliasEdges);

  for (const edgeSet of [state.cont, state.carry, state.supp, state.head_of, state.sub]) {
    for (const edge of edgeSet) {
      const parsed = parseEdge(edge);
      if (!parsed) {
        continue;
      }
      add(parsed[0]);
      add(parsed[1]);
    }
  }

  add(state.boundaries);
  add(state.links);
  add(state.rules);
  return referenced;
}

function assertNoOrphanHandles(state: State): void {
  const referenced = collectReferencedHandles(state);
  for (const id of state.handles.keys()) {
    expect(referenced.has(id)).toBe(true);
  }
}

describe("hold family word traces", () => {
  it("keeps hold-family words structurally connected and limits mem enclosures to mem words", () => {
    for (const [word, expectsMem] of [
      ["כָּל", false],
      ["לֵב", false],
      ["מֶלֶךְ", true],
      ["מָלֵא", true],
      ["כְּלָל", false],
      ["לב", false],
      ["כב", false],
      ["כלא", false]
    ] as const) {
      const run = runWord(word);

      assertStateInvariants(run.state);
      assertNoOrphanHandles(run.state);
      expect(run.state.boundaries.some((boundary) => boundary.kind === "mem_enclosure")).toBe(
        expectsMem
      );

      for (const token of run.tokens.filter((entry) => entry.token === "ל")) {
        const event = lastEvent(token.snapshot, "lamed_step_past");
        expect(token.snapshot.vm?.F).toBe(event.data.id);
        expect(token.snapshot.vm?.F).not.toBe(event.data.hold);
      }
    }
  });

  it("traces כָּל as a supported hold followed by a carryless overstep by ל", () => {
    const run = runWord("כָּל");
    const [kaf, lamed] = run.tokens;
    const baseline = baselineId(kaf.snapshot);
    const kafHold = String(kaf.snapshot.vm?.F);
    const lamedEvent = lastEvent(lamed.snapshot, "lamed_step_past");
    const lamedHold = String(lamedEvent.data.hold);
    const exterior = String(lamedEvent.data.id);

    expect(kaf.snapshot.cont).toEqual([`${baseline}->${kafHold}`]);
    expect(kaf.snapshot.carry).toEqual([]);
    expect(kaf.snapshot.supp).toEqual([`${kafHold}->${baseline}`]);

    expect(lamedEvent.data.source).toBe(kafHold);
    expect(lamed.snapshot.vm?.F).toBe(exterior);
    expect(lamed.snapshot.cont).toEqual([
      `${baseline}->${kafHold}`,
      `${kafHold}->${lamedHold}`,
      `${lamedHold}->${exterior}`
    ]);
    expect(lamed.snapshot.carry).toEqual([]);
    expect(lamed.snapshot.supp).toEqual([`${kafHold}->${baseline}`, `${lamedHold}->${kafHold}`]);

    seedWitness(run.state, baseline, AMBIENT_WITNESS);
    seedWitness(run.state, kafHold, FIRST_HOLD_WITNESS);
    expect(effProfile(run.state, exterior).contributions).toEqual([]);
  });

  it("distinguishes לב from כב by the node that ב houses, while neither input leaves ambient carry background", () => {
    const lev = runWord("לֵב");
    const kev = runWord("כב");

    const levBaseline = baselineIdFromState(lev.state);
    const levLamedEvent = lastEvent(lev.tokens[0].snapshot, "lamed_step_past");
    const levBetEvent = lastEvent(lev.tokens[1].snapshot, "boundary_open");
    const levBoundary = boundaryById(lev.tokens[1].snapshot, String(levBetEvent.data.id));

    const kevKafHold = String(kev.tokens[0].snapshot.vm?.F);
    const kevBetEvent = lastEvent(kev.tokens[1].snapshot, "boundary_open");
    const kevBoundary = boundaryById(kev.tokens[1].snapshot, String(kevBetEvent.data.id));

    expect(levBoundary.inside).toBe(levLamedEvent.data.id);
    expect(levBoundary.inside).not.toBe(levLamedEvent.data.hold);
    expect(kevBoundary.inside).toBe(kevKafHold);

    seedWitness(lev.state, levBaseline, AMBIENT_WITNESS);
    seedWitness(kev.state, baselineIdFromState(kev.state), AMBIENT_WITNESS);
    expect(effProfile(lev.state, levBoundary.inside).contributions).toEqual([]);
    expect(effProfile(kev.state, kevBoundary.inside).contributions).toEqual([]);
  });

  it("traces מֶלֶךְ with a mem enclosure, an interior ל step-past chain, and direct-supported final ך", () => {
    const run = runWord("מֶלֶךְ");
    const [mem, lamed, finalKaf] = run.tokens;
    const baseline = baselineIdFromState(run.state);
    const memInterior = String(mem.snapshot.vm?.F);
    const memBoundary = boundaryById(mem.snapshot, "מb:1:1");
    const lamedEvent = lastEvent(lamed.snapshot, "lamed_step_past");
    const lamedHold = String(lamedEvent.data.hold);
    const lamedExterior = String(lamedEvent.data.id);
    const sealedId = String(finalKaf.snapshot.vm?.F);
    const sealedHandle = handleById(finalKaf.snapshot, sealedId);

    expect(memBoundary.inside).toBe(memInterior);
    expect(memBoundary.outside).toBe("מ:1:1");
    expect(lamedEvent.data.source).toBe(memInterior);
    expect(contReachable(run.state, memBoundary.inside, lamedHold)).toBe(true);
    expect(contReachable(run.state, lamedHold, lamedExterior)).toBe(true);

    expect(sealedHandle.policy).toBe("final");
    expect(sealedHandle.meta?.heldFrom).toBe(lamedExterior);
    expect(finalKaf.snapshot.carry).toEqual([]);
    expect(finalKaf.snapshot.supp).toContain(`${sealedId}->${lamedExterior}`);
    expect(finalKaf.snapshot.boundaries).toEqual([
      expect.objectContaining({
        id: "מb:1:1",
        inside: memInterior,
        outside: memBoundary.outside,
        kind: "mem_enclosure",
        open: true,
        closed: false
      })
    ]);
    expect(run.state.boundaries).toEqual([
      expect.objectContaining({
        id: "מb:1:1",
        inside: memInterior,
        outside: memBoundary.outside,
        kind: "mem_enclosure",
        open: false,
        closed: true,
        close_mode: "word_boundary",
        closed_by: "hard"
      })
    ]);

    seedWitness(run.state, baseline, AMBIENT_WITNESS);
    seedWitness(run.state, lamedExterior, EXTERIOR_WITNESS);
    expect(effProfile(run.state, sealedId).contributions).toEqual([]);
  });

  it("locks the ל exterior with א in both מָלֵא and כלא, while only מָלֵא preserves mem enclosure ancestry", () => {
    const mem = runWord("מָלֵא");
    const kaf = runWord("כלא");

    const memLamedEvent = lastEvent(mem.tokens[1].snapshot, "lamed_step_past");
    const memAlias = lastEvent(mem.tokens[2].snapshot, "alias");
    const kafLamedEvent = lastEvent(kaf.tokens[1].snapshot, "lamed_step_past");
    const kafAlias = lastEvent(kaf.tokens[2].snapshot, "alias");

    expect(memAlias.data.right).toBe(memLamedEvent.data.id);
    expect(kafAlias.data.right).toBe(kafLamedEvent.data.id);
    expect(mem.tokens[2].snapshot.links).toContainEqual({
      from: "Ω",
      to: String(memLamedEvent.data.id),
      label: "transport"
    });
    expect(kaf.tokens[2].snapshot.links).toContainEqual({
      from: "Ω",
      to: String(kafLamedEvent.data.id),
      label: "transport"
    });

    expect(mem.tokens[0].snapshot.boundaries).toEqual([
      expect.objectContaining({
        kind: "mem_enclosure",
        inside: String(mem.tokens[0].snapshot.vm?.F),
        outside: "מ:1:1"
      })
    ]);
    expect(memLamedEvent.data.source).toBe(mem.tokens[0].snapshot.vm?.F);
    expect(kaf.tokens[0].snapshot.boundaries).toEqual([]);
    expect(kafLamedEvent.data.source).toBe(kaf.tokens[0].snapshot.vm?.F);
    expect(mem.state.boundaries.some((boundary) => boundary.kind === "mem_enclosure")).toBe(true);
    expect(kaf.state.boundaries.some((boundary) => boundary.kind === "mem_enclosure")).toBe(false);
  });

  it("traces כְּלָל as two distinct ל hold-and-step-past sequences and walks back through both holds", () => {
    const run = runWord("כְּלָל");
    const [kaf, firstLamed, secondLamed] = run.tokens;
    const baseline = baselineIdFromState(run.state);
    const kafHold = String(kaf.snapshot.vm?.F);
    const firstEvent = lastEvent(firstLamed.snapshot, "lamed_step_past");
    const secondEvent = lastEvent(secondLamed.snapshot, "lamed_step_past");
    const finalFocus = String(secondLamed.snapshot.vm?.F);

    expect(firstEvent.data.source).toBe(kafHold);
    expect(secondEvent.data.source).toBe(firstEvent.data.id);
    expect(firstEvent.data.hold).not.toBe(secondEvent.data.hold);
    expect(firstEvent.data.id).not.toBe(secondEvent.data.id);

    seedWitness(run.state, baseline, AMBIENT_WITNESS);
    const profile = effProfile(run.state, finalFocus);
    expect(profile.visited).toEqual([
      { nodeId: finalFocus, distance: 0 },
      { nodeId: String(secondEvent.data.hold), distance: 1 },
      { nodeId: String(firstEvent.data.id), distance: 2 },
      { nodeId: String(firstEvent.data.hold), distance: 3 },
      { nodeId: kafHold, distance: 4 },
      { nodeId: baseline, distance: 5 }
    ]);
    expect(profile.contributions).toEqual([]);
  });
});
