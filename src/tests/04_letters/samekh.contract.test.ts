import { describe, expect, it } from "vitest";
import { samekhOp } from "../../letters/samekh";
import { createInitialState } from "../../state/state";

describe("samekh contract", () => {
  it("meta is well-formed", () => {
    expect(samekhOp.meta.arity_req).toBeTypeOf("number");
    expect(samekhOp.meta.arity_opt).toBeTypeOf("number");
    expect(samekhOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(samekhOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(samekhOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = samekhOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = samekhOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
