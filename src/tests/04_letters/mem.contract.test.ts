import { describe, expect, it } from "vitest";
import { memOp } from "../../letters/mem";
import { finalMemOp } from "../../letters/finalMem";
import { createInitialState } from "../../state/state";

describe("mem contract", () => {
  it("mem meta is well-formed", () => {
    expect(memOp.meta.arity_req).toBeTypeOf("number");
    expect(memOp.meta.arity_opt).toBeTypeOf("number");
    expect(memOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(memOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(memOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("final mem meta is well-formed", () => {
    expect(finalMemOp.meta.arity_req).toBeTypeOf("number");
    expect(finalMemOp.meta.arity_opt).toBeTypeOf("number");
    expect(finalMemOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(finalMemOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(finalMemOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("mem does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = memOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = memOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
