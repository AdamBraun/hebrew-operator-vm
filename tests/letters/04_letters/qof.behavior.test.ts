import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { qofOp } from "@ref/letters/qof";

describe("qof behavior", () => {
  it("creates an approx handle and approx links", () => {
    const state = createInitialState();
    const left = "left";
    const right = "right";
    state.handles.set(left, createHandle(left, "scope"));
    state.handles.set(right, createHandle(right, "scope"));

    const { cons } = qofOp.bound(state, { args: [left, right], prefs: {} });
    const { h } = qofOp.seal(state, cons);

    const approxHandle = state.handles.get(h);
    expect(approxHandle?.kind).toBe("alias");
    expect(approxHandle?.meta.approx).toBe(true);
    expect(state.links.some((link) => link.label === "approx")).toBe(true);
  });
});
