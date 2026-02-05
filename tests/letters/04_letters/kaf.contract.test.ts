import { describe, expect, it } from "vitest";
import { kafOp } from "@ref/letters/kaf";
import { finalKafOp } from "@ref/letters/finalKaf";
import { createInitialState } from "@ref/state/state";

describe("kaf contract", () => {
  it("meta is well-formed", () => {
    expect(kafOp.meta.arity_req).toBeTypeOf("number");
    expect(kafOp.meta.arity_opt).toBeTypeOf("number");
    expect(kafOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(kafOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(kafOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = kafOp.bound(state, { args: [state.vm.F, state.vm.R], prefs: {} });
    const { h, r } = kafOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r)).toBe(true);
  });

  it("final kaf returns valid handles", () => {
    const state = createInitialState();
    const { cons } = finalKafOp.bound(state, { args: [state.vm.F, state.vm.R], prefs: {} });
    const { h, r } = finalKafOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r)).toBe(true);
  });
});
