import { describe, expect, it } from "vitest";
import { extractCarrySemantics } from "@ref/scripts/summaryInsights/extractors/carrySemantics";
import type { Summary } from "@ref/scripts/summaryInsights/model";

function buildSummaryFixture(): Summary {
  return {
    mode: "carry_omega_focus_domain",
    from: "Genesis/1/1",
    to: "Genesis/1/7",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 7,
    runtimeErrors: 2,
    continuity: {
      expectedTransitions: 6,
      omegaMatches: 6,
      focusMatches: 6,
      domainMatches: 6,
      mismatches: { omega: [], focus: [], domain: [] }
    },
    sanity: {
      handleCounts: [10, 11, 12, 13, 15, 16, 17],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: "fA", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o1", focus: "fA", domain: "d0", pinned: ["p1"], pinnedCount: 1 },
        stateSize: { handles: 10, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 10, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: { omega: "o1", focus: "fA", domain: null, pinned: ["p1"], pinnedCount: 1 },
        carryOut: {
          omega: "o1",
          focus: "fA",
          domain: "d0",
          pinned: ["p1"],
          pinnedCount: 1
        },
        stateSize: { handles: 11, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 11, droppedCount: 1 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: { omega: "o1", focus: "fA", domain: "d1", pinned: ["p1"], pinnedCount: 1 },
        carryOut: {
          omega: "o2",
          focus: "fA",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        stateSize: { handles: 12, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 12, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/1/4",
        outputPath: "x/4.json",
        carryIn: {
          omega: "o2",
          focus: "fB",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o2",
          focus: "fB",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        stateSize: { handles: 13, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 13, droppedCount: 2 },
        runtimeError: "boom"
      },
      {
        sequence: 5,
        ref_key: "Genesis/1/5",
        outputPath: "x/5.json",
        carryIn: {
          omega: "o2",
          focus: "fB",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o3",
          focus: "fB",
          domain: "d2",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        stateSize: { handles: 15, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 2 },
        cleanup: { keptCount: 15, droppedCount: 3 },
        runtimeError: null
      },
      {
        sequence: 6,
        ref_key: "Genesis/1/6",
        outputPath: "x/6.json",
        carryIn: {
          omega: "o3",
          focus: "fB",
          domain: "d2",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o3",
          focus: "fC",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 16, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 2 },
        cleanup: { keptCount: 16, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 7,
        ref_key: "Genesis/1/7",
        outputPath: "x/7.json",
        carryIn: {
          omega: "o3",
          focus: "fB",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "o4",
          focus: "fC",
          domain: "d3",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 17, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 4 },
        cleanup: { keptCount: 17, droppedCount: 4 },
        runtimeError: "kaboom"
      }
    ]
  };
}

describe("summary insights carry semantics extractor", () => {
  it("computes run tables and ranked longest focus/domain runs", () => {
    const report = extractCarrySemantics(buildSummaryFixture());

    expect(report.verses).toBe(7);
    expect(report.runs.startOfVerse.focus.table).toEqual([
      {
        id: "fA",
        phase: "carryIn",
        field: "focus",
        startSeq: 1,
        endSeq: 3,
        startRefKey: "Genesis/1/1",
        endRefKey: "Genesis/1/3",
        length: 3,
        avgPinnedCount: 2 / 3,
        avgHandles: 11,
        errorCount: 0,
        errorRate: 0
      },
      {
        id: "fB",
        phase: "carryIn",
        field: "focus",
        startSeq: 4,
        endSeq: 7,
        startRefKey: "Genesis/1/4",
        endRefKey: "Genesis/1/7",
        length: 4,
        avgPinnedCount: 2.25,
        avgHandles: 15.25,
        errorCount: 2,
        errorRate: 0.5
      }
    ]);

    expect(report.rankings.longestFocusRuns[0]).toMatchObject({
      id: "fB",
      startSeq: 4,
      endSeq: 7,
      length: 4
    });
    expect(report.rankings.longestDomainRuns[0]).toMatchObject({
      id: "d1",
      startSeq: 3,
      endSeq: 5,
      length: 3
    });
  });

  it("derives sticky focus segments and coupling stats", () => {
    const report = extractCarrySemantics(buildSummaryFixture());

    expect(report.stickyFocus.thresholdLength).toBe(4);
    expect(report.stickyFocus.segments).toEqual([
      expect.objectContaining({
        id: "fB",
        startSeq: 4,
        endSeq: 7,
        length: 4,
        avgPinnedCount: 2.25
      })
    ]);
    expect(report.stickyFocus.coupling.avgPinnedCountDescribe).toMatchObject({
      count: 1,
      mean: 2.25
    });
  });

  it("computes error correlation means for handles/aliasEdges/pinned", () => {
    const report = extractCarrySemantics(buildSummaryFixture());

    expect(report.errorCorrelation.counts).toEqual({
      errorVerses: 2,
      nonErrorVerses: 5
    });

    expect(report.errorCorrelation.means.handles).toEqual({
      errorMean: 15,
      nonErrorMean: 12.8,
      delta: 2.1999999999999993,
      ratio: 1.171875
    });
    expect(report.errorCorrelation.means.aliasEdges).toEqual({
      errorMean: 2.5,
      nonErrorMean: 1,
      delta: 1.5,
      ratio: 2.5
    });
    expect(report.errorCorrelation.means.pinnedCountStart).toEqual({
      errorMean: 2.5,
      nonErrorMean: 1.2,
      delta: 1.3,
      ratio: 2.0833333333333335
    });
    expect(report.errorCorrelation.means.pinnedCountEnd).toEqual({
      errorMean: 2.5,
      nonErrorMean: 1.8,
      delta: 0.7,
      ratio: 1.3888888888888888
    });
  });
});
