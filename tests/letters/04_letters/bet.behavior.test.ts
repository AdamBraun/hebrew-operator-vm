import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("bet behavior", () => {
  it("creates an inside-boundary and updates ambient world", () => {
    const state = runProgram("ב", createInitialState());
    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);
    expect(boundaryHandle?.meta.openedBy).toBe("ב");
    expect(state.vm.Omega).toBe(boundary.id);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(boundary.id);
  });
});
