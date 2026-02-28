import { describe, expect, it } from "vitest";
import { extractStateShape } from "@ref/scripts/summaryInsights/extractors/stateShape";
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
      handleCounts: [10, 11, 12, 12, 20, 19],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: null, domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o1", focus: "f1", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 10, links: 10, boundaries: 2, rules: 1, cont: 0, aliasEdges: 1 },
        cleanup: { keptCount: 10, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: { omega: "o1", focus: "f1", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o2", focus: "f2", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 11, links: 11, boundaries: 2, rules: 1, cont: 1, aliasEdges: 1 },
        cleanup: { keptCount: 11, droppedCount: 1 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: { omega: "o2", focus: "f2", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o3", focus: "f3", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 12, links: 13, boundaries: 2, rules: 1, cont: 1, aliasEdges: 2 },
        cleanup: { keptCount: 12, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/1/4",
        outputPath: "x/4.json",
        carryIn: { omega: "o3", focus: "f3", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o4", focus: "f4", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 12, links: 12, boundaries: 2, rules: 1, cont: 1, aliasEdges: 2 },
        cleanup: { keptCount: 12, droppedCount: 0 },
        runtimeError: null
      },
      {
        sequence: 5,
        ref_key: "Genesis/1/5",
        outputPath: "x/5.json",
        carryIn: { omega: "o4", focus: "f4", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o5", focus: "f5", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 20, links: 30, boundaries: 6, rules: 2, cont: 3, aliasEdges: 4 },
        cleanup: { keptCount: 20, droppedCount: 30 },
        runtimeError: null
      },
      {
        sequence: 6,
        ref_key: "Genesis/1/6",
        outputPath: "x/6.json",
        carryIn: { omega: "o5", focus: "f5", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: { omega: "o6", focus: "f6", domain: null, pinned: [], pinnedCount: 0 },
        stateSize: { handles: 19, links: 28, boundaries: 6, rules: 2, cont: 3, aliasEdges: 4 },
        cleanup: { keptCount: 19, droppedCount: 20 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights state-shape extractor", () => {
  it("computes metric describes, ratios, deltas, and regime changes", () => {
    const report = extractStateShape(buildSummaryFixture());

    expect(report.verses).toBe(6);
    expect(report.metrics.handles.series).toEqual([10, 11, 12, 12, 20, 19]);
    expect(report.metrics.handles.describe).toMatchObject({
      count: 6,
      min: 10,
      max: 20
    });

    expect(report.ratios.perVerse[0]).toEqual({
      sequence: 1,
      ref_key: "Genesis/1/1",
      handles: 10,
      linksPerHandle: 1,
      boundariesPerHandle: 0.2,
      rulesPerHandle: 0.1,
      aliasEdgesPerHandle: 0.1,
      contPerHandle: 0
    });
    expect(report.ratios.describe.linksPerHandle.count).toBe(6);

    expect(report.deltas.perMetric.handles.series).toEqual([1, 1, 0, 8, -1]);
    expect(report.deltas.perMetric.links.series).toEqual([1, 2, -1, 18, -2]);
    expect(report.deltas.perMetric.handles.topAbsDelta[0]).toMatchObject({
      sequence: 5,
      ref_key: "Genesis/1/5",
      delta: 8,
      absDelta: 8
    });
    expect(report.deltas.topAcrossMetrics[0]).toMatchObject({
      metric: "links",
      sequence: 5,
      ref_key: "Genesis/1/5",
      absDelta: 18
    });

    expect(report.regimeChange.threshold).not.toBeNull();
    expect(report.regimeChange.events).toEqual([
      expect.objectContaining({
        metric: "handles",
        sequence: 5,
        ref_key: "Genesis/1/5",
        delta: 8
      })
    ]);
  });

  it("guards ratios when handles are zero", () => {
    const summary = buildSummaryFixture();
    summary.verses[0].stateSize.handles = 0;
    summary.verses[0].stateSize.links = 4;

    const report = extractStateShape(summary);
    expect(report.ratios.perVerse[0]).toMatchObject({
      handles: 0,
      linksPerHandle: null,
      boundariesPerHandle: null,
      rulesPerHandle: null,
      aliasEdgesPerHandle: null,
      contPerHandle: null
    });
  });
});
