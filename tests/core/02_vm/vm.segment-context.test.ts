import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithDeepTrace } from "@ref/vm/vm";

type WordStartPayload = {
  prevBoundaryMode?: string;
  segmentId?: number;
  segmentOStackLength?: number;
};

function collectWordStarts(input: string): WordStartPayload[] {
  const state = runProgram(input, createInitialState());
  return state.vm.H.filter((event) => event.type === "WORD_START").map(
    (event) => (event.data ?? {}) as WordStartPayload
  );
}

describe("vm segment context", () => {
  it("passes GLUE boundary mode into beginWord for the next word", () => {
    const starts = collectWordStarts("נ֣ ס");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("glue");
  });

  it("preserves segment obligations across GLUE at the next word start", () => {
    const starts = collectWordStarts("נ֣ א");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("glue");
    expect((starts[1]?.segmentOStackLength ?? 0) > 0).toBe(true);
  });

  it("starts the next word with an empty segment OStack after HARD", () => {
    const starts = collectWordStarts("נ א");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("hard");
    expect(starts[1]?.segmentOStackLength).toBe(0);
  });

  it("keeps segment id across glue and advances across hard boundaries", () => {
    const glueStarts = collectWordStarts("נ֣ ס");
    expect(glueStarts[0]?.segmentId).toBe(glueStarts[1]?.segmentId);

    const hardStarts = collectWordStarts("נ ס");
    expect(hardStarts).toHaveLength(2);
    expect(hardStarts[0]?.segmentId).not.toBe(hardStarts[1]?.segmentId);
  });

  it("exposes vm.segment in word execution context", () => {
    const { state, deepTrace } = runProgramWithDeepTrace("א", createInitialState(), {
      includeStateSnapshots: false
    });
    const context = deepTrace
      .find((entry) => entry.token === "א")
      ?.phases.find((phase) => phase.phase === "word_entry_context")?.detail as
      | { segment_id?: number; prev_boundary_mode?: string }
      | undefined;

    expect(context?.segment_id).toBe(1);
    expect(context?.prev_boundary_mode).toBe("hard");
    expect(state.vm.segment.segmentId).toBe(1);
    expect(state.vm.segment.OStack).toBe(state.vm.OStack_word);
  });
});
