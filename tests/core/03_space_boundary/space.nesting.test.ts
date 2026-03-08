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
    const sealed = Array.from(state.handles.values()).filter((handle) => handle.meta?.sealedFrom);
    expect(sealed.length).toBe(2);
    const closedMemBoundaries = state.boundaries.filter(
      (boundary) => boundary.kind === "mem_enclosure" && boundary.closed
    );
    expect(closedMemBoundaries.length).toBe(2);
    expect(closedMemBoundaries[0].closed_at_tau).toBeLessThanOrEqual(
      closedMemBoundaries[1].closed_at_tau ?? Number.MAX_SAFE_INTEGER
    );
    expect(state.vm.OStack_word.length).toBe(0);
  });
});
