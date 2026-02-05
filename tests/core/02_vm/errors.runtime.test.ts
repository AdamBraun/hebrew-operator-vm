import { describe, expect, it } from "vitest";
import { RuntimeError } from "@ref/vm/errors";
import { contReachable } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("runtime errors", () => {
  it("final mem with non-mem obligation does not throw", () => {
    expect(() => runProgram("נם", createInitialState())).not.toThrow(RuntimeError);
  });

  it("dalet does not depend on boundary obligations", () => {
    const state = runProgram("נד", createInitialState());
    expect(state.boundaries.length).toBe(1);
  });

  it("cont reachability on missing nodes returns false", () => {
    const state = createInitialState();
    expect(contReachable(state, "missing", "also-missing")).toBe(false);
  });
});
