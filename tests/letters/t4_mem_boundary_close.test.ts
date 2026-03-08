import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("T4 mem closes silently at boundary", () => {
  it("does not export an extra close handle and leaves a closed enclosure record", () => {
    const state = runProgram("מ", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    const sealed = Array.from(state.handles.values()).filter((handle) => handle.meta?.sealedFrom);
    expect(sealed.length).toBe(0);
    expect(state.boundaries).toHaveLength(1);
    expect(state.boundaries[0]).toMatchObject({
      kind: "mem_enclosure",
      open: false,
      closed: true,
      close_mode: "word_boundary",
      closed_by: "hard"
    });
  });
});
