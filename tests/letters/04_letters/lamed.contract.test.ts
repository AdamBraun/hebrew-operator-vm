import { describe, expect, it } from "vitest";
import { lamedOp } from "@ref/letters/lamed";
import { createInitialState } from "@ref/state/state";

describe("lamed contract", () => {
  it("meta is well-formed", () => {
    expect(lamedOp.meta.arity_req).toBeTypeOf("number");
    expect(lamedOp.meta.arity_opt).toBeTypeOf("number");
    expect(lamedOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(lamedOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(lamedOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = lamedOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = lamedOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
