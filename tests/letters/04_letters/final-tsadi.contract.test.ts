import { describe, expect, it } from "vitest";
import { finalTsadiOp } from "@ref/letters/finalTsadi";
import { createInitialState } from "@ref/state/state";

describe("final tsadi contract", () => {
  it("meta is well-formed", () => {
    expect(finalTsadiOp.meta.arity_req).toBeTypeOf("number");
    expect(finalTsadiOp.meta.arity_opt).toBeTypeOf("number");
    expect(finalTsadiOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(finalTsadiOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(finalTsadiOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = finalTsadiOp.bound(state, {
      args: [state.vm.F, state.vm.Omega],
      prefs: {}
    });
    const { h, r } = finalTsadiOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
