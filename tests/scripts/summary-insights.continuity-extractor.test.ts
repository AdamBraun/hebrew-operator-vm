import { describe, expect, it } from "vitest";
import { extractContinuity } from "@ref/scripts/summaryInsights/extractors/continuity";
import type { Summary } from "@ref/scripts/summaryInsights/model";

function buildSummaryFixture(): Summary {
  return {
    mode: "carry_omega_focus",
    from: "Genesis/1/1",
    to: "Genesis/2/2",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 5,
    runtimeErrors: 0,
    continuity: {
      expectedTransitions: 4,
      omegaMatches: 2,
      focusMatches: 3,
      domainMatches: 2,
      mismatches: {
        omega: [
          "Genesis/1/3 -> Genesis/2/1: expected Ωv:Genesis_1_3, got Ωv:WRONG",
          "Genesis/2/1 -> Genesis/2/2: expected Ωv:Genesis_2_1, got Ωv:WRONG2"
        ],
        focus: ["Genesis/2/1 -> Genesis/2/2: expected focus:4, got focus:9"],
        domain: [
          "Genesis/1/2 -> Genesis/1/3: expected null, got domain:bad",
          "Genesis/1/3 -> Genesis/2/1: expected domain:bad2, got null"
        ]
      }
    },
    sanity: {
      handleCounts: [5, 4, 4, 4, 4],
      nonIncreasingHandleCount: true
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "x/1.json",
        carryIn: { omega: null, focus: null, domain: null, pinned: [], pinnedCount: 0 },
        carryOut: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 5, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 5, droppedCount: 1 },
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
          pinned: [],
          pinnedCount: 0
        },
        carryOut: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:2",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 4, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "x/3.json",
        carryIn: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:2",
          domain: "domain:bad",
          pinned: [],
          pinnedCount: 0
        },
        carryOut: {
          omega: "Ωv:Genesis_1_3",
          focus: "focus:3",
          domain: "domain:bad2",
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 4, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 3 },
        runtimeError: null
      },
      {
        sequence: 4,
        ref_key: "Genesis/2/1",
        outputPath: "x/4.json",
        carryIn: {
          omega: "Ωv:WRONG",
          focus: "focus:3",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        carryOut: {
          omega: "Ωv:Genesis_2_1",
          focus: "focus:4",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 4, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 4 },
        runtimeError: null
      },
      {
        sequence: 5,
        ref_key: "Genesis/2/2",
        outputPath: "x/5.json",
        carryIn: {
          omega: "Ωv:WRONG2",
          focus: "focus:9",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        carryOut: {
          omega: "Ωv:Genesis_2_2",
          focus: "focus:5",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 4, links: 0, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 5 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights continuity extractor", () => {
  it("derives continuity rates, mismatch bursts, and clustering", () => {
    const report = extractContinuity(buildSummaryFixture());

    expect(report.transitionCount).toBe(4);
    expect(report.rates.omega).toEqual({ matches: 2, mismatches: 2, rate: 0.5 });
    expect(report.rates.focus).toEqual({ matches: 3, mismatches: 1, rate: 0.75 });
    expect(report.rates.domain).toEqual({ matches: 2, mismatches: 2, rate: 0.5 });

    expect(report.mismatches.counts).toEqual({
      omega: 2,
      focus: 1,
      domain: 2,
      total: 5
    });

    expect(report.bursts.omega).toEqual([
      {
        field: "omega",
        startSequence: 4,
        endSequence: 5,
        startRefKey: "Genesis/2/1",
        endRefKey: "Genesis/2/2",
        length: 2
      }
    ]);
    expect(report.bursts.domain).toEqual([
      {
        field: "domain",
        startSequence: 3,
        endSequence: 4,
        startRefKey: "Genesis/1/3",
        endRefKey: "Genesis/2/1",
        length: 2
      }
    ]);
    expect(report.bursts.longestByField).toEqual({
      omega: 2,
      focus: 1,
      domain: 2
    });

    expect(report.clustering.byBookChapter).toEqual([
      {
        key: "Genesis/1",
        book: "Genesis",
        chapter: 1,
        omega: 0,
        focus: 0,
        domain: 1,
        total: 1
      },
      {
        key: "Genesis/2",
        book: "Genesis",
        chapter: 2,
        omega: 2,
        focus: 1,
        domain: 1,
        total: 4
      }
    ]);
  });

  it("reports null carry counts and mode compliance violations", () => {
    const report = extractContinuity(buildSummaryFixture());

    expect(report.nullCarry.carryIn).toEqual({
      omega: 1,
      focus: 1,
      domain: 4,
      pinnedEmpty: 5
    });
    expect(report.nullCarry.carryOut).toEqual({
      omega: 0,
      focus: 0,
      domain: 4,
      pinnedEmpty: 5
    });

    expect(report.modeCompliance.expectedNull).toEqual({
      focus: false,
      domain: true
    });
    expect(report.modeCompliance.compliant).toBe(false);
    expect(report.modeCompliance.counts).toEqual({
      total: 2,
      focus: 0,
      domain: 2,
      byDirection: { carryIn: 1, carryOut: 1 }
    });
    expect(report.modeCompliance.violations).toEqual([
      {
        sequence: 3,
        refKey: "Genesis/1/3",
        direction: "carryIn",
        field: "domain",
        expected: null,
        observed: "domain:bad"
      },
      {
        sequence: 3,
        refKey: "Genesis/1/3",
        direction: "carryOut",
        field: "domain",
        expected: null,
        observed: "domain:bad2"
      }
    ]);
  });

  it("flags unknown mode as such without null-field enforcement", () => {
    const summary = buildSummaryFixture();
    summary.mode = "unknown_mode";

    const report = extractContinuity(summary);
    expect(report.modeCompliance.unknownMode).toBe(true);
    expect(report.modeCompliance.expectedNull).toEqual({
      focus: false,
      domain: false
    });
  });
});
