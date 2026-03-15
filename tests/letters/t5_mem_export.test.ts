import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T5 final mem exports handle", () => {
  it("exports the sealed successor before boundary", () => {
    const state = runProgram("מם", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    const sealed = Array.from(state.handles.entries()).filter(
      ([, handle]) => handle.meta?.sealedFrom
    );
    expect(sealed.length).toBe(1);
    const [sealedId, sealedHandle] = sealed[0];
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(sealedId);
    expect(sealedHandle.meta.boundaryId).toBeDefined();
    expect(Array.from(state.carry).filter((edge) => edge.endsWith(`->${sealedId}`))).toEqual([]);
  });

  it("allows final mem with unrelated obligations", () => {
    const state = runProgram("נם", createInitialState());
    const sealed = Array.from(state.handles.entries()).filter(
      ([, handle]) => handle.meta?.sealedFrom
    );
    expect(sealed.length).toBeGreaterThan(0);
    expect(
      state.boundaries.some(
        (boundary) => boundary.kind === "mem_enclosure" && boundary.close_mode === "synthetic"
      )
    );
    const [sealedId] = sealed[0];
    expect(Array.from(state.carry).filter((edge) => edge.endsWith(`->${sealedId}`))).toEqual([]);
    expect(state.vm.H.some((event) => event.type === "fall")).toBe(false);
  });
});
