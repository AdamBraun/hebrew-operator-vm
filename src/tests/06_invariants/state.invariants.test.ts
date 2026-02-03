import { describe, expect, it } from "vitest";
import { assertStateInvariants } from "../../state/invariants";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("state invariants", () => {
  it("holds after a few representative programs", () => {
    const programs = ["", "נ", "נס", "נ ס", "מ", "מם", "מ ם", "ן", "בד", "ג", "ה"];
    for (const program of programs) {
      const state = runProgram(program, createInitialState());
      expect(() => assertStateInvariants(state)).not.toThrow();
    }
  });

  it("OStack_word empty after final boundary", () => {
    const state = runProgram("נ", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
  });
});
