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
    const { S, ops } = daletOp.select(state);
    const { cons } = daletOp.bound(S, ops);
    const { h, r } = daletOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
    expect(state.head_of.size).toBe(1);
    expect(state.carry.size).toBe(1);
    expect(state.supp.size).toBe(1);
  });
});
