import { describe, expect, it } from "vitest";
import { hetOp } from "@ref/letters/het";
import { createInitialState } from "@ref/state/state";

describe("het contract", () => {
  it("meta is well-formed", () => {
    expect(hetOp.meta.arity_req).toBeTypeOf("number");
    expect(hetOp.meta.arity_opt).toBeTypeOf("number");
    expect(hetOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(hetOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(hetOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = hetOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = hetOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
