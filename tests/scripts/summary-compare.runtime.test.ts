import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, runSummaryCompare } from "@ref/scripts/summaryCompare/runtime";

const FIXTURE_ROOT = path.resolve(process.cwd(), "tests", "fixtures", "summary-compare");
const RUN_A_SUMMARY = path.join(FIXTURE_ROOT, "run-a", "summary.json");
const RUN_B_SUMMARY = path.join(FIXTURE_ROOT, "run-b", "summary.json");
const RUN_C_SUMMARY = path.join(FIXTURE_ROOT, "run-c", "summary.json");

describe("summary compare runtime", () => {
  it("parses args for explicit summaries with defaults", () => {
    const parsed = parseArgs([`--summaries=${RUN_A_SUMMARY},${RUN_B_SUMMARY}`]);
    expect(parsed).toEqual({
      summaries: [RUN_A_SUMMARY, RUN_B_SUMMARY],
      summaryDir: "",
      outDir: path.join(path.dirname(RUN_A_SUMMARY), "compare"),
      format: "both",
      workspaceRoot: ""
    });
  });

  it("parses args for summary-dir with defaults", () => {
    const parsed = parseArgs([`--summary-dir=${FIXTURE_ROOT}`]);
    expect(parsed).toEqual({
      summaries: [],
      summaryDir: FIXTURE_ROOT,
      outDir: path.join(FIXTURE_ROOT, "compare"),
      format: "both",
      workspaceRoot: ""
    });
  });

  it("writes compare artifacts and deterministic sorted tables", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-compare-runtime-"));
    const outDir = path.join(tmpDir, "compare");

    const result = await runSummaryCompare({
      summaries: [RUN_A_SUMMARY, RUN_B_SUMMARY, RUN_C_SUMMARY],
      summaryDir: "",
      outDir,
      format: "both",
      workspaceRoot: process.cwd()
    });

    expect(result.jsonPath).toBe(path.join(outDir, "compare.json"));
    expect(result.markdownPath).toBe(path.join(outDir, "compare.md"));
    expect(fs.existsSync(path.join(outDir, "compare.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "compare.md"))).toBe(true);

    const report = JSON.parse(fs.readFileSync(path.join(outDir, "compare.json"), "utf8")) as {
      baseline: { id: string };
      input: { summary_count: number };
      tables: {
        errorRateChange: Array<{ id: string; mode: string }>;
        continuityMismatchChange: Array<{ id: string }>;
        plateauLevelChange: Array<{ id: string }>;
      };
      deltasFromBaseline: Array<{ id: string; mismatchCountDelta: number }>;
    };

    expect(report.input.summary_count).toBe(3);
    expect(report.baseline.id).toBe("run1");
    expect(report.tables.errorRateChange.map((row) => row.id)).toEqual(["run3", "run2", "run1"]);
    expect(report.tables.errorRateChange.map((row) => row.mode)).toEqual([
      "carry_omega_focus_domain",
      "carry_omega_focus",
      "carry_omega"
    ]);
    expect(report.tables.continuityMismatchChange.map((row) => row.id)).toEqual([
      "run3",
      "run2",
      "run1"
    ]);
    expect(report.tables.plateauLevelChange).toHaveLength(3);
    expect(report.deltasFromBaseline[0]?.id).toBe("run3");
    expect(report.deltasFromBaseline[0]?.mismatchCountDelta).toBe(2);

    const markdown = fs.readFileSync(path.join(outDir, "compare.md"), "utf8");
    expect(markdown).toContain("# Summary Compare Report");
    expect(markdown).toContain("## Error Rate Change");
    expect(markdown).toContain("## Continuity Mismatch Change");
  });

  it("discovers summary.json files from --summary-dir recursively", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-compare-dir-"));
    const outDir = path.join(tmpDir, "compare");

    const result = await runSummaryCompare({
      summaries: [],
      summaryDir: FIXTURE_ROOT,
      outDir,
      format: "json",
      workspaceRoot: process.cwd()
    });

    expect(result.jsonPath).toBe(path.join(outDir, "compare.json"));
    expect(result.markdownPath).toBeNull();
    const report = JSON.parse(fs.readFileSync(path.join(outDir, "compare.json"), "utf8")) as {
      input: { summary_count: number };
      baseline: { mode: string };
      runs: Array<{ mode: string }>;
    };

    expect(report.input.summary_count).toBe(3);
    expect(report.baseline.mode).toBe("carry_omega");
    expect(report.runs.map((row) => row.mode)).toEqual([
      "carry_omega",
      "carry_omega_focus",
      "carry_omega_focus_domain"
    ]);
  });
});
