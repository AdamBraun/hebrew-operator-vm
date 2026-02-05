import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { kafOp } from "@ref/letters/kaf";
import { finalKafOp } from "@ref/letters/finalKaf";

describe("kaf behavior", () => {
  it("creates portion and residue handles", () => {
    const state = createInitialState();
    const target = "target";
    const template = "template";
    state.handles.set(target, createHandle(target, "scope"));
    state.handles.set(template, createHandle(template, "scope"));

    const { cons } = kafOp.bound(state, { args: [target, template], prefs: {} });
    const { h, r } = kafOp.seal(state, cons);

    const portion = state.handles.get(h);
    const residue = state.handles.get(r);
    expect(portion?.meta.unitized).toBe(1);
    expect(residue?.meta.residueOf).toBe(target);
  });

  it("final kaf locks the portion handle", () => {
    const state = createInitialState();
    const target = "target";
    const template = "template";
    state.handles.set(target, createHandle(target, "scope"));
    state.handles.set(template, createHandle(template, "scope"));

    const { cons } = finalKafOp.bound(state, { args: [target, template], prefs: {} });
    const { h } = finalKafOp.seal(state, cons);
    const portion = state.handles.get(h);
    expect(portion?.policy).toBe("framed_lock");
  });
});
