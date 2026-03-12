import { describe, expect, it } from "vitest";
import { kafOp } from "@ref/letters/kaf";
import { lamedOp } from "@ref/letters/lamed";
import { memOp } from "@ref/letters/mem";
import { finalMemOp } from "@ref/letters/finalMem";
import type { LetterOp } from "@ref/letters/types";
import { eff, resolveCarry, type WitnessBundle } from "@ref/state/eff";
import { createHandle } from "@ref/state/handles";
import { addCont } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";

const PRE_FOCUS_ID = "P0";
const FOCUS_ID = "F0";
const FOCUS_WITNESS = { fromF0: "ambient" };
const HOLD_WITNESS = { fromH: "hold" };
const INTERIOR_WITNESS = { fromI: "interior" };

type TestState = ReturnType<typeof createInitialState>;

type EffContribution = {
  source: string;
  target: string;
  targetDistance: number;
  resolution: "resolved" | "unresolved";
  closer: string | null;
  witness: WitnessBundle;
};

function executeLetterOp(state: TestState, op: LetterOp) {
  const beforeFocus = state.vm.F;
  const selectResult = op.select(state);
  const boundResult = op.bound(selectResult.S, selectResult.ops);
  const sealResult = op.seal(boundResult.S, boundResult.cons);
  state.vm.K.push(sealResult.h);
  state.vm.F = sealResult.advance_focus === false ? beforeFocus : sealResult.h;
  state.vm.R = sealResult.r;
  return {
    cons: boundResult.cons,
    h: sealResult.h,
    r: sealResult.r
  };
}

function createHarnessState(): TestState {
  const state = createInitialState();
  state.handles.set(PRE_FOCUS_ID, createHandle(PRE_FOCUS_ID, "scope"));
  state.handles.set(
    FOCUS_ID,
    createHandle(FOCUS_ID, "scope", {
      meta: { witness: FOCUS_WITNESS }
    })
  );
  addCont(state, PRE_FOCUS_ID, FOCUS_ID);
  state.vm.F = FOCUS_ID;
  state.vm.wordEntryFocus = FOCUS_ID;
  return state;
}

function seedWitness(state: TestState, nodeId: string, witness: WitnessBundle): void {
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

function buildContPredecessorIndex(state: TestState): Map<string, string[]> {
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
  state: TestState,
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

function witnessBundleFromSource(state: TestState, sourceNodeId: string): WitnessBundle {
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
  state: TestState,
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

function contSuccessors(state: TestState, nodeId: string): string[] {
  return [...state.cont]
    .map((edge) => parseEdge(edge))
    .filter((entry): entry is [string, string] => entry !== null && entry[0] === nodeId)
    .map(([, target]) => target)
    .sort((left, right) => left.localeCompare(right));
}

describe("eff hold family", () => {
  it("keeps kaf on the supported hold without adding a carry-ledger contribution", () => {
    const state = createHarnessState();
    const { cons, h: holdId } = executeLetterOp(state, kafOp);
    const { source } = cons.meta as { source: string };

    const profile = effProfile(state, holdId);

    expect(source).toBe(FOCUS_ID);
    expect(state.vm.F).toBe(holdId);
    expect(profile.bundle).toEqual({});
    expect(profile.visited).toEqual([
      { nodeId: holdId, distance: 0 },
      { nodeId: FOCUS_ID, distance: 1 },
      { nodeId: PRE_FOCUS_ID, distance: 2 }
    ]);
    expect(profile.contributions).toEqual([]);
    expect(contSuccessors(state, holdId)).toEqual([]);
  });

  it("distinguishes kaf from lamed and mem by carry-ledger participation, while leaving lamed and mem bundle-identical", () => {
    const kafState = createHarnessState();
    const kafResult = executeLetterOp(kafState, kafOp);
    const kafMeta = kafResult.cons.meta as { holdId: string };
    const kafProfile = effProfile(kafState, kafMeta.holdId);

    const lamedState = createHarnessState();
    const lamedResult = executeLetterOp(lamedState, lamedOp);
    const lamedMeta = lamedResult.cons.meta as {
      holdId: string;
      exteriorId: string;
    };
    seedWitness(lamedState, lamedMeta.holdId, HOLD_WITNESS);
    const lamedProfile = effProfile(lamedState, lamedMeta.exteriorId);

    const memState = createHarnessState();
    const memResult = executeLetterOp(memState, memOp);
    const memMeta = memResult.cons.meta as {
      holdId: string;
      interiorId: string;
      boundaryId: string;
    };
    seedWitness(memState, memMeta.holdId, HOLD_WITNESS);
    const memProfile = effProfile(memState, memMeta.interiorId);

    expect(kafProfile.bundle).toEqual({});
    expect(kafProfile.contributions).toEqual([]);

    expect(lamedProfile.bundle).toEqual(FOCUS_WITNESS);
    expect(lamedProfile.visited).toEqual([
      { nodeId: lamedMeta.exteriorId, distance: 0 },
      { nodeId: lamedMeta.holdId, distance: 1 },
      { nodeId: FOCUS_ID, distance: 2 },
      { nodeId: PRE_FOCUS_ID, distance: 3 }
    ]);
    expect(lamedProfile.contributions).toEqual([
      {
        source: FOCUS_ID,
        target: lamedMeta.holdId,
        targetDistance: 1,
        resolution: "resolved",
        closer: lamedMeta.holdId,
        witness: FOCUS_WITNESS
      }
    ]);
    expect(lamedProfile.bundle).not.toHaveProperty("fromH");
    expect(lamedState.boundaries).toEqual([]);

    expect(memProfile.bundle).toEqual(FOCUS_WITNESS);
    expect(memProfile.visited).toEqual([
      { nodeId: memMeta.interiorId, distance: 0 },
      { nodeId: memMeta.holdId, distance: 1 },
      { nodeId: FOCUS_ID, distance: 2 },
      { nodeId: PRE_FOCUS_ID, distance: 3 }
    ]);
    expect(memProfile.contributions).toEqual([
      {
        source: FOCUS_ID,
        target: memMeta.holdId,
        targetDistance: 1,
        resolution: "resolved",
        closer: memMeta.holdId,
        witness: FOCUS_WITNESS
      }
    ]);
    expect(memProfile.bundle).not.toHaveProperty("fromH");
    expect(memProfile.bundle).toEqual(lamedProfile.bundle);
    expect(memState.boundaries).toEqual([
      expect.objectContaining({
        id: memMeta.boundaryId,
        inside: memMeta.interiorId,
        outside: memMeta.holdId,
        kind: "mem_enclosure",
        open: true,
        closed: false
      })
    ]);
  });

  it("makes sealed interior work directly visible only after mem closes", () => {
    const state = createHarnessState();
    const open = executeLetterOp(state, memOp);
    const { holdId, interiorId, boundaryId } = open.cons.meta as {
      holdId: string;
      interiorId: string;
      boundaryId: string;
    };
    seedWitness(state, holdId, HOLD_WITNESS);
    seedWitness(state, interiorId, INTERIOR_WITNESS);

    const closed = executeLetterOp(state, finalMemOp);
    const sealedId = closed.h;
    const profile = effProfile(state, sealedId);

    expect(state.vm.F).toBe(sealedId);
    expect(profile.bundle).toEqual({
      ...INTERIOR_WITNESS,
      ...FOCUS_WITNESS
    });
    expect(profile.visited).toEqual([
      { nodeId: sealedId, distance: 0 },
      { nodeId: interiorId, distance: 1 },
      { nodeId: holdId, distance: 2 },
      { nodeId: FOCUS_ID, distance: 3 },
      { nodeId: PRE_FOCUS_ID, distance: 4 }
    ]);
    expect(profile.contributions).toEqual([
      {
        source: interiorId,
        target: sealedId,
        targetDistance: 0,
        resolution: "resolved",
        closer: sealedId,
        witness: INTERIOR_WITNESS
      },
      {
        source: FOCUS_ID,
        target: holdId,
        targetDistance: 2,
        resolution: "resolved",
        closer: holdId,
        witness: FOCUS_WITNESS
      }
    ]);
    expect(profile.bundle).not.toHaveProperty("fromH");
    expect(state.boundaries).toEqual([
      expect.objectContaining({
        id: boundaryId,
        inside: interiorId,
        outside: holdId,
        kind: "mem_enclosure",
        open: false,
        closed: true,
        close_mode: "explicit",
        closed_by: "ם"
      })
    ]);
  });
});
