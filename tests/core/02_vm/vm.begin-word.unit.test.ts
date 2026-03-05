import { describe, expect, it } from "vitest";
import { BOT_ID, OMEGA_ID } from "@ref/state/handles";
import type { Obligation } from "@ref/state/state";
import { createInitialState } from "@ref/state/state";
import { beginWordForTest } from "@ref/vm/vm";

function someObligation(): Obligation {
  return {
    kind: "MEM_ZONE",
    parent: OMEGA_ID,
    child: BOT_ID,
    payload: { tag: "SomeObligation" },
    tau_created: 0
  };
}

describe("beginWord unit behavior", () => {
  it("GLUE carries obligations", () => {
    const state = createInitialState();
    const obligation = someObligation();
    state.vm.segment.OStack.push(obligation);
    const segmentIdBefore = state.vm.segment.segmentId;

    beginWordForTest(state, {
      wordText: "word2",
      prevBoundaryMode: "glue",
      inboundFocusF0: state.vm.F
    });

    expect(state.vm.segment.segmentId).toBe(segmentIdBefore);
    expect(state.vm.segment.OStack).toHaveLength(1);
    expect(state.vm.segment.OStack[0]).toBe(obligation);
    expect(state.vm.H.every((event) => event.type === "WORD_START")).toBe(true);
  });

  it("HARD starts a new segment", () => {
    const state = createInitialState();
    state.vm.segment.OStack.push(someObligation());
    const segmentIdBefore = state.vm.segment.segmentId;

    beginWordForTest(state, {
      wordText: "word2",
      prevBoundaryMode: "hard",
      inboundFocusF0: state.vm.F
    });

    expect(state.vm.segment.segmentId).toBe(segmentIdBefore + 1);
    expect(state.vm.segment.OStack).toEqual([]);
    expect(state.vm.OStack_word).toBe(state.vm.segment.OStack);
    expect(state.vm.H.every((event) => event.type === "WORD_START")).toBe(true);
  });

  it("always resets word-local buffers", () => {
    const state = createInitialState();
    (state.vm as unknown as { word: any }).word = {
      text: "old",
      exports: ["x"],
      snapshots: ["y"],
      localCounters: { count: 9 }
    };

    beginWordForTest(state, {
      wordText: "new",
      prevBoundaryMode: "glue",
      inboundFocusF0: state.vm.F
    });

    const word = (state.vm as unknown as { word: any }).word;
    expect(word.text).toBe("new");
    expect(word.exports).toEqual([]);
    expect(word.snapshots).toEqual([]);
    expect(word.localCounters).toEqual({});
    expect(state.vm.H.every((event) => event.type === "WORD_START")).toBe(true);
  });
});
