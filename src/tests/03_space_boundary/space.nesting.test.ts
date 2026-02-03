import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("space boundary nesting", () => {
  it("multiple nun obligations resolve LIFO", () => {
    const state = runProgram("ננ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(2);
    expect(falls[0].data.child).toBe("נ:1:2");
    expect(falls[1].data.child).toBe("נ:1:1");
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
