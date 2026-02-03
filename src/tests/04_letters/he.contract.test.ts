import { describe, expect, it } from "vitest";
import { heOp } from "../../letters/he";
import { createInitialState } from "../../state/state";

describe("he contract", () => {
  it("meta is well-formed", () => {
    expect(heOp.meta.arity_req).toBeTypeOf("number");
    expect(heOp.meta.arity_opt).toBeTypeOf("number");
    expect(heOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(heOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(heOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = heOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = heOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
