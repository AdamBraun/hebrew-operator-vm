import { describe, expect, it } from "vitest";
import { vavOp } from "@ref/letters/vav";
import { BOT_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

describe("vav contract", () => {
  it("meta is well-formed", () => {
    expect(vavOp.meta.arity_req).toBe(1);
    expect(vavOp.meta.arity_req).toBeTypeOf("number");
    expect(vavOp.meta.arity_opt).toBeTypeOf("number");
    expect(vavOp.meta.distinct_required).toBeTypeOf("boolean");
    expect(vavOp.meta.distinct_optional).toBeTypeOf("boolean");
    expect(vavOp.meta.reflexive_ok).toBeTypeOf("boolean");
  });

  it("allocates exactly one successor and only a cont edge", () => {
    const state = createInitialState();
    const startFocus = state.vm.F;
    const initialHandleCount = state.handles.size;
    const { cons } = vavOp.bound(state, { args: [startFocus], prefs: {} });
    const { h, r } = vavOp.seal(state, cons);

    expect(state.handles.has(h)).toBe(true);
    expect(state.handles.size).toBe(initialHandleCount + 1);
    expect(state.cont).toEqual(new Set([`${startFocus}->${h}`]));
    expect(state.carry.size).toBe(0);
    expect(state.supp.size).toBe(0);
    expect(state.links).toEqual([]);
    expect(r).toBe(BOT_ID);
  });
});
