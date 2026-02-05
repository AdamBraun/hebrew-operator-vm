import { describe, expect, it } from "vitest";
import { tsadiOp } from "@ref/letters/tsadi";
import { createInitialState } from "@ref/state/state";

describe("tsadi contract", () => {
  it("meta is well-formed", () => {
    expect(tsadiOp.meta.arity_req).toBeTypeOf("number");
    expect(tsadiOp.meta.arity_opt).toBeTypeOf("number");
    expect(tsadiOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(tsadiOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(tsadiOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = tsadiOp.bound(state, { args: [state.vm.F, state.vm.Omega], prefs: {} });
    const { h, r } = tsadiOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
