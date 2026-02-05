import { describe, expect, it } from "vitest";
import { runProgram } from "@ref/vm/vm";

describe("shin behavior", () => {
  it("activates the right branch for shin-dot right", () => {
    const state = runProgram("שׁ");
    const shinId = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(shinId);
    expect(handle?.meta.active).toBe("right");
    expect(state.handles.has(handle?.meta.left)).toBe(true);
    expect(state.handles.has(handle?.meta.right)).toBe(true);
    expect(state.handles.has(handle?.meta.spine)).toBe(true);
  });

  it("activates the left branch for shin-dot left", () => {
    const state = runProgram("שׂ");
    const shinId = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(shinId);
    expect(handle?.meta.active).toBe("left");
  });
});
