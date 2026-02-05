import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("dalet behavior", () => {
  it("creates an anchored boundary handle", () => {
    const state = runProgram("ד", createInitialState());
    const closeEvent = state.vm.H.find((event) => event.type === "boundary_close");
    expect(closeEvent).toBeDefined();
    expect(state.boundaries.length).toBe(1);
    const boundaryHandle = state.handles.get(state.boundaries[0].id);
    expect(boundaryHandle?.anchor).toBe(1);
    expect(boundaryHandle?.meta.closedBy).toBe("ד");
  });
});
