import { describe, expect, it } from "vitest";
import { OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T1 nun falls at boundary", () => {
  it("logs fall and restores focus", () => {
    const state = runProgram("נ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(1);
    const child = falls[0].data.child as string;
    expect(state.vm.R).toBe(child);
    expect(state.vm.F).toBe(OMEGA_ID);
  });
});
