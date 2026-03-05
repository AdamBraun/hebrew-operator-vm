import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T2 nun stabilized by samekh", () => {
  it("does not fall and resolves the carried witness by adding supp(F, source)", () => {
    const state = runProgram("נס", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const child = String(state.vm.A[state.vm.A.length - 1] ?? "");
    const parent = String(state.handles.get(child)?.meta?.succOf ?? "");
    expect(state.carry.has(`${parent}->${child}`)).toBe(true);
    expect(state.supp.has(`${child}->${parent}`)).toBe(true);
  });

  it("does not fall when a boundary is inserted between letters", () => {
    const state = runProgram("נ ס", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
  });
});
