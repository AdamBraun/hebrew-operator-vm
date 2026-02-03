import { describe, expect, it } from "vitest";
import { nunOp } from "@ref/letters/nun";
import { createInitialState } from "@ref/state/state";

describe("nun contract", () => {
  it("meta is well-formed", () => {
    expect(nunOp.meta.arity_req).toBeTypeOf("number");
    expect(nunOp.meta.arity_opt).toBeTypeOf("number");
    expect(nunOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(nunOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(nunOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = nunOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = nunOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
