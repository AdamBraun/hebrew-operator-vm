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
      workspaceRoot: ""
    });
    expect(defaultOutDirForSummary("/tmp/run/summary.json")).toBe("/tmp/run/insights");
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
      includeJoins: true,
      workspaceRoot: process.cwd()
    });

    expect(result.jsonPath).toBe(path.join(outDir, "insights.json"));
    expect(result.markdownPath).toBe(path.join(outDir, "insights.md"));
    expect(fs.existsSync(path.join(outDir, "insights.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "insights.md"))).toBe(true);

    const json = JSON.parse(fs.readFileSync(path.join(outDir, "insights.json"), "utf8"));
    expect(json.overview.mode).toBe("carry_omega_focus");
    expect(json.top.by_handle_count).toHaveLength(2);
    expect(json.top.by_dropped_count[0].ref_key).toBe("Genesis/1/2");
    expect(json.joins.requested).toBe(true);

    const markdown = fs.readFileSync(path.join(outDir, "insights.md"), "utf8");
    expect(markdown).toContain("# Continual Run Insights");
    expect(markdown).toContain("## Top By Dropped Count");
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
        workspaceRoot: ""
      })
    ).rejects.toThrow(/Invalid summary\.json/);
  });
});
