import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("shuruk carrier activation", () => {
  it("vav + shuruk sets carrier_mode and rep_flag", () => {
    const state = runProgram("וּ", createInitialState());
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(wordOut);
    expect(handle?.meta.carrier_mode).toBe("seeded");
    expect(handle?.meta.rep_flag).toBe(1);
  });

  it("vav without dot does not set carrier_mode", () => {
    const state = runProgram("ו", createInitialState());
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const handle = state.handles.get(wordOut);
    expect(handle?.meta.carrier_mode).toBeUndefined();
    expect(handle?.meta.rep_flag).toBeUndefined();
  });

  it("dagesh on non-vav does not set carrier_mode", () => {
    const state = runProgram("בּ", createInitialState());
    const handle = Array.from(state.handles.values()).find(
      (entry) => entry.meta?.openedBy === "ב"
    );
    expect(handle?.meta.carrier_mode).toBeUndefined();
    expect(handle?.meta.rep_flag).toBeUndefined();
  });
});
