import { describe, expect, it } from "vitest";
import { finalPeOp } from "@ref/letters/finalPe";
import { peOp } from "@ref/letters/pe";
import { createInitialState } from "@ref/state/state";

describe("final pe contract", () => {
  it("meta is well-formed", () => {
    expect(finalPeOp.meta.arity_req).toBeTypeOf("number");
    expect(finalPeOp.meta.arity_opt).toBeTypeOf("number");
    expect(finalPeOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(finalPeOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(finalPeOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = peOp.bound(state, { args: [state.vm.F, state.vm.Omega], prefs: {} });
    const { h } = peOp.seal(state, cons);
    const { cons: finalCons } = finalPeOp.bound(state, { args: [h], prefs: {} });
    const { h: closed, r } = finalPeOp.seal(state, finalCons);
    expect(state.handles.has(closed)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
