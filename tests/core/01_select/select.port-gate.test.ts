import { describe, expect, it } from "vitest";
import { tetOp } from "@ref/letters/tet";
import { BOT_ID, createHandle, OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import {
  resolveSelectableFocus,
  resolveSelectableHandle,
  selectCurrentFocus,
  selectOperands
} from "@ref/vm/select";
import { type LetterMeta } from "@ref/letters/types";

const unaryMeta: LetterMeta = {
  letter: "X",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

function createRestrictedTarget() {
  const state = createInitialState();
  const target = "target";
  state.handles.set(target, createHandle(target, "scope"));

  const { cons } = tetOp.bound(state, { args: [target], prefs: {} });
  const { h: portId } = tetOp.seal(state, cons);

  state.vm.K = [];
  state.vm.W = [];
  state.vm.R = BOT_ID;
  state.vm.D = OMEGA_ID;

  return { state, target, portId };
}

describe("select port gate", () => {
  it("blocks direct selection of a ט-restricted handle", () => {
    const { state, target } = createRestrictedTarget();

    state.vm.F = target;
    expect(resolveSelectableFocus(state)).toBe(BOT_ID);
    expect(resolveSelectableHandle(state, target)).toBe(BOT_ID);
    expect(selectCurrentFocus(state).ops.args).toEqual([BOT_ID]);

    state.vm.K = [target];
    expect(selectOperands(state, unaryMeta).ops.args).toEqual([BOT_ID]);
  });

  it("allows selection through the registered port", () => {
    const { state, target, portId } = createRestrictedTarget();

    state.vm.F = portId;
    expect(resolveSelectableFocus(state)).toBe(target);
    expect(resolveSelectableHandle(state, portId)).toBe(target);
    expect(selectCurrentFocus(state).ops.args).toEqual([target]);

    state.vm.F = OMEGA_ID;
    state.vm.K = [portId];
    expect(selectOperands(state, unaryMeta).ops.args).toEqual([target]);
  });
});
