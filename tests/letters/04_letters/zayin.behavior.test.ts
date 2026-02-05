import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { zayinOp } from "@ref/letters/zayin";

describe("zayin behavior", () => {
  it("creates a gate handle and logs a gate event", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = zayinOp.bound(state, { args: [target], prefs: {} });
    const { h } = zayinOp.seal(state, cons);

    const gate = state.handles.get(h);
    expect(gate?.kind).toBe("gate");
    expect(gate?.meta.target).toBe(target);
    expect(state.links.some((link) => link.label === "gate")).toBe(true);
    expect(state.vm.H.some((event) => event.type === "gate")).toBe(true);
  });
});
