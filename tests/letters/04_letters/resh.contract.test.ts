import { describe, expect, it } from "vitest";
import { reshOp } from "@ref/letters/resh";
import { createInitialState } from "@ref/state/state";

describe("resh contract", () => {
  it("meta is well-formed", () => {
    expect(reshOp.meta.arity_req).toBeTypeOf("number");
    expect(reshOp.meta.arity_opt).toBeTypeOf("number");
    expect(reshOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(reshOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(reshOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = reshOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = reshOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
