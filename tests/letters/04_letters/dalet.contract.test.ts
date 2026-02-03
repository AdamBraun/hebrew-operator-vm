import { describe, expect, it } from "vitest";
import { daletOp } from "@ref/letters/dalet";
import { createInitialState } from "@ref/state/state";

describe("dalet contract", () => {
  it("meta is well-formed", () => {
    expect(daletOp.meta.arity_req).toBeTypeOf("number");
    expect(daletOp.meta.arity_opt).toBeTypeOf("number");
    expect(daletOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(daletOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(daletOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = daletOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = daletOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
