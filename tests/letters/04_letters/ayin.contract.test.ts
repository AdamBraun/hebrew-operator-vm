import { describe, expect, it } from "vitest";
import { ayinOp } from "@ref/letters/ayin";
import { createInitialState } from "@ref/state/state";

describe("ayin contract", () => {
  it("meta is well-formed", () => {
    expect(ayinOp.meta.arity_req).toBeTypeOf("number");
    expect(ayinOp.meta.arity_opt).toBeTypeOf("number");
    expect(ayinOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(ayinOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(ayinOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = ayinOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = ayinOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
