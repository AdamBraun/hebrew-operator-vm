import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SUMMARY_COMPARE_SCRIPT = path.resolve(process.cwd(), "scripts", "summary-compare.mjs");
const FIXTURE_ROOT = path.resolve(process.cwd(), "tests", "fixtures", "summary-compare");
const RUN_A_SUMMARY = path.join(FIXTURE_ROOT, "run-a", "summary.json");
const RUN_B_SUMMARY = path.join(FIXTURE_ROOT, "run-b", "summary.json");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("summary compare pipeline", () => {
  it("reads multiple summaries and writes compare artifacts", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-compare-pipeline-"));
    const outDir = path.join(tmpDir, "compare");

    const output = runNode([
      SUMMARY_COMPARE_SCRIPT,
      `--summaries=${RUN_A_SUMMARY},${RUN_B_SUMMARY}`,
      `--out-dir=${outDir}`,
      "--format=both"
    ]);

    expect(output).toContain("summary-compare: outDir=");
    expect(fs.existsSync(path.join(outDir, "compare.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "compare.md"))).toBe(true);

    const report = JSON.parse(fs.readFileSync(path.join(outDir, "compare.json"), "utf8")) as {
      input: { summary_count: number };
      baseline: { mode: string };
      tables: {
        errorRateChange: Array<{ mode: string }>;
        continuityMismatchChange: Array<{ mode: string }>;
      };
    };

    expect(report.input.summary_count).toBe(2);
    expect(report.baseline.mode).toBe("carry_omega");
    expect(report.tables.errorRateChange.map((row) => row.mode)).toEqual([
      "carry_omega_focus",
      "carry_omega"
    ]);
    expect(report.tables.continuityMismatchChange.map((row) => row.mode)).toEqual([
      "carry_omega_focus",
      "carry_omega"
    ]);

    const markdown = fs.readFileSync(path.join(outDir, "compare.md"), "utf8");
    expect(markdown).toContain("## PinnedCount Distribution Change");
  });
});
