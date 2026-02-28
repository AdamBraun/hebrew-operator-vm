import { describe, expect, it } from "vitest";
import { extractCleanup } from "@ref/scripts/summaryInsights/extractors/cleanup";
import type { Summary } from "@ref/scripts/summaryInsights/model";

function buildSummaryFixture(): Summary {
  return {
    mode: "carry_omega_focus",
    from: "Genesis/1/1",
    to: "Genesis/1/6",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 6,
    runtimeErrors: 0,
    continuity: {
      expectedTransitions: 5,
      omegaMatches: 5,
      focusMatches: 5,
      domainMatches: 5,
      mismatches: { omega: [], focus: [], domain: [] }
    },
    sanity: {
      handleCounts: [10, 10, 9, 11, 13, 13],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: null, domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o1", focus: "f1", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 10, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: null, droppedCount: null },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: { omega: "o1", focus: "f1", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o2", focus: "f2", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 10, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 10, droppedCount: 5 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: { omega: "o2", focus: "f2", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o3", focus: "f3", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 9, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 9, droppedCount: 0 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/1/4",
        outputPath: "x/4.json",
        carryIn: { omega: "o3", focus: "f3", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o4", focus: "f4", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 11, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 12, droppedCount: 18 },
        runtimeError: null
      },
      {
        sequence: 5,
        ref_key: "Genesis/1/5",
        outputPath: "x/5.json",
        carryIn: { omega: "o4", focus: "f4", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o5", focus: "f5", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 13, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 13, droppedCount: 20 },
        runtimeError: null
      },
      {
        sequence: 6,
        ref_key: "Genesis/1/6",
        outputPath: "x/6.json",
        carryIn: { omega: "o5", focus: "f5", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o6", focus: "f6", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 13, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 13, droppedCount: 0 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights cleanup extractor", () => {
  it("computes cleanup execution, drop-rate stats, invariants, and outliers", () => {
    const report = extractCleanup(buildSummaryFixture());

    expect(report.verses).toBe(6);
    expect(report.cleanupExecution).toEqual({
      executedCount: 5,
      skippedCount: 1,
      executedRate: 5 / 6
    });

    expect(report.dropRate.series).toEqual([5 / 15, 0, 18 / 30, 20 / 33, 0]);
    expect(report.dropRate.nonZeroDrops).toBe(3);
    expect(report.dropRate.zeroDrops).toBe(2);
    expect(report.dropRate.describe.count).toBe(5);
    expect(report.keptCount.describe.count).toBe(5);
    expect(report.droppedCount.describe.count).toBe(5);

    expect(report.invariants.keptVsStateHandles).toEqual({
      checkedCount: 5,
      matchingCount: 4,
      mismatchCount: 1,
      maxAbsDelta: 1,
      mismatches: [
        {
          sequence: 4,
          ref_key: "Genesis/1/4",
          keptCount: 12,
          stateHandles: 11,
          delta: 1
        }
      ]
    });

    expect(report.outliers.topDroppedCount[0]).toMatchObject({
      sequence: 5,
      ref_key: "Genesis/1/5",
      metric: "droppedCount",
      value: 20
    });
    expect(report.outliers.topKeptCount[0]).toMatchObject({
      sequence: 5,
      ref_key: "Genesis/1/5",
      metric: "keptCount",
      value: 13
    });
    expect(report.outliers.topDropRate[0]).toMatchObject({
      sequence: 5,
      ref_key: "Genesis/1/5",
      metric: "dropRate"
    });
    expect(report.trend.keptCountWindows.length).toBeGreaterThan(0);
    expect(report.trend.stateHandlesWindows.length).toBeGreaterThan(0);
  });

  it("reports skipped cleanup and low activity when counts are null/zero", () => {
    const summary = buildSummaryFixture();
    summary.verses = summary.verses.map((row, index) => ({
      ...row,
      cleanup:
        index === 0
          ? { keptCount: null, droppedCount: null }
          : { keptCount: row.stateSize.handles, droppedCount: 0 }
    }));

    const report = extractCleanup(summary);
    expect(report.cleanupExecution.executedCount).toBe(5);
    expect(report.dropRate.nonZeroDrops).toBe(0);
    expect(report.qualitySignals.cleanupWork).toBe("inactive");
    expect(report.qualitySignals.leakRisk).toBe("high");
  });
});
