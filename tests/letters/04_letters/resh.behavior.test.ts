import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("resh behavior", () => {
  it("creates an unanchored boundary handle", () => {
    const state = runProgram("ר", createInitialState());
    expect(state.boundaries.length).toBe(1);
    const boundaryHandle = state.handles.get(state.boundaries[0].id);
    expect(boundaryHandle?.anchor).toBe(0);
    expect(boundaryHandle?.meta.closedBy).toBe("ר");
  });
});
