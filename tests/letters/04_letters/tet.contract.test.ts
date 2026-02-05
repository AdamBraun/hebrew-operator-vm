import { describe, expect, it } from "vitest";
import { tetOp } from "@ref/letters/tet";
import { createInitialState } from "@ref/state/state";

describe("tet contract", () => {
  it("meta is well-formed", () => {
    expect(tetOp.meta.arity_req).toBeTypeOf("number");
    expect(tetOp.meta.arity_opt).toBeTypeOf("number");
    expect(tetOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(tetOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(tetOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = tetOp.bound(state, { args: [state.vm.F, state.vm.Omega], prefs: {} });
    const { h, r } = tetOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
