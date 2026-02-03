import { describe, expect, it } from "vitest";
import { BOT_ID, OMEGA_ID } from "../../state/handles";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("vm event log", () => {
  it("event tau values are nondecreasing", () => {
    const state = runProgram("נ ס", createInitialState());
    const taus = state.vm.H.map((event) => event.tau);
    const sorted = [...taus].sort((a, b) => a - b);
    expect(taus).toEqual(sorted);
  });

  it("events refer to existing handle ids", () => {
    const state = runProgram("נ ס", createInitialState());
    const ids = new Set(state.handles.keys());
    ids.add(BOT_ID);
    ids.add(OMEGA_ID);

    for (const event of state.vm.H) {
      if (event.data?.child) {
        expect(ids.has(event.data.child)).toBe(true);
      }
      if (event.data?.parent) {
        expect(ids.has(event.data.parent)).toBe(true);
      }
    }
  });
});
