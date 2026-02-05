import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { alephOp } from "@ref/letters/aleph";

describe("aleph behavior", () => {
  it("creates an alias handle and transport links", () => {
    const state = createInitialState();
    const left = "left";
    const right = "right";
    state.handles.set(left, createHandle(left, "scope"));
    state.handles.set(right, createHandle(right, "scope"));

    const { cons } = alephOp.bound(state, { args: [left, right], prefs: {} });
    const { h } = alephOp.seal(state, cons);

    const aliasHandle = state.handles.get(h);
    expect(aliasHandle?.kind).toBe("alias");
    expect(aliasHandle?.meta.left).toBe(left);
    expect(aliasHandle?.meta.right).toBe(right);
    expect(state.links.some((link) => link.label === "transport")).toBe(true);
  });
});
