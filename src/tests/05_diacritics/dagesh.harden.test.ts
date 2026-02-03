import { describe, expect, it } from "vitest";
import { OMEGA_ID } from "../../state/handles";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("dagesh harden", () => {
  it("hardens the base handle when dagesh is present", () => {
    const state = runProgram("בּ", createInitialState());
    const omega = state.handles.get(OMEGA_ID);
    expect(omega?.policy).toBe("framed_lock");
  });

  it("does not harden without dagesh", () => {
    const state = runProgram("ב", createInitialState());
    const omega = state.handles.get(OMEGA_ID);
    expect(omega?.policy).toBe("soft");
  });
});
