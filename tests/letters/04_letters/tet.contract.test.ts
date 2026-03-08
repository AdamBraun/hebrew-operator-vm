import { describe, expect, it } from "vitest";
import { tetOp } from "@ref/letters/tet";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

describe("tet contract", () => {
  it("meta is well-formed and unary", () => {
    expect(tetOp.meta.arity_req).toBeTypeOf("number");
    expect(tetOp.meta.arity_opt).toBeTypeOf("number");
    expect(tetOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(tetOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(tetOp.meta.reflexive_ok).toBeTypeOf("boolean");
    expect(tetOp.meta.arity_req).toBe(1);
    expect(tetOp.meta.arity_opt).toBe(0);
  });

  it("selects exactly one current target operand", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));
    state.vm.F = target;

    const { ops } = tetOp.select(state);

    expect(ops.args).toEqual([target]);
    expect(ops.args).toHaveLength(1);
  });

  it("reifies one valid port handle", () => {
    const state = createInitialState();
    const handlesBefore = state.handles.size;
    const { cons } = tetOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = tetOp.seal(state, cons);

    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.size).toBe(handlesBefore + 1);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
  });
});
