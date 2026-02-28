import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSummary, parseRefKey } from "@ref/scripts/summaryInsights/model";

function writeSummaryFixture(tmpDir: string): string {
  const summaryPath = path.join(tmpDir, "summary.json");
  const payload = {
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
        sequence: 2,
        ref_key: "Genesis/1/2",
        outputPath: "outputs/continual-run/sample/verses/002-Genesis_1_2.json",
        carryIn: {
          omega: "Ωv:Genesis_1_1",
          focus: "focus:1",
          domain: null,
          pinned: ["pin:2", "pin:1", "pin:1"],
          pinnedCount: 3
        },
        carryOut: {
          omega: "Ωv:Genesis_1_2",
          focus: "focus:2",
          domain: null,
          pinned: ["pin:2", "pin:1", "pin:1"],
          pinnedCount: 3
        },
        stateSize: { handles: 4, links: 2, boundaries: 0, rules: 0, cont: 0, aliasEdges: 0 },
        cleanup: { keptCount: 4, droppedCount: 10 },
        runtimeError: null,
        extraKey: "ignored"
      },
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
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), "utf8");
  return summaryPath;
}

describe("summary insights model loader", () => {
  it("loads and normalizes summary data", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-model-"));
    const summaryPath = writeSummaryFixture(tmpDir);

    const summary = loadSummary(summaryPath);
    expect(summary.verses).toHaveLength(3);
    expect(summary.verses[0].sequence).toBe(1);
    expect(summary.verses[1].sequence).toBe(2);
    expect(summary.verses[1].carryOut.pinned).toEqual(["pin:1", "pin:2"]);
  });

  it("rejects malformed summary with helpful field path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-model-invalid-"));
    const summaryPath = path.join(tmpDir, "summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify({ mode: "carry_omega_focus", verses: [] }),
      "utf8"
    );

    expect(() => loadSummary(summaryPath)).toThrow(/Invalid summary\.json/);
    expect(() => loadSummary(summaryPath)).toThrow(/from/);
  });

  it("parses ref_key into grouping parts", () => {
    expect(parseRefKey("Genesis/12/3")).toEqual({
      book: "Genesis",
      chapter: 12,
      verse: 3
    });
    expect(() => parseRefKey("bad-ref")).toThrow(/Invalid ref_key/);
  });
});
