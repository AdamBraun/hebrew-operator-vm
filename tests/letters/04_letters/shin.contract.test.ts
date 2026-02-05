import { describe, expect, it } from "vitest";
import { shinOp } from "@ref/letters/shin";
import { createInitialState } from "@ref/state/state";

describe("shin contract", () => {
  it("meta is well-formed", () => {
    expect(shinOp.meta.arity_req).toBeTypeOf("number");
    expect(shinOp.meta.arity_opt).toBeTypeOf("number");
    expect(shinOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(shinOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(shinOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = shinOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = shinOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
