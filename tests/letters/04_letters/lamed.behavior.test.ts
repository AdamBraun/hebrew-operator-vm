import { describe, expect, it } from "vitest";
import { betOp } from "@ref/letters/bet";
import { createInitialState } from "@ref/state/state";
import { eff } from "@ref/state/eff";
import { OMEGA_ID } from "@ref/state/handles";
import { lamedOp } from "@ref/letters/lamed";
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

describe("lamed behavior", () => {
  it("resolves a hold, steps past it, and leaves no boundary or obligation state", () => {
    const state = createInitialState();
    const handlesBefore = new Set(state.handles.keys());

    const { cons, h: exteriorId } = executeLetterOp(state, lamedOp);
    const { source, holdId } = cons.meta as { source: string; holdId: string };

    const newHandles = [...state.handles.keys()].filter((id) => !handlesBefore.has(id));
    expect(newHandles.sort()).toEqual([exteriorId, holdId].sort());

    expect(source).toBe(OMEGA_ID);
    expect(state.vm.F).toBe(exteriorId);
    expect(state.cont.has(`${source}->${holdId}`)).toBe(true);
    expect(state.carry.has(`${source}->${holdId}`)).toBe(true);
    expect(state.supp.has(`${holdId}->${source}`)).toBe(true);
    expect(state.cont.has(`${holdId}->${exteriorId}`)).toBe(true);

    expect(state.carry.has(`${holdId}->${exteriorId}`)).toBe(false);
    expect(state.supp.has(`${exteriorId}->${holdId}`)).toBe(false);
    expect(state.boundaries).toHaveLength(0);
    expect(state.vm.OStack_word).toHaveLength(0);
    expect(state.cont.size + state.carry.size + state.supp.size).toBe(4);
    expect(state.vm.H).toContainEqual({
      type: "lamed_step_past",
      tau: state.vm.tau,
      data: { id: exteriorId, source, hold: holdId }
    });
  });

  it("keeps the resolved hold in background for eff without forwarding the hold bundle itself", () => {
    const state = createInitialState();
    const omega = state.handles.get(OMEGA_ID);
    omega!.meta = { ...(omega?.meta ?? {}), witness: { ambient: 1 } };

    const { cons, h: exteriorId } = executeLetterOp(state, lamedOp);
    const { holdId } = cons.meta as { holdId: string };
    const hold = state.handles.get(holdId);
    hold!.meta = { ...(hold?.meta ?? {}), witness: { holdSelf: 1 } };

    expect(eff(state, exteriorId, { focusNodeId: exteriorId })).toEqual({ ambient: 1 });
  });

  it("hands the exterior successor to the next letter, not the resolved hold", () => {
    const state = createInitialState();
    const { cons } = executeLetterOp(state, lamedOp);
    const { holdId, exteriorId } = cons.meta as { holdId: string; exteriorId: string };

    const { h: boundaryId } = executeLetterOp(state, betOp);
    const boundary = state.boundaries.find((entry) => entry.id === boundaryId);

    expect(boundary?.inside).toBe(exteriorId);
    expect(boundary?.inside).not.toBe(holdId);
  });
});
