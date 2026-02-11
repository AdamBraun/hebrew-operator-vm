import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("he behavior", () => {
  it("seals a public rule handle when non-final", () => {
    const state = runProgram("הא", createInitialState());
    const rules = Array.from(state.handles.values()).filter((handle) => handle.kind === "rule");
    expect(rules.length).toBe(1);
    expect(rules[0].meta.public).toBe(1);
  });

  it("final he without mappiq shades the tail and creates no new rule", () => {
    const state = runProgram("אה", createInitialState());
    const rules = Array.from(state.handles.values()).filter((handle) => handle.kind === "rule");
    expect(rules.length).toBe(0);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const output = state.handles.get(wordOut);
    expect(output?.meta.he_mode).toBe("breath");
    expect(output?.meta.final_tail).toBe("breath");
  });
});
