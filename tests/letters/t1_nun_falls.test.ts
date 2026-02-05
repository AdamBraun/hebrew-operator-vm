import { describe, expect, it } from "vitest";
import { BOT_ID, OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T1 nun falls at boundary", () => {
  it("logs fall and restores focus", () => {
    const state = runProgram("נ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(1);
    const child = falls[0].data.child as string;
    expect(state.vm.F).toBe(OMEGA_ID);
    expect(state.vm.R).toBe(BOT_ID);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(OMEGA_ID);
    expect(child).toBeDefined();
  });
});
