import { describe, expect, it } from "vitest";
import { extractPinned } from "@ref/scripts/summaryInsights/extractors/pinned";
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
      mismatches: {
        omega: [],
        focus: [],
        domain: []
      }
    },
    sanity: {
      handleCounts: [10, 10, 11, 11, 12, 11],
      nonIncreasingHandleCount: false
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: "focus:1", domain: null, pinned: [], pinnedCount: 0 },
        carryOut: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: ["A"],
          pinnedCount: 1
        },
        stateSize: { handles: 10, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 10, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "x/2.json",
        carryIn: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: ["A"],
          pinnedCount: 1
        },
        carryOut: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:1",
          domain: null,
          pinned: ["A", "B"],
          pinnedCount: 2
        },
        stateSize: { handles: 10, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 10, droppedCount: 1 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:1",
          domain: null,
          pinned: ["A"],
          pinnedCount: 1
        },
        carryOut: {
          omega: "Ωv:Genesis_1_3",
          focus: "focus:1",
          domain: null,
          pinned: ["A", "B"],
          pinnedCount: 2
        },
        stateSize: { handles: 11, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 11, droppedCount: 3 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/1/4",
        outputPath: "x/4.json",
        carryIn: {
          omega: "Ωv:Genesis_1_3",
          focus: "focus:2",
          domain: null,
          pinned: ["A", "B", "X"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "Ωv:Genesis_1_4",
          focus: "focus:2",
          domain: null,
          pinned: ["B", "C"],
          pinnedCount: 2
        },
        stateSize: { handles: 11, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 11, droppedCount: 4 },
        runtimeError: null
      },
      {
        sequence: 5,
        ref_key: "Genesis/1/5",
        outputPath: "x/5.json",
        carryIn: {
          omega: "Ωv:Genesis_1_4",
          focus: "focus:2",
          domain: null,
          pinned: ["B", "C"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "Ωv:Genesis_1_5",
          focus: "focus:2",
          domain: null,
          pinned: ["B", "C", "D"],
          pinnedCount: 3
        },
        stateSize: { handles: 12, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 12, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 6,
        ref_key: "Genesis/1/6",
        outputPath: "x/6.json",
        carryIn: {
          omega: "Ωv:Genesis_1_5",
          focus: "focus:3",
          domain: null,
          pinned: ["B", "C", "D"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "Ωv:Genesis_1_6",
          focus: "focus:3",
          domain: null,
          pinned: ["C", "D"],
          pinnedCount: 2
        },
        stateSize: { handles: 11, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 11, droppedCount: 5 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights pinned extractor", () => {
  it("computes pinned distribution, churn, and accumulation metrics", () => {
    const report = extractPinned(buildSummaryFixture());

    expect(report.verses).toBe(6);
    expect(report.pinnedCount.series).toEqual([1, 2, 2, 2, 3, 2]);
    expect(report.pinnedCount.describe).toMatchObject({
      count: 6,
      min: 1,
      max: 3,
      mean: 2
    });
    expect(report.pinnedCount.histogram).toEqual({
      "0": 0,
      "1": 1,
      "2-3": 5,
      "4-7": 0,
      "8+": 0
    });
    expect(report.pinnedCount.deltas.series).toEqual([1, 0, 0, 1, -1]);
    expect(report.pinnedCount.deltas).toMatchObject({
      positive: 2,
      negative: 1,
      zero: 2,
      net: 1,
      nonDecreasingTransitions: 4,
      nonDecreasingRate: 0.8
    });
    expect(report.pinnedCount.accumulation).toEqual({
      start: 1,
      end: 2,
      netGrowth: 1
    });

    expect(report.churn.transitions).toBe(5);
    expect(report.churn.totals).toMatchObject({
      added: 1,
      removed: 1,
      zeroChurnTransitions: 3
    });
    expect(report.churn.totals.jaccardMean).toBeCloseTo(0.8333333333, 8);
    expect(report.churn.topAdded[0]).toMatchObject({
      sequence: 4,
      added: ["X"],
      removed: []
    });
    expect(report.churn.topRemoved[0]).toMatchObject({
      sequence: 3,
      added: [],
      removed: ["B"]
    });
  });

  it("computes longevity and immortal candidates deterministically", () => {
    const report = extractPinned(buildSummaryFixture());

    expect(report.longevity.handlesTracked).toBe(4);
    expect(report.longevity.table).toEqual([
      {
        id: "B",
        firstSeq: 2,
        lastSeq: 5,
        lifespan: 4,
        presenceCount: 4,
        presenceRatio: 1
      },
      {
        id: "A",
        firstSeq: 1,
        lastSeq: 3,
        lifespan: 3,
        presenceCount: 3,
        presenceRatio: 1
      },
      {
        id: "C",
        firstSeq: 4,
        lastSeq: 6,
        lifespan: 3,
        presenceCount: 3,
        presenceRatio: 1
      },
      {
        id: "D",
        firstSeq: 5,
        lastSeq: 6,
        lifespan: 2,
        presenceCount: 2,
        presenceRatio: 1
      }
    ]);
    expect(report.longevity.immortals).toEqual({
      thresholdPct: 0.6,
      minLifespan: 4,
      handles: [
        {
          id: "B",
          firstSeq: 2,
          lastSeq: 5,
          lifespan: 4,
          presenceCount: 4,
          presenceRatio: 1
        }
      ]
    });
    expect(report.longevity.topByLifespan.map((row) => row.id).slice(0, 3)).toEqual([
      "B",
      "A",
      "C"
    ]);
  });

  it("computes focus-pinned coupling and quality signals", () => {
    const report = extractPinned(buildSummaryFixture());

    expect(report.coupling.focusRuns).toEqual([
      {
        focusId: "focus:1",
        startSeq: 1,
        endSeq: 3,
        length: 3,
        transitionCount: 2,
        stableTransitions: 1,
        stabilityRate: 0.5
      },
      {
        focusId: "focus:2",
        startSeq: 4,
        endSeq: 5,
        length: 2,
        transitionCount: 1,
        stableTransitions: 0,
        stabilityRate: 0
      },
      {
        focusId: "focus:3",
        startSeq: 6,
        endSeq: 6,
        length: 1,
        transitionCount: 0,
        stableTransitions: 0,
        stabilityRate: null
      }
    ]);
    expect(report.coupling.stabilityDescribe.mean).toBeCloseTo(0.25, 8);
    expect(report.coupling.pearsonLike).toBeCloseTo(1, 8);
    expect(report.coupling.heuristic).toBe("brittle");

    expect(report.qualitySignals).toEqual({
      accumulationRisk: "low",
      brittlenessRisk: "medium"
    });
  });

  it("handles empty verse list gracefully", () => {
    const summary = buildSummaryFixture();
    summary.verses = [];
    summary.versesSelected = 0;
    summary.continuity.expectedTransitions = 0;

    const report = extractPinned(summary);
    expect(report.verses).toBe(0);
    expect(report.churn.transitions).toBe(0);
    expect(report.longevity.handlesTracked).toBe(0);
    expect(report.coupling.heuristic).toBe("insufficient_data");
  });
});
