import { describe, expect, it } from "vitest";
import { gimelOp } from "../../letters/gimel";
import { createInitialState } from "../../state/state";

describe("gimel contract", () => {
  it("meta is well-formed", () => {
    expect(gimelOp.meta.arity_req).toBeTypeOf("number");
    expect(gimelOp.meta.arity_opt).toBeTypeOf("number");
    expect(gimelOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(gimelOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(gimelOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = gimelOp.bound(state, { args: [state.vm.F, state.vm.F], prefs: {} });
    const { h, r } = gimelOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
