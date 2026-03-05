import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("nun behavior", () => {
  it("נ creates succ handle with matching cont/carry edges and no fall", () => {
    const state = runProgram("נ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const succ = String(state.vm.A[state.vm.A.length - 1] ?? "");
    const handle = state.handles.get(succ);
    const parent = String(handle?.meta.succOf ?? "");
    expect(parent.length).toBeGreaterThan(0);
    expect(state.cont.has(`${parent}->${succ}`)).toBe(true);
    expect(state.carry.has(`${parent}->${succ}`)).toBe(true);
    expect(state.vm.OStack_word.length).toBe(0);
  });

  it("ן discharges immediately and locks succ", () => {
    const state = runProgram("ן", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const focus = state.handles.get(wordOut);
    const parent = String(focus?.meta.succOf ?? "");
    expect(state.cont.has(`${parent}->${wordOut}`)).toBe(true);
    expect(state.carry.has(`${parent}->${wordOut}`)).toBe(true);
    expect(focus?.policy).toBe("framed_lock");
  });
});
