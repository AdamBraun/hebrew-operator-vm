import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("bet behavior", () => {
  it("opens a boundary obligation and resolves at space", () => {
    const state = runProgram("ב", createInitialState());
    const autoClose = state.vm.H.find((event) => event.type === "boundary_auto_close");
    expect(autoClose).toBeDefined();
    expect(state.boundaries.length).toBe(1);
  });
});
