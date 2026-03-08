import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T3 final nun", () => {
  it("does not fall, advances focus, and creates a zayin-style resolved carry cycle", () => {
    const state = runProgram("ן", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const focus = state.handles.get(wordOut);
    const parent = String(focus?.meta.succOf ?? "");
    expect(state.cont.has(`${parent}->${wordOut}`)).toBe(true);
    expect(state.carry.has(`${parent}->${wordOut}`)).toBe(true);
    expect(state.supp.has(`${wordOut}->${parent}`)).toBe(true);
    expect(focus?.edge_mode).toBe("committed");
    expect(focus?.envelope.data_flow).toBe("SNAPSHOT");
    expect(focus?.envelope.edit_flow).toBe("TIGHT");
    expect(focus?.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(focus?.envelope.coupling).toBe("CopyNoBacklink");
    expect(focus?.policy).toBe("soft");
  });
});
