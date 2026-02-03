import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("nun behavior", () => {
  it("נ creates succ handle and pushes SUPPORT obligation", () => {
    const state = runProgram("נ", createInitialState());
    const supportEvents = state.vm.H.filter((event) => event.type === "fall");
    expect(supportEvents.length).toBe(1);
    const succ = supportEvents[0].data.child as string;
    const handle = state.handles.get(succ);
    expect(handle?.meta.succOf).toBe("Ω");
  });

  it("ן discharges immediately and locks succ", () => {
    const state = runProgram("ן", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const focus = state.handles.get(state.vm.F);
    expect(focus?.policy).toBe("framed_lock");
  });
});
