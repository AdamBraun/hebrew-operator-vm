import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { tetOp } from "@ref/letters/tet";

describe("tet behavior", () => {
  it("creates a covert proxy handle", () => {
    const state = createInitialState();
    const target = "target";
    const patch = "patch";
    state.handles.set(target, createHandle(target, "scope"));
    state.handles.set(patch, createHandle(patch, "scope"));

    const { cons } = tetOp.bound(state, { args: [target, patch], prefs: {} });
    const { h } = tetOp.seal(state, cons);

    const port = state.handles.get(h);
    expect(port?.kind).toBe("gate");
    expect(port?.meta.target).toBe(target);
    expect(port?.meta.patch).toBe(patch);
    expect(port?.meta.hidden).toBe(1);
    expect(state.vm.H.some((event) => event.type === "covert")).toBe(true);
  });
});
