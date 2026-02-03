import { describe, expect, it } from "vitest";
import { RuntimeError } from "@ref/vm/errors";
import { contReachable } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("runtime errors", () => {
  it("final mem with non-mem obligation throws RuntimeError", () => {
    expect(() => runProgram("נם", createInitialState())).toThrow(RuntimeError);
  });

  it("dalet with non-boundary obligation throws RuntimeError", () => {
    expect(() => runProgram("נד", createInitialState())).toThrow(RuntimeError);
  });

  it("cont reachability on missing nodes returns false", () => {
    const state = createInitialState();
    expect(contReachable(state, "missing", "also-missing")).toBe(false);
  });
});
