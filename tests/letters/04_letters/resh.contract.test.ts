import { describe, expect, it } from "vitest";
import { reshOp } from "@ref/letters/resh";
import { createInitialState } from "@ref/state/state";

describe("resh contract", () => {
  it("meta is well-formed", () => {
    expect(reshOp.meta.arity_req).toBeTypeOf("number");
    expect(reshOp.meta.arity_opt).toBeTypeOf("number");
    expect(reshOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(reshOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(reshOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("does not reference invalid handles", () => {
    const state = createInitialState();
    const { S, ops } = reshOp.select(state);
    const { cons } = reshOp.bound(S, ops);
    const { h, r } = reshOp.seal(state, cons);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
    expect(state.head_of.size).toBe(1);
    expect(state.carry.size).toBe(1);
  });

  it("keeps the exposed head carry live without same-step support", () => {
    const state = createInitialState();
    const { S, ops } = reshOp.select(state);
    const { cons } = reshOp.bound(S, ops);
    reshOp.seal(state, cons);

    const [headOfEdge = "->"] = Array.from(state.head_of);
    const [head = "", whole = ""] = headOfEdge.split("->");

    expect(head).not.toBe("");
    expect(whole).not.toBe("");
    // Positive control: ר is meant to keep the exposed-head carry live.
    expect(state.carry.has(`${whole}->${head}`)).toBe(true);
    expect(state.supp.has(`${head}->${whole}`)).toBe(false);
  });
});
