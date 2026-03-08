import { describe, expect, it } from "vitest";
import { BOT_ID, OMEGA_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { eff, resolveCarry } from "@ref/state/eff";
import { kafOp } from "@ref/letters/kaf";
import { finalKafOp } from "@ref/letters/finalKaf";
import type { LetterOp } from "@ref/letters/types";

function executeLetterOp(state: ReturnType<typeof createInitialState>, op: LetterOp) {
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

describe("kaf behavior", () => {
  it("holds the current focus, lands on the held node, and allocates no successor", () => {
    const state = createInitialState();
    const stackNode = "stackNode";
    state.handles.set(stackNode, createHandle(stackNode, "scope"));
    state.vm.K.push(stackNode);

    const handlesBefore = new Set(state.handles.keys());
    const { cons, h, r } = executeLetterOp(state, kafOp);
    const { source, holdId } = cons.meta as { source: string; holdId: string };
    const newHandles = [...state.handles.keys()].filter((id) => !handlesBefore.has(id));

    expect(source).toBe(OMEGA_ID);
    expect(h).toBe(holdId);
    expect(r).toBe(BOT_ID);
    expect(newHandles).toEqual([holdId]);
    expect(state.vm.F).toBe(holdId);
    expect(state.cont).toEqual(new Set([`${source}->${holdId}`]));
    expect(state.carry).toEqual(new Set([`${source}->${holdId}`]));
    expect(state.supp).toEqual(new Set([`${holdId}->${source}`]));
  });

  it("makes the source witness visible at the held node as a resolved carry", () => {
    const state = createInitialState();
    const omega = state.handles.get(OMEGA_ID);
    omega!.meta = { ...(omega?.meta ?? {}), witness: { ambient: 1 } };

    const { cons } = executeLetterOp(state, kafOp);
    const { source, holdId } = cons.meta as { source: string; holdId: string };

    expect(resolveCarry(state, source, holdId, { focusNodeId: holdId })).toEqual({
      status: "resolved",
      closer: holdId
    });
    expect(eff(state, holdId, { focusNodeId: holdId })).toEqual({ ambient: 1 });
  });

  it("creates no boundary records after כ alone", () => {
    const state = createInitialState();

    executeLetterOp(state, kafOp);

    expect(state.boundaries).toHaveLength(0);
  });

  it("creates no obligation stack entries after כ alone", () => {
    const state = createInitialState();

    executeLetterOp(state, kafOp);

    expect(state.vm.OStack_word).toHaveLength(0);
    expect(state.vm.segment.OStack).toHaveLength(0);
  });

  it("nests repeated holds", () => {
    const state = createInitialState();

    const first = executeLetterOp(state, kafOp);
    const second = executeLetterOp(state, kafOp);
    const { source: firstSource, holdId: firstHoldId } = first.cons.meta as {
      source: string;
      holdId: string;
    };
    const { source: secondSource, holdId: secondHoldId } = second.cons.meta as {
      source: string;
      holdId: string;
    };

    expect(firstSource).toBe(OMEGA_ID);
    expect(secondSource).toBe(firstHoldId);
    expect(state.vm.F).toBe(secondHoldId);
    expect(state.cont).toEqual(
      new Set([`${firstSource}->${firstHoldId}`, `${firstHoldId}->${secondHoldId}`])
    );
    expect(state.carry).toEqual(
      new Set([`${firstSource}->${firstHoldId}`, `${firstHoldId}->${secondHoldId}`])
    );
    expect(state.supp).toEqual(
      new Set([`${firstHoldId}->${firstSource}`, `${secondHoldId}->${firstHoldId}`])
    );
  });

  it("final kaf seals the resolved hold with final policy", () => {
    const state = createInitialState();

    const { cons, h, r } = executeLetterOp(state, finalKafOp);
    const { source, holdId } = cons.meta as { source: string; holdId: string };
    const hold = state.handles.get(h);

    expect(h).toBe(holdId);
    expect(r).toBe(BOT_ID);
    expect(state.vm.F).toBe(holdId);
    expect(hold?.policy).toBe("final");
    expect(hold?.meta.final).toBe(1);
    expect(state.cont).toEqual(new Set([`${source}->${holdId}`]));
    expect(state.carry).toEqual(new Set([`${source}->${holdId}`]));
    expect(state.supp).toEqual(new Set([`${holdId}->${source}`]));
  });
});
