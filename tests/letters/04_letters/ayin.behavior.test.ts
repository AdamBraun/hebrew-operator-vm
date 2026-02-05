import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("ayin behavior", () => {
  it("creates a watch handle and adds it to W", () => {
    const state = runProgram("ע", createInitialState());
    expect(state.vm.W.length).toBe(1);
    const watchId = state.vm.W[0];
    const watchHandle = state.handles.get(watchId);
    expect(watchHandle?.kind).toBe("watch");
  });
});
