import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("space boundary nesting", () => {
  it("multiple nun operators leave no fall obligations", () => {
    const state = runProgram("ננ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
  });

  it("nested mems close in LIFO order", () => {
    const state = runProgram("ממםם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(2);
    expect(state.vm.OStack_word.length).toBe(0);
  });
});
