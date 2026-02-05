import { describe, expect, it } from "vitest";
import { peOp } from "@ref/letters/pe";
import { createInitialState } from "@ref/state/state";

describe("pe contract", () => {
  it("meta is well-formed", () => {
    expect(peOp.meta.arity_req).toBeTypeOf("number");
    expect(peOp.meta.arity_opt).toBeTypeOf("number");
    expect(peOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(peOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(peOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = peOp.bound(state, {
      args: [state.vm.F, state.vm.Omega],
      prefs: {}
    });
    const { h, r } = peOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
