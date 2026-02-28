import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SUMMARY_INSIGHTS_SCRIPT = path.resolve(process.cwd(), "scripts", "summary-insights.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("summary insights pipeline", () => {
  it("reads summary.json and writes insights artifacts", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-pipeline-"));
    const summaryPath = path.join(tmpDir, "summary.json");
    const outDir = path.join(tmpDir, "insights");

    const fixture = {
      mode: "carry_omega_focus",
      from: "Genesis/1/1",
      to: "Genesis/1/2",
      input: "data/torah.json",
      outDir: "outputs/continual-run/sample",
      versesSelected: 2,
      runtimeErrors: 0,
      continuity: {
        expectedTransitions: 1,
        omegaMatches: 1,
        focusMatches: 1,
        domainMatches: 1,
        mismatches: {
          omega: [],
          focus: [],
          domain: []
        }
      },
      sanity: {
        handleCounts: [4, 4],
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
            pinned: [],
            pinnedCount: 0
          },
          stateSize: { handles: 4, links: 1, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
          cleanup: { keptCount: 4, droppedCount: 2 },
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
          stateSize: { handles: 4, links: 1, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
          cleanup: { keptCount: 4, droppedCount: 1 },
          runtimeError: null
        }
      ]
    };
    fs.writeFileSync(summaryPath, JSON.stringify(fixture, null, 2), "utf8");

    const output = runNode([
      SUMMARY_INSIGHTS_SCRIPT,
      `--summary=${summaryPath}`,
      `--out-dir=${outDir}`,
      "--format=both",
      "--top-n=1"
    ]);

    expect(output).toContain("summary-insights: outDir=");
    expect(fs.existsSync(path.join(outDir, "insights.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "insights.md"))).toBe(true);

    const report = JSON.parse(fs.readFileSync(path.join(outDir, "insights.json"), "utf8"));
    expect(report.overview.verses_selected).toBe(2);
    expect(report.top.by_handle_count).toHaveLength(1);
  });
});
