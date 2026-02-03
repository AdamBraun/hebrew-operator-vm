import { describe, expect, it } from "vitest";
import { vavOp } from "../../letters/vav";
import { createInitialState } from "../../state/state";

describe("vav contract", () => {
  it("meta is well-formed", () => {
    expect(vavOp.meta.arity_req).toBeTypeOf("number");
    expect(vavOp.meta.arity_opt).toBeTypeOf("number");
    expect(vavOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(vavOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(vavOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = vavOp.bound(state, { args: [state.vm.F, state.vm.R], prefs: {} });
    const { h, r } = vavOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
