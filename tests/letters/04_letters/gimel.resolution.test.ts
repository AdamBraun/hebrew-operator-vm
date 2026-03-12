import { describe, expect, it } from "vitest";
import { gimelOp } from "@ref/letters/gimel";
import type { LetterOp } from "@ref/letters/types";
import { vavOp } from "@ref/letters/vav";
import { eff, resolveCarry } from "@ref/state/eff";
import { addSupp } from "@ref/state/relations";
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

describe("gimel resolution", () => {
  it("uses ordinary carry/supp resolution to close the shoulder carry from downstream focus", () => {
    const state = createInitialState();
    const F0 = state.vm.F;
    seedWitness(state, F0, { fromF0: "resolved-through-gimel" });

    const gimelStep = executeUnary(state, gimelOp);
    const { shoulderId, successorId } = gimelStep.cons.meta as {
      shoulderId: string;
      successorId: string;
    };
    const downstream = executeUnary(state, vavOp);
    const C = downstream.child;

    addSupp(state, C, F0);

    expect(gimelStep.origin).toBe(F0);
    expect(gimelStep.child).toBe(successorId);
    expect(state.cont.has(`${F0}->${shoulderId}`)).toBe(true);
    expect(state.carry.has(`${F0}->${shoulderId}`)).toBe(true);
    expect(state.cont.has(`${shoulderId}->${successorId}`)).toBe(true);
    expect(state.cont.has(`${successorId}->${C}`)).toBe(true);
    expect(state.vm.F).toBe(C);
    expect(backwardContLineage(state, C)).toContain(shoulderId);

    expect(resolveCarry(state, F0, shoulderId)).toEqual({
      status: "resolved",
      closer: C
    });
    expect(eff(state, C)).toEqual({
      fromF0: "resolved-through-gimel"
    });

    expect(state.supp).toEqual(new Set([`${C}->${F0}`]));
    expect(state.handles.get(shoulderId)?.meta).toEqual({});
    expect(state.handles.get(successorId)?.meta).toEqual({});
    expect(state.handles.get(C)?.meta).toEqual({});
  });
});
