import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { tsadiOp } from "@ref/letters/tsadi";

describe("tsadi behavior", () => {
  it("creates an aligned handle and logs alignment", () => {
    const state = createInitialState();
    const focus = "focus";
    const exemplar = "exemplar";
    state.handles.set(focus, createHandle(focus, "scope"));
    state.handles.set(exemplar, createHandle(exemplar, "scope"));

    const { cons } = tsadiOp.bound(state, { args: [focus, exemplar], prefs: {} });
    const { h } = tsadiOp.seal(state, cons);

    const aligned = state.handles.get(h);
    expect(aligned?.meta.aligned).toBe(1);
    expect(state.links.some((link) => link.label === "align")).toBe(true);
    expect(state.vm.H.some((event) => event.type === "align")).toBe(true);
  });
});
