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

  it("ן creates a directly supported committed successor without opening carry", () => {
    const state = runProgram("ן", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const focus = state.handles.get(wordOut);
    const contIntoFocus = Array.from(state.cont).find((edge) => edge.endsWith(`->${wordOut}`));
    const parent = contIntoFocus?.split("->")[0] ?? "";
    expect(parent.length).toBeGreaterThan(0);
    expect(state.cont.has(`${parent}->${wordOut}`)).toBe(true);
    expect(state.carry.has(`${parent}->${wordOut}`)).toBe(false);
    expect(state.supp.has(`${wordOut}->${parent}`)).toBe(true);
    expect(state.vm.OStack_word.length).toBe(0);
    expect(focus?.edge_mode).toBe("committed");
    expect(focus?.envelope.data_flow).toBe("SNAPSHOT");
    expect(focus?.envelope.edit_flow).toBe("TIGHT");
    expect(focus?.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(focus?.envelope.coupling).toBe("CopyNoBacklink");
    expect(focus?.policy).toBe("soft");
  });
});
