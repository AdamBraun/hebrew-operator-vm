import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("space boundary MEM_ZONE resolution", () => {
  it("mem followed by boundary closes silently", () => {
    const state = runProgram("מ", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(0);
    expect(state.vm.OStack_word.length).toBe(0);
  });

  it("mem + final mem exports handle before boundary", () => {
    const state = runProgram("מם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(1);
    expect(state.vm.F).toBe(memHandles[0].id);
    expect(state.vm.OStack_word.length).toBe(0);
  });

  it("mem boundary then final mem does not export from previous word", () => {
    const state = runProgram("מ ם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(1);
    expect(state.vm.OStack_word.length).toBe(0);
  });
});
