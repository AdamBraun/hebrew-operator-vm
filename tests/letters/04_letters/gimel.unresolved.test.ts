import { describe, expect, it } from "vitest";
import { gimelOp } from "@ref/letters/gimel";
import type { LetterOp } from "@ref/letters/types";
import { vavOp } from "@ref/letters/vav";
import { eff, resolveCarry } from "@ref/state/eff";
import { createInitialState } from "@ref/state/state";

type TestState = ReturnType<typeof createInitialState>;

function executeUnary(state: TestState, op: LetterOp) {
  const origin = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? origin : sealed.h;
  state.vm.R = sealed.r;

  return {
    origin,
    child: sealed.h,
    cons: bound.cons
  };
}

function seedWitness(state: TestState, nodeId: string, witness: Record<string, any>): void {
  const handle = state.handles.get(nodeId);
  if (!handle) {
    throw new Error(`Missing handle '${nodeId}'`);
  }
  handle.meta = { ...(handle.meta ?? {}), witness };
}

function backwardContLineage(state: TestState, startNodeId: string): string[] {
  const visited = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const edge of state.cont) {
      const [source, target] = edge.split("->");
      if (target !== current || !source || visited.has(source)) {
        continue;
      }
      visited.add(source);
      queue.push(source);
    }
  }

  return [...visited];
}

describe("gimel unresolved carry", () => {
  it("does not auto-resolve just because the continuation spine keeps growing", () => {
    const state = createInitialState();
    const F0 = state.vm.F;
    seedWitness(state, F0, { fromF0: "still-open" });

    const gimelStep = executeUnary(state, gimelOp);
    const { shoulderId } = gimelStep.cons.meta as { shoulderId: string };
    const firstDownstream = executeUnary(state, vavOp);
    const secondDownstream = executeUnary(state, vavOp);
    const C = secondDownstream.child;

    expect(firstDownstream.origin).toBe(gimelStep.child);
    expect(secondDownstream.origin).toBe(firstDownstream.child);
    expect(state.carry.has(`${F0}->${shoulderId}`)).toBe(true);
    expect(backwardContLineage(state, C)).toContain(shoulderId);
    expect(resolveCarry(state, F0, shoulderId)).toEqual({
      status: "unresolved",
      closer: null
    });
    expect(eff(state, C)).toEqual({
      fromF0: "still-open"
    });
    expect(state.supp.size).toBe(0);
    expect(state.supp.has(`${C}->${F0}`)).toBe(false);
    expect(state.supp.has(`${shoulderId}->${F0}`)).toBe(false);
  });
});
