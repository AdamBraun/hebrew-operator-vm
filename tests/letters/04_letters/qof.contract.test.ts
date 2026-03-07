import { describe, expect, it } from "vitest";
import { qofOp } from "@ref/letters/qof";
import { createInitialState } from "@ref/state/state";

describe("qof contract", () => {
  it("meta is well-formed", () => {
    expect(qofOp.meta.arity_req).toBeTypeOf("number");
    expect(qofOp.meta.arity_opt).toBeTypeOf("number");
    expect(qofOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(qofOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(qofOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { cons } = qofOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = qofOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
    expect(state.head_of.size).toBe(1);
    expect(state.carry.size).toBe(2);
    expect(state.cont.size).toBe(2);
    expect(state.supp.size).toBe(0);
    expect(state.sub.size).toBe(1);
    expect(state.adjuncts[h]).toHaveLength(1);
    expect(state.links).toEqual([]);
  });
});
