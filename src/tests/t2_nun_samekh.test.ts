import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/state";
import { runProgram } from "../vm/vm";

describe("T2 nun stabilized by samekh", () => {
  it("does not fall and stabilizes focus", () => {
    const state = runProgram("נס", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const focus = state.handles.get(state.vm.F);
    expect(focus?.policy).toBe("framed_lock");
  });

  it("falls when a boundary is inserted between letters", () => {
    const state = runProgram("נ ס", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(1);
  });
});
