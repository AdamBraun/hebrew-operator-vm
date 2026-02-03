import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("shuruk carrier activation", () => {
  it("vav + shuruk sets carrier_active", () => {
    const state = runProgram("וּ", createInitialState());
    const handle = state.handles.get(state.vm.F);
    expect(handle?.meta.carrier_active).toBe(true);
  });

  it("vav without dot does not set carrier_active", () => {
    const state = runProgram("ו", createInitialState());
    const handle = state.handles.get(state.vm.F);
    expect(handle?.meta.carrier_active).toBeUndefined();
  });

  it("dagesh on non-vav does not set carrier_active", () => {
    const state = runProgram("בּ", createInitialState());
    const handle = state.handles.get(state.vm.F);
    expect(handle?.meta.carrier_active).toBeUndefined();
  });
});
