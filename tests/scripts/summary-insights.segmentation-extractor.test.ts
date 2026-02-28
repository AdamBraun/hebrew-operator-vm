import { describe, expect, it } from "vitest";
import { extractSegmentation } from "@ref/scripts/summaryInsights/extractors/segmentation";
import type { Summary } from "@ref/scripts/summaryInsights/model";

function buildSummaryFixture(): Summary {
  return {
    mode: "carry_omega_focus_domain",
    from: "Genesis/1/1",
    to: "Exodus/1/2",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 7,
    runtimeErrors: 2,
    continuity: {
      expectedTransitions: 6,
      omegaMatches: 4,
      focusMatches: 4,
      domainMatches: 3,
      mismatches: { omega: [], focus: [], domain: [] }
    },
    sanity: {
      handleCounts: [10, 11, 13, 20, 18, 30, 25],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: null, domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o1", focus: "f1", domain: "d1", pinned: ["p1"], pinnedCount: 1 },
        stateSize: { handles: 10, links: 10, boundaries: 1, rules: 1, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 10, droppedCount: 5 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: { omega: "o1", focus: "f1", domain: "d1", pinned: ["p1"], pinnedCount: 1 },
        carryOut: { omega: "o2", focus: "f1", domain: "d1", pinned: ["p1"], pinnedCount: 1 },
        stateSize: { handles: 11, links: 12, boundaries: 1, rules: 1, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 11, droppedCount: 3 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: { omega: "o2", focus: "f1", domain: "d1", pinned: ["p1"], pinnedCount: 1 },
        carryOut: {
          omega: "o3",
          focus: "f2",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        stateSize: { handles: 13, links: 15, boundaries: 1, rules: 1, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 13, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/2/1",
        outputPath: "x/4.json",
        carryIn: {
          omega: "o_bad",
          focus: "f_bad",
          domain: "d1",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o4",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 20, links: 28, boundaries: 2, rules: 2, cont: 1, aliasEdges: 2 },
        cleanup: { keptCount: 20, droppedCount: 30 },
        runtimeError: "boom"
      },
      {
        sequence: 5,
        ref_key: "Genesis/2/2",
        outputPath: "x/5.json",
        carryIn: {
          omega: "o4",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "o5",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 18, links: 21, boundaries: 2, rules: 2, cont: 1, aliasEdges: 2 },
        cleanup: { keptCount: 18, droppedCount: 5 },
        runtimeError: null
      },
      {
        sequence: 6,
        ref_key: "Exodus/1/1",
        outputPath: "x/6.json",
        carryIn: {
          omega: "o_bad2",
          focus: "f_bad2",
          domain: "d_bad",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "o6",
          focus: "f4",
          domain: "d3",
          pinned: ["p1", "p2", "p3", "p4"],
          pinnedCount: 4
        },
        stateSize: { handles: 30, links: 44, boundaries: 3, rules: 3, cont: 1, aliasEdges: 3 },
        cleanup: { keptCount: 30, droppedCount: 40 },
        runtimeError: "kaboom"
      },
      {
        sequence: 7,
        ref_key: "Exodus/1/2",
        outputPath: "x/7.json",
        carryIn: {
          omega: "o6",
          focus: "f4",
          domain: "d3",
          pinned: ["p1", "p2", "p3", "p4"],
          pinnedCount: 4
        },
        carryOut: {
          omega: "o7",
          focus: "f4",
          domain: "d3",
          pinned: ["p1", "p2", "p3", "p4"],
          pinnedCount: 4
        },
        stateSize: { handles: 25, links: 30, boundaries: 2, rules: 2, cont: 1, aliasEdges: 3 },
        cleanup: { keptCount: 25, droppedCount: 4 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights segmentation extractor", () => {
  it("aggregates per-book/per-chapter metrics and sorts by problematic segments", () => {
    const report = extractSegmentation(buildSummaryFixture());

    expect(report.verses).toBe(7);
    expect(report.perBook.map((row) => row.key)).toEqual(["Exodus", "Genesis"]);

    expect(report.perBook[0]).toMatchObject({
      key: "Exodus",
      verseCount: 2,
      errorCount: 1,
      errorRate: 0.5,
      transitionCount: 2,
      mismatchTransitionCount: 1,
      mismatchFieldTotal: 3
    });
    expect(report.perBook[0]?.pinnedCount.describe.mean).toBe(4);
    expect(report.perBook[0]?.dropRate.describe.mean).toBeCloseTo(0.3546798, 6);

    expect(report.perBook[1]).toMatchObject({
      key: "Genesis",
      verseCount: 5,
      errorCount: 1,
      errorRate: 0.2,
      transitionCount: 4,
      mismatchTransitionCount: 1,
      mismatchFieldTotal: 2
    });
    expect(report.perBook[1]?.handles.growth).toBe(8);
    expect(report.perBook[1]?.dropRate.describe.count).toBe(5);

    expect(report.perChapter.map((row) => row.key)).toEqual(["Genesis/2", "Exodus/1", "Genesis/1"]);
    expect(report.perChapter[0]).toMatchObject({
      key: "Genesis/2",
      verseCount: 2,
      errorRate: 0.5,
      mismatchTransitionRate: 0.5
    });
    expect(report.perChapter[1]).toMatchObject({
      key: "Exodus/1",
      verseCount: 2,
      errorRate: 0.5,
      mismatchTransitionRate: 0.5
    });
  });

  it("detects chapter-boundary mismatch spikes", () => {
    const report = extractSegmentation(buildSummaryFixture());
    const checks = report.chapterTransitionChecks;

    expect(checks).toMatchObject({
      totalTransitions: 6,
      boundaryTransitions: 2,
      nonBoundaryTransitions: 4,
      boundaryMismatchTransitions: 2,
      nonBoundaryMismatchTransitions: 0,
      boundaryMismatchRate: 1,
      nonBoundaryMismatchRate: 0,
      boundaryMismatchFieldMean: 2.5,
      nonBoundaryMismatchFieldMean: 0,
      spikeDetected: true
    });

    expect(checks.topBoundaryTransitions).toEqual([
      {
        prevSequence: 5,
        sequence: 6,
        prevRefKey: "Genesis/2/2",
        ref_key: "Exodus/1/1",
        from: "Genesis/2",
        to: "Exodus/1",
        mismatchFields: ["omega", "focus", "domain"],
        mismatchCount: 3
      },
      {
        prevSequence: 3,
        sequence: 4,
        prevRefKey: "Genesis/1/3",
        ref_key: "Genesis/2/1",
        from: "Genesis/1",
        to: "Genesis/2",
        mismatchFields: ["omega", "focus"],
        mismatchCount: 2
      }
    ]);
  });

  it("handles no chapter boundaries without false spike detection", () => {
    const summary = buildSummaryFixture();
    summary.verses = summary.verses.slice(0, 3);
    summary.versesSelected = 3;
    summary.runtimeErrors = 0;

    const report = extractSegmentation(summary);
    expect(report.chapterTransitionChecks.boundaryTransitions).toBe(0);
    expect(report.chapterTransitionChecks.boundaryMismatchRate).toBeNull();
    expect(report.chapterTransitionChecks.spikeDetected).toBeNull();
  });
});
