import { describe, expect, it } from "vitest";
import { alephOp } from "@ref/letters/aleph";
import { createInitialState } from "@ref/state/state";

describe("aleph contract", () => {
  it("meta is well-formed", () => {
    expect(alephOp.meta.arity_req).toBeTypeOf("number");
    expect(alephOp.meta.arity_opt).toBeTypeOf("number");
    expect(alephOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(alephOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(alephOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = alephOp.bound(state, { args: [state.vm.F, state.vm.R], prefs: {} });
    const { h, r } = alephOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
