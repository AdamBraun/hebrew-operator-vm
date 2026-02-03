import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("mem behavior", () => {
  it("ם with no MEM_ZONE opens+closes immediately", () => {
    const state = runProgram("ם", createInitialState());
    const memHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memHandle"
    );
    expect(memHandles.length).toBe(1);
    expect(state.vm.F).toBe(memHandles[0].id);
  });
});
