import { describe, expect, it } from "vitest";
import { tetOp } from "@ref/letters/tet";
import { type LetterMeta } from "@ref/letters/types";
import { BOT_ID, OMEGA_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { resolveSelectableHandle, selectCurrentFocus, selectOperands } from "@ref/vm/select";

const unaryOpMeta: LetterMeta = {
  letter: "X",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

describe("tet selector", () => {
  it("forces external selection and operation to go through the emitted port", () => {
    const state = createInitialState();
    const X = "X";
    state.handles.set(X, createHandle(X, "scope"));

    const { cons } = tetOp.bound(state, { args: [X], prefs: {} });
    const { h: p } = tetOp.seal(state, cons);

    state.vm.K = [];
    state.vm.W = [];
    state.vm.R = BOT_ID;
    state.vm.D = OMEGA_ID;

    state.vm.F = X;
    expect(resolveSelectableHandle(state, X)).toBe(BOT_ID);
    expect(selectCurrentFocus(state).ops.args).toEqual([BOT_ID]);

    state.vm.F = OMEGA_ID;
    state.vm.K = [X];
    expect(selectOperands(state, unaryOpMeta).ops.args).toEqual([BOT_ID]);

    state.vm.F = p;
    expect(resolveSelectableHandle(state, p)).toBe(X);
    expect(selectCurrentFocus(state).ops.args).toEqual([X]);

    state.vm.F = OMEGA_ID;
    state.vm.K = [p];
    expect(selectOperands(state, unaryOpMeta).ops.args).toEqual([X]);
  });
});
