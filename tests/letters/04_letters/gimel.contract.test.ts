import { describe, expect, it } from "vitest";
import { gimelOp } from "@ref/letters/gimel";
import { createInitialState } from "@ref/state/state";

describe("gimel contract", () => {
  it("meta is well-formed", () => {
    expect(gimelOp.meta.arity_req).toBe(1);
    expect(gimelOp.meta.arity_req).toBeTypeOf("number");
    expect(gimelOp.meta.arity_opt).toBeTypeOf("number");
    expect(gimelOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(gimelOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(gimelOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("allocates a shoulder and successor without referencing invalid handles", () => {
    const state = createInitialState();
    const initialHandleIds = new Set(state.handles.keys());
    const { cons } = gimelOp.bound(state, {
      args: [state.vm.F],
      prefs: {}
    });
    const { h, r } = gimelOp.seal(state, cons);
    const newHandleIds = Array.from(state.handles.keys()).filter((id) => !initialHandleIds.has(id));

    expect(newHandleIds).toHaveLength(2);
    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.has(r) || r === "⊥").toBe(true);
    expect(state.cont.size).toBe(2);
    expect(state.carry.size).toBe(1);
    expect(state.links).toEqual([]);
  });
});
