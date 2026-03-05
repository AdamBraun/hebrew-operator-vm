import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("nun behavior", () => {
  it("נ creates succ handle with matching cont/carry edges and pushes SUPPORT obligation", () => {
    const state = runProgram("נ", createInitialState());
    const supportEvents = state.vm.H.filter((event) => event.type === "fall");
    expect(supportEvents.length).toBe(1);
    const succ = supportEvents[0].data.child as string;
    const parent = supportEvents[0].data.parent as string;
    const handle = state.handles.get(succ);
    expect(handle?.meta.succOf).toBe(parent);
    expect(state.cont.has(`${parent}->${succ}`)).toBe(true);
    expect(state.carry.has(`${parent}->${succ}`)).toBe(true);
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
