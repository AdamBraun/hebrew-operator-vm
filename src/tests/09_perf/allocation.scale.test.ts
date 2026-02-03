import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("performance: allocation sanity", () => {
  it("nun allocations scale linearly", () => {
    const program = "נ".repeat(50);
    const state = runProgram(program, createInitialState());
    const nunHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.meta?.succOf !== undefined
    );
    expect(nunHandles.length).toBe(50);
  });
});
