import { describe, expect, it } from "vitest";
import { zayinOp } from "@ref/letters/zayin";
import { createInitialState } from "@ref/state/state";

describe("zayin contract", () => {
  it("meta is well-formed", () => {
    expect(zayinOp.meta.arity_req).toBeTypeOf("number");
    expect(zayinOp.meta.arity_opt).toBeTypeOf("number");
    expect(zayinOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(zayinOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(zayinOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = zayinOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = zayinOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
