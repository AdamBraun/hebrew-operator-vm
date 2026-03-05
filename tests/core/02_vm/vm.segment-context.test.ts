import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithDeepTrace } from "@ref/vm/vm";

type WordStartPayload = {
  F0?: string;
  C0?: string;
  prevBoundaryMode?: string;
  segmentIdAfter?: number;
  segmentReset?: boolean;
  segmentId?: number;
  segmentOStackLength?: number;
};

type BoundaryPayload = {
  mode?: string;
  beforeFocus?: string;
  afterFocus?: string;
  segmentIdBefore?: number;
};

function collectWordStarts(input: string): WordStartPayload[] {
  const state = runProgram(input, createInitialState());
  return state.vm.H.filter((event) => event.type === "WORD_START").map(
    (event) => (event.data ?? {}) as WordStartPayload
  );
}

function collectBoundaries(input: string): BoundaryPayload[] {
  const state = runProgram(input, createInitialState());
  return state.vm.H.filter((event) => event.type === "BOUNDARY").map(
    (event) => (event.data ?? {}) as BoundaryPayload
  );
}

describe("vm segment context", () => {
  it("passes GLUE boundary mode into beginWord for the next word", () => {
    const starts = collectWordStarts("נ֣ ס");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("glue");
    expect(starts[1]?.segmentReset).toBe(false);
    expect(typeof starts[1]?.F0).toBe("string");
    expect(typeof starts[1]?.C0).toBe("string");
  });

  it("preserves segment stack identity across GLUE at the next word start", () => {
    const starts = collectWordStarts("נ֣ א");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("glue");
    expect(starts[1]?.segmentReset).toBe(false);
    expect(typeof starts[1]?.segmentOStackLength).toBe("number");
  });

  it("starts the next word with an empty segment OStack after HARD", () => {
    const starts = collectWordStarts("נ א");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prevBoundaryMode).toBe("hard");
    expect(starts[1]?.segmentReset).toBe(true);
    expect(starts[1]?.segmentOStackLength).toBe(0);
  });

  it("keeps segment id across glue and advances across hard boundaries", () => {
    const glueStarts = collectWordStarts("נ֣ ס");
    expect(glueStarts[0]?.segmentId).toBe(glueStarts[1]?.segmentId);
    expect(glueStarts[0]?.segmentIdAfter).toBe(glueStarts[1]?.segmentIdAfter);

    const hardStarts = collectWordStarts("נ ס");
    expect(hardStarts).toHaveLength(2);
    expect(hardStarts[0]?.segmentId).not.toBe(hardStarts[1]?.segmentId);
    expect((hardStarts[1]?.segmentIdAfter ?? 0) > (hardStarts[0]?.segmentIdAfter ?? 0)).toBe(true);
  });

  it("emits BOUNDARY telemetry with focus transition and segmentIdBefore", () => {
    const boundaries = collectBoundaries("נ֣ ס");
    const glueBoundary = boundaries.find((event) => event.mode === "glue");
    expect(glueBoundary).toBeDefined();
    expect(typeof glueBoundary?.beforeFocus).toBe("string");
    expect(typeof glueBoundary?.afterFocus).toBe("string");
    expect(typeof glueBoundary?.segmentIdBefore).toBe("number");
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
