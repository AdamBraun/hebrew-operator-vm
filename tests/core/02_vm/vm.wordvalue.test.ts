import { describe, expect, it } from "vitest";
import { BOT_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("phrase accumulator", () => {
  it("records empty leading/trailing words for empty input", () => {
    const state = runProgram("", createInitialState());
    expect(state.vm.A).toEqual([BOT_ID, BOT_ID]);
  });

  it("exports the word output at boundary", () => {
    const state = runProgram("מם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(1);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(memHandles[0].id);
  });
});
