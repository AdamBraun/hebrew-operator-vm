import { describe, expect, it } from "vitest";
import { yodOp } from "../../letters/yod";
import { createInitialState } from "../../state/state";

describe("yod contract", () => {
  it("meta is well-formed", () => {
    expect(yodOp.meta.arity_req).toBeTypeOf("number");
    expect(yodOp.meta.arity_opt).toBeTypeOf("number");
    expect(yodOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(yodOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(yodOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = yodOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = yodOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
