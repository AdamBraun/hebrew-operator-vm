import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("dalet behavior", () => {
  it("closes a boundary when none is open", () => {
    const state = runProgram("ד", createInitialState());
    const closeEvent = state.vm.H.find((event) => event.type === "boundary_close");
    expect(closeEvent).toBeDefined();
    expect(state.boundaries.length).toBe(1);
  });
});
