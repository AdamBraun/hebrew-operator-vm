import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("he behavior", () => {
  it("seals a public rule handle", () => {
    const state = runProgram("ה", createInitialState());
    const rules = Array.from(state.handles.values()).filter((handle) => handle.kind === "rule");
    expect(rules.length).toBe(1);
    expect(rules[0].meta.public).toBe(1);
  });
});
