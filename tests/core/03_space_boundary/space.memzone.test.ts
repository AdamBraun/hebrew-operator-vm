import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("space boundary mem enclosure resolution", () => {
  it("mem followed by boundary closes the open enclosure silently", () => {
    const state = runProgram("מ", createInitialState());
    expect(state.boundaries).toHaveLength(1);
    expect(state.boundaries[0]).toMatchObject({
      kind: "mem_enclosure",
      open: false,
      closed: true,
      close_mode: "word_boundary",
      closed_by: "hard"
    });
    expect(state.vm.OStack_word.length).toBe(0);
  });

  it("mem + final mem exports the sealed successor before boundary", () => {
    const state = runProgram("מם", createInitialState());
    const sealed = Array.from(state.handles.entries()).filter(
      ([, handle]) => handle.meta?.sealedFrom
    );
    expect(sealed.length).toBe(1);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(sealed[0][0]);
    expect(Array.from(state.carry)).toEqual([]);
    expect(state.boundaries[0]?.closed).toBe(true);
    expect(state.vm.OStack_word.length).toBe(0);
  });

  it("mem boundary then final mem closes only the new word's synthetic enclosure", () => {
    const state = runProgram("מ ם", createInitialState());
    const sealed = Array.from(state.handles.entries()).filter(
      ([, handle]) => handle.meta?.sealedFrom
    );
    expect(sealed.length).toBe(1);
    expect(state.boundaries).toHaveLength(2);
    expect(state.boundaries[0]?.close_mode).toBe("word_boundary");
    expect(state.boundaries[1]?.close_mode).toBe("synthetic");
    expect(Array.from(state.carry)).toEqual([]);
    expect(state.vm.OStack_word.length).toBe(0);
  });
});
