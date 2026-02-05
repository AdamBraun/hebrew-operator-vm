import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T5 final mem exports handle", () => {
  it("exports mem handle before boundary", () => {
    const state = runProgram("מם", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    const memHandles = Array.from(state.handles.entries()).filter(
      ([, handle]) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(1);
    const [memHandleId, memHandle] = memHandles[0];
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(memHandleId);
    expect(memHandle.meta.zone).toBeDefined();
  });

  it("allows final mem with unrelated obligations", () => {
    const state = runProgram("נם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBeGreaterThan(0);
    expect(state.vm.H.some((event) => event.type === "fall")).toBe(true);
  });
});
