import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("he behavior", () => {
  it("seals a final artifact", () => {
    const state = runProgram("ה", createInitialState());
    const artifacts = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "artifact"
    );
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].policy).toBe("final");
  });
});
