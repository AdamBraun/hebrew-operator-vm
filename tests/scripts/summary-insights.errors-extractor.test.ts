import { describe, expect, it } from "vitest";
import { extractErrors } from "@ref/scripts/summaryInsights/extractors/errors";
import type { Summary } from "@ref/scripts/summaryInsights/model";

function buildSummaryFixture(): Summary {
  return {
    mode: "carry_omega_focus_domain",
    from: "Genesis/1/1",
    to: "Exodus/1/1",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 6,
    runtimeErrors: 3,
    continuity: {
      expectedTransitions: 5,
      omegaMatches: 5,
      focusMatches: 5,
      domainMatches: 5,
      mismatches: { omega: [], focus: [], domain: [] }
    },
    sanity: {
      handleCounts: [10, 40, 12, 50, 45, 11],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: "f1", domain: "d1", pinned: [], pinnedCount: 0 },
        carryOut: {
          omega: "o1",
          focus: "f1",
          domain: "d1",
          pinned: ["p1"],
          pinnedCount: 1
        },
        stateSize: { handles: 10, links: 9, boundaries: 1, rules: 1, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 10, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: {
          omega: "o1",
          focus: "f1",
          domain: "d1",
          pinned: ["p1"],
          pinnedCount: 1
        },
        carryOut: {
          omega: "o2",
          focus: "f2",
          domain: "d1",
          pinned: ["p1"],
          pinnedCount: 1
        },
        stateSize: { handles: 40, links: 44, boundaries: 2, rules: 2, cont: 1, aliasEdges: 5 },
        cleanup: { keptCount: 40, droppedCount: 100 },
        runtimeError: "Missing handle H123 in zone 42"
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: {
          omega: "o2",
          focus: "f2",
          domain: "d1",
          pinned: ["p1"],
          pinnedCount: 1
        },
        carryOut: {
          omega: "o3",
          focus: "f3",
          domain: "d1",
          pinned: ["p1"],
          pinnedCount: 1
        },
        stateSize: { handles: 12, links: 11, boundaries: 1, rules: 1, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 12, droppedCount: 5 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/2/1",
        outputPath: "x/4.json",
        carryIn: {
          omega: "o3",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o4",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        stateSize: { handles: 50, links: 53, boundaries: 3, rules: 2, cont: 2, aliasEdges: 6 },
        cleanup: { keptCount: 50, droppedCount: 120 },
        runtimeError: "Missing HANDLE h999 in zone 11!"
      },
      {
        sequence: 5,
        ref_key: "Genesis/2/2",
        outputPath: "x/5.json",
        carryIn: {
          omega: "o4",
          focus: "f3",
          domain: "d2",
          pinned: ["p1", "p2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "o5",
          focus: "f4",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 45, links: 49, boundaries: 3, rules: 3, cont: 2, aliasEdges: 8 },
        cleanup: { keptCount: 45, droppedCount: 90 },
        runtimeError: "TypeError: domain D55 not found at 0xABC123"
      },
      {
        sequence: 6,
        ref_key: "Exodus/1/1",
        outputPath: "x/6.json",
        carryIn: {
          omega: "o5",
          focus: "f4",
          domain: "d2",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "o6",
          focus: "f5",
          domain: "d3",
          pinned: ["p1", "p2", "p3"],
          pinnedCount: 3
        },
        stateSize: { handles: 11, links: 10, boundaries: 1, rules: 1, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 11, droppedCount: 4 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights errors extractor", () => {
  it("computes error rate, normalized clusters, and per-book density", () => {
    const report = extractErrors(buildSummaryFixture());

    expect(report.verses).toBe(6);
    expect(report.errorCount).toBe(3);
    expect(report.errorRate).toBe(0.5);
    expect(report.errorVerses).toEqual([
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        runtimeError: "Missing handle H123 in zone 42",
        normalizedMessage: "missing handle h# in zone #",
        messagePrefix: "missing handle h# in zone #"
      },
      {
        sequence: 4,
        ref_key: "Genesis/2/1",
        runtimeError: "Missing HANDLE h999 in zone 11!",
        normalizedMessage: "missing handle h# in zone #",
        messagePrefix: "missing handle h# in zone #"
      },
      {
        sequence: 5,
        ref_key: "Genesis/2/2",
        runtimeError: "TypeError: domain D55 not found at 0xABC123",
        normalizedMessage: "typeerror: domain d# not found at 0x#",
        messagePrefix: "typeerror: domain d# not found at 0x#"
      }
    ]);

    expect(report.clustering.byMessagePrefix).toEqual([
      {
        messagePrefix: "missing handle h# in zone #",
        normalizedMessageSample: "missing handle h# in zone #",
        count: 2,
        sequences: [2, 4],
        refs: ["Genesis/1/2", "Genesis/2/1"],
        sampleMessages: ["Missing handle H123 in zone 42", "Missing HANDLE h999 in zone 11!"]
      },
      {
        messagePrefix: "typeerror: domain d# not found at 0x#",
        normalizedMessageSample: "typeerror: domain d# not found at 0x#",
        count: 1,
        sequences: [5],
        refs: ["Genesis/2/2"],
        sampleMessages: ["TypeError: domain D55 not found at 0xABC123"]
      }
    ]);

    expect(report.density.byBookChapter).toEqual([
      {
        key: "Exodus/1",
        book: "Exodus",
        chapter: 1,
        verseCount: 1,
        errorCount: 0,
        errorRate: 0
      },
      {
        key: "Genesis/1",
        book: "Genesis",
        chapter: 1,
        verseCount: 3,
        errorCount: 1,
        errorRate: 1 / 3
      },
      {
        key: "Genesis/2",
        book: "Genesis",
        chapter: 2,
        verseCount: 2,
        errorCount: 2,
        errorRate: 1
      }
    ]);
  });

  it("computes pre-error metric comparisons and outlier rankings", () => {
    const report = extractErrors(buildSummaryFixture());

    expect(report.preErrorSignature.metricComparisons.handles.errorDescribe).toMatchObject({
      count: 3,
      min: 40,
      max: 50,
      mean: 45
    });
    expect(report.preErrorSignature.metricComparisons.handles.nonErrorDescribe).toMatchObject({
      count: 3,
      min: 10,
      max: 12,
      mean: 11
    });
    expect(report.preErrorSignature.metricComparisons.handles.meanDelta).toBe(34);
    expect(report.preErrorSignature.metricComparisons.handles.meanRatio).toBeCloseTo(
      4.0909090909,
      8
    );

    const handleOutliers = report.preErrorSignature.outlierErrorVerses.handles;
    expect(handleOutliers.map((row) => row.sequence)).toEqual([4, 5, 2]);
    expect(handleOutliers[0]).toMatchObject({
      metric: "handles",
      sequence: 4,
      ref_key: "Genesis/2/1",
      value: 50,
      nonErrorMean: 11,
      deltaFromNonErrorMean: 39
    });
    expect(handleOutliers[0]?.zScore).toBeCloseTo(47.765, 3);

    expect(report.preErrorSignature.topAcrossMetrics[0]).toMatchObject({
      metric: "links",
      sequence: 4,
      ref_key: "Genesis/2/1"
    });
  });

  it("handles runs with no runtime errors", () => {
    const summary = buildSummaryFixture();
    summary.runtimeErrors = 0;
    summary.verses = summary.verses.map((row) => ({ ...row, runtimeError: null }));

    const report = extractErrors(summary);
    expect(report.errorCount).toBe(0);
    expect(report.errorRate).toBe(0);
    expect(report.errorVerses).toEqual([]);
    expect(report.clustering.byMessagePrefix).toEqual([]);
    expect(report.preErrorSignature.metricComparisons.handles.errorDescribe.count).toBe(0);
    expect(report.preErrorSignature.outlierErrorVerses.handles).toEqual([]);
    expect(report.preErrorSignature.topAcrossMetrics).toEqual([]);
  });
});
