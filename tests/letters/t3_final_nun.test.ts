import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T3 final nun", () => {
  it("does not fall and locks focus", () => {
    const state = runProgram("ן", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const focus = state.handles.get(state.vm.F);
    expect(focus?.policy).toBe("framed_lock");
  });
});
