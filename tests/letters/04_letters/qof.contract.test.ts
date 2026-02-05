import { describe, expect, it } from "vitest";
import { qofOp } from "@ref/letters/qof";
import { createInitialState } from "@ref/state/state";

describe("qof contract", () => {
  it("meta is well-formed", () => {
    expect(qofOp.meta.arity_req).toBeTypeOf("number");
    expect(qofOp.meta.arity_opt).toBeTypeOf("number");
    expect(qofOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(qofOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(qofOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = qofOp.bound(state, { args: [state.vm.F, state.vm.R], prefs: {} });
    const { h, r } = qofOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
