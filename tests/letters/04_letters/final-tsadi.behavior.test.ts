import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { finalTsadiOp } from "@ref/letters/finalTsadi";

describe("final tsadi behavior", () => {
  it("creates a final aligned artifact", () => {
    const state = createInitialState();
    const focus = "focus";
    const exemplar = "exemplar";
    state.handles.set(focus, createHandle(focus, "scope"));
    state.handles.set(exemplar, createHandle(exemplar, "scope"));

    const { cons } = finalTsadiOp.bound(state, { args: [focus, exemplar], prefs: {} });
    const { h } = finalTsadiOp.seal(state, cons);

    const aligned = state.handles.get(h);
    expect(aligned?.kind).toBe("artifact");
    expect(aligned?.policy).toBe("final");
    expect(state.vm.H.some((event) => event.type === "align_final")).toBe(true);
  });
});
