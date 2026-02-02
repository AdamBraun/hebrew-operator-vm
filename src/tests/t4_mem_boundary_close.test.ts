import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/state";
import { runProgram } from "../vm/vm";

describe("T4 mem closes silently at boundary", () => {
  it("does not export a mem handle", () => {
    const state = runProgram("מ", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(0);
    const zones = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memZone"
    );
    expect(zones.length).toBe(1);
    expect(zones[0].meta.closed).toBe(1);
  });
});
