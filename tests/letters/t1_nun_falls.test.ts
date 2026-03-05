import { describe, expect, it } from "vitest";
import { BOT_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T1 nun unresolved carry", () => {
  it("threads forward with cont+carry and no fall", () => {
    const state = runProgram("נ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const child = String(state.vm.A[state.vm.A.length - 1] ?? "");
    const parent = String(state.handles.get(child)?.meta.succOf ?? "");
    expect(parent.length).toBeGreaterThan(0);
    expect(state.vm.R).toBe(BOT_ID);
    expect(state.cont.has(`${parent}->${child}`)).toBe(true);
    expect(state.carry.has(`${parent}->${child}`)).toBe(true);
  });
});
