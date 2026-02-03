import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("performance: step growth", () => {
  it("tau increments only on boundary tokens", () => {
    const program = "נ".repeat(10);
    const state = runProgram(program, createInitialState());
    expect(state.vm.tau).toBe(2);
  });

  it("runs on larger input without throwing", () => {
    const program = "נ".repeat(1000);
    const state = runProgram(program, createInitialState());
    expect(state.vm.tau).toBe(2);
  });
});
