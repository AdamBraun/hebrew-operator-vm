import { describe, expect, it } from "vitest";
import { tavOp } from "@ref/letters/tav";
import { createInitialState } from "@ref/state/state";

describe("tav contract", () => {
  it("meta is well-formed", () => {
    expect(tavOp.meta.arity_req).toBeTypeOf("number");
    expect(tavOp.meta.arity_opt).toBeTypeOf("number");
    expect(tavOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(tavOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(tavOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = tavOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = tavOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
