import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "../state/state";
import { runProgram } from "../vm/vm";

describe("determinism", () => {
  it("produces identical states for identical input", () => {
    const program = "נס";
    const stateA = runProgram(program, createInitialState());
    const stateB = runProgram(program, createInitialState());
    expect(serializeState(stateA)).toEqual(serializeState(stateB));
  });
});
