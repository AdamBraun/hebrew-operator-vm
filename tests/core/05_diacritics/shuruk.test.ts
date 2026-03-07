import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("shuruk runtime behavior", () => {
  it("vav + shuruk stays a plain continuation at runtime", () => {
    const state = runProgram("וּ", createInitialState());
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(wordOut);
    expect(handle?.meta.carrier_mode).toBeUndefined();
    expect(handle?.meta.rep_flag).toBeUndefined();
    expect(state.cont.size).toBe(1);
    expect(Array.from(state.cont)[0]?.endsWith(`->${wordOut}`)).toBe(true);
    expect(state.carry.size).toBe(0);
    expect(state.supp.size).toBe(0);
    expect(state.links).toEqual([]);
  });

  it("dagesh on non-vav does not set carrier_mode", () => {
    const state = runProgram("בּ", createInitialState());
    const handle = Array.from(state.handles.values()).find((entry) => entry.meta?.openedBy === "ב");
    expect(handle?.meta.carrier_mode).toBeUndefined();
    expect(handle?.meta.rep_flag).toBeUndefined();
  });
});
