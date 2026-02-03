import { describe, expect, it } from "vitest";
import { betOp } from "@ref/letters/bet";
import { createInitialState } from "@ref/state/state";

describe("bet contract", () => {
  it("meta is well-formed", () => {
    expect(betOp.meta.arity_req).toBeTypeOf("number");
    expect(betOp.meta.arity_opt).toBeTypeOf("number");
    expect(betOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(betOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(betOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = betOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = betOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
