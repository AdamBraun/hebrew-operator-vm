import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultOutDirForSummary,
  parseArgs,
  runSummaryInsights
} from "@ref/scripts/summaryInsights/runtime";

function buildSummaryFixture(): Record<string, unknown> {
  return {
    mode: "carry_omega_focus",
    from: "Genesis/1/1",
    to: "Genesis/1/3",
    input: "data/torah.json",
    outDir: "outputs/continual-run/sample",
    versesSelected: 3,
    runtimeErrors: 0,
    continuity: {
      expectedTransitions: 2,
      omegaMatches: 2,
      focusMatches: 2,
      domainMatches: 2,
      mismatches: {
        omega: [],
        focus: [],
        domain: []
      }
    },
    sanity: {
      handleCounts: [5, 4, 4],
      nonIncreasingHandleCount: true
    },
    verses: [
      {
        sequence: 1,
        ref_key: "Genesis/1/1",
        outputPath: "outputs/continual-run/sample/verses/001-Genesis_1_1.json",
        carryIn: { omega: null, focus: null, domain: null, pinned: [], pinnedCount: 0 },
        carryOut: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: ["pin:1"],
          pinnedCount: 1
        },
        stateSize: { handles: 5, links: 3, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 5, droppedCount: 2 },
        runtimeError: null
      },
      {
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "outputs/continual-run/sample/verses/002-Genesis_1_2.json",
        carryIn: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: ["pin:1"],
          pinnedCount: 1
        },
        carryOut: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:2",
          domain: null,
          pinned: ["pin:1", "pin:2"],
          pinnedCount: 2
        },
        stateSize: { handles: 4, links: 2, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 10 },
        runtimeError: null
      },
      {
        sequence: 3,
        ref_key: "Genesis/1/3",
        outputPath: "outputs/continual-run/sample/verses/003-Genesis_1_3.json",
        carryIn: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:2",
          domain: null,
          pinned: ["pin:1", "pin:2"],
          pinnedCount: 2
        },
        carryOut: {
          omega: "Ωv:Genesis_1_3",
          focus: "focus:3",
          domain: null,
          pinned: [],
          pinnedCount: 0
        },
        stateSize: { handles: 4, links: 2, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 1 },
        runtimeError: null
      }
    ]
  };
}

describe("summary insights runtime", () => {
  it("parses args with defaults", () => {
    const parsed = parseArgs(["--summary=/tmp/run/summary.json"]);
    expect(parsed).toEqual({
      summary: "/tmp/run/summary.json",
      outDir: "/tmp/run/insights",
      format: "both",
      topN: 25,
      includeJoins: false,
      joinLimit: 250,
      workspaceRoot: ""
    });
    expect(defaultOutDirForSummary("/tmp/run/summary.json")).toBe("/tmp/run/insights");
  });

  it("parses join options", () => {
    const parsed = parseArgs([
      "--summary=/tmp/run/summary.json",
      "--include-joins",
      "--join-limit=10"
    ]);
    expect(parsed.includeJoins).toBe(true);
    expect(parsed.joinLimit).toBe(10);
  });

  it("writes json and markdown reports", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-runtime-"));
    const summaryPath = path.join(tmpDir, "summary.json");
    const outDir = path.join(tmpDir, "insights-out");
    fs.writeFileSync(summaryPath, JSON.stringify(buildSummaryFixture(), null, 2), "utf8");

    const result = await runSummaryInsights({
      summary: summaryPath,
      outDir,
      format: "both",
      topN: 2,
      includeJoins: false,
      joinLimit: 250,
      workspaceRoot: process.cwd()
    });

    expect(result.jsonPath).toBe(path.join(outDir, "insights.json"));
    expect(result.markdownPath).toBe(path.join(outDir, "insights.md"));
    expect(result.indexPath).toBe(path.join(outDir, "index.json"));
    expect(fs.existsSync(path.join(outDir, "insights.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "insights.md"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "index.json"))).toBe(true);

    const json = JSON.parse(fs.readFileSync(path.join(outDir, "insights.json"), "utf8"));
    expect(json.meta).toEqual({
      mode: "carry_omega_focus",
      from: "Genesis/1/1",
      to: "Genesis/1/3",
      versesSelected: 3,
      runtimeErrors: 0,
      expectedTransitions: 2
    });
    expect(json.continuity).toBeDefined();
    expect(json.pinned).toBeDefined();
    expect(json.cleanup).toBeDefined();
    expect(json.stateShape).toBeDefined();
    expect(json.carrySemantics).toBeDefined();
    expect(json.errors).toBeDefined();
    expect(json.segmentation).toBeDefined();
    expect(json.overview.mode).toBe("carry_omega_focus");
    expect(json.top.by_handle_count).toHaveLength(2);
    expect(json.top.by_dropped_count[0].ref_key).toBe("Genesis/1/2");
    expect(json.joins).toBeUndefined();
    expect(json.options.join_limit).toBe(250);

    const index = JSON.parse(fs.readFileSync(path.join(outDir, "index.json"), "utf8"));
    expect(index.meta).toEqual({
      mode: "carry_omega_focus",
      from: "Genesis/1/1",
      to: "Genesis/1/3",
      versesSelected: 3
    });
    expect(Array.isArray(index.anomalies)).toBe(true);
    expect(index.byCategory.errors).toBeDefined();

    const markdown = fs.readFileSync(path.join(outDir, "insights.md"), "utf8");
    expect(markdown).toContain("# Continual Run Insights");
    expect(markdown).toContain("## Executive Summary");
    expect(markdown).toContain("## continuity");
    expect(markdown).toContain("## segmentation");
  });

  it("loads per-verse payloads and emits join drill-down when include-joins is enabled", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-joins-"));
    const versesDir = path.join(tmpDir, "verses");
    fs.mkdirSync(versesDir, { recursive: true });

    const verse1 = path.join(versesDir, "001.json");
    const verse2 = path.join(versesDir, "002.json");
    const verse3 = path.join(versesDir, "003.json");

    fs.writeFileSync(
      verse1,
      JSON.stringify(
        {
          verseBoundary: {
            mode: "carry_omega_focus",
            end: { omega: "Ωv:Genesis_1_1", focus: "focus:1", domain: null },
            startNext: { omega: "Ωv:Genesis_1_1", focus: "focus:1", domain: null }
          },
          provenance: {
            handles: {
              "pin:1": ["token:י"]
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(
      verse2,
      JSON.stringify(
        {
          verseBoundary: {
            mode: "carry_omega_focus",
            end: { omega: "Ωv:Genesis_1_2", focus: "focus:2", domain: null },
            startNext: { omega: "Ωv:Genesis_1_2", focus: "focus:2", domain: null }
          },
          provenance: {
            handleOrigins: {
              "pin:2": ["token:ב"]
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(
      verse3,
      JSON.stringify(
        {
          verseBoundary: {
            mode: "carry_omega_focus",
            end: { omega: "Ωv:Genesis_1_3", focus: "focus:3", domain: null },
            startNext: { omega: "Ωv:Genesis_1_3", focus: "focus:3", domain: null }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const fixture = buildSummaryFixture() as {
      continuity: { focusMatches: number; mismatches: { focus: string[] } };
      verses: Array<{
        outputPath: string;
        carryIn: { focus: string | null };
        carryOut: { focus: string | null; pinned: string[] };
      }>;
    };
    fixture.verses[0].outputPath = verse1;
    fixture.verses[1].outputPath = verse2;
    fixture.verses[2].outputPath = verse3;
    fixture.verses[2].carryIn.focus = "focus:DIFF";
    fixture.continuity.focusMatches = 1;
    fixture.continuity.mismatches.focus = [
      "Genesis/1/2 -> Genesis/1/3: expected focus:2, got focus:DIFF"
    ];

    const summaryPath = path.join(tmpDir, "summary.json");
    const outDir = path.join(tmpDir, "insights");
    fs.writeFileSync(summaryPath, JSON.stringify(fixture, null, 2), "utf8");

    const result = await runSummaryInsights({
      summary: summaryPath,
      outDir,
      format: "json",
      topN: 2,
      includeJoins: true,
      joinLimit: 3,
      workspaceRoot: tmpDir
    });

    const json = JSON.parse(fs.readFileSync(result.jsonPath ?? "", "utf8"));
    expect(json.joins.requested).toBe(true);
    expect(json.joinDetails.requested).toBe(true);
    expect(json.joins.available).toBe(true);
    expect(json.joins.join_limit).toBe(3);
    expect(json.joins.verses_selected_for_join).toEqual([2, 3, 1]);
    expect(json.joins.verses_loaded).toBe(3);
    expect(json.joins.verses_skipped_due_to_limit).toEqual({
      count: 0,
      sequences: []
    });
    expect(json.joins.mismatch_transition_coverage).toEqual({
      total_transitions: 1,
      fully_covered_transitions: 1,
      partially_covered_transitions: 0,
      uncovered_transitions: 0,
      current_only_partial_transitions: 0,
      previous_only_partial_transitions: 0
    });
    expect(json.joins.boundary_instrumentation.present_count).toBe(3);
    expect(json.joins.continuity_mismatch_drilldown.mismatch_count).toBe(1);
    expect(
      json.joins.continuity_mismatch_drilldown.diagnosis_counts.boundary_matches_expected_only
    ).toBe(1);
    expect(json.joins.pinned_provenance.mapped_handles).toBeGreaterThanOrEqual(2);
    expect(json.joins.pinned_provenance.top_mapped_handles[0].handleId).toMatch(/^pin:/);
  });

  it("prefers current verse when mismatch pair cannot fully fit within join limit", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-joins-limit-"));
    const versesDir = path.join(tmpDir, "verses");
    fs.mkdirSync(versesDir, { recursive: true });

    const verse1 = path.join(versesDir, "001.json");
    const verse2 = path.join(versesDir, "002.json");
    const verse3 = path.join(versesDir, "003.json");
    fs.writeFileSync(verse1, JSON.stringify({ verseBoundary: { startNext: {}, end: {} } }), "utf8");
    fs.writeFileSync(verse2, JSON.stringify({ verseBoundary: { startNext: {}, end: {} } }), "utf8");
    fs.writeFileSync(verse3, JSON.stringify({ verseBoundary: { startNext: {}, end: {} } }), "utf8");

    const fixture = buildSummaryFixture() as {
      continuity: { focusMatches: number; mismatches: { focus: string[] } };
      verses: Array<{
        outputPath: string;
        carryIn: { focus: string | null };
      }>;
    };
    fixture.verses[0].outputPath = verse1;
    fixture.verses[1].outputPath = verse2;
    fixture.verses[2].outputPath = verse3;
    fixture.verses[2].carryIn.focus = "focus:DIFF";
    fixture.continuity.focusMatches = 1;
    fixture.continuity.mismatches.focus = [
      "Genesis/1/2 -> Genesis/1/3: expected focus:2, got focus:DIFF"
    ];

    const summaryPath = path.join(tmpDir, "summary.json");
    const outDir = path.join(tmpDir, "insights");
    fs.writeFileSync(summaryPath, JSON.stringify(fixture, null, 2), "utf8");

    const result = await runSummaryInsights({
      summary: summaryPath,
      outDir,
      format: "json",
      topN: 2,
      includeJoins: true,
      joinLimit: 1,
      workspaceRoot: tmpDir
    });

    const json = JSON.parse(fs.readFileSync(result.jsonPath ?? "", "utf8"));
    expect(json.joins.verses_selected_for_join).toEqual([3]);
    expect(json.joins.verses_loaded).toBe(1);
    expect(json.joins.verses_skipped_due_to_limit).toEqual({
      count: 2,
      sequences: [2, 1]
    });
    expect(json.joins.mismatch_transition_coverage).toEqual({
      total_transitions: 1,
      fully_covered_transitions: 0,
      partially_covered_transitions: 1,
      uncovered_transitions: 0,
      current_only_partial_transitions: 1,
      previous_only_partial_transitions: 0
    });
    expect(json.joins.continuity_mismatch_drilldown.mismatch_count).toBe(0);
  });

  it("fails cleanly on invalid summary schema", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-invalid-"));
    const summaryPath = path.join(tmpDir, "summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify({ mode: "carry_omega_focus" }), "utf8");

    await expect(
      runSummaryInsights({
        summary: summaryPath,
        outDir: path.join(tmpDir, "insights"),
        format: "json",
        topN: 25,
        includeJoins: false,
        joinLimit: 250,
        workspaceRoot: ""
      })
    ).rejects.toThrow(/Invalid summary\.json/);
  });
});
