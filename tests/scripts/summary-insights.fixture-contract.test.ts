import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSummary } from "@ref/scripts/summaryInsights/model";
import { extractContinuity } from "@ref/scripts/summaryInsights/extractors/continuity";
import { extractPinned } from "@ref/scripts/summaryInsights/extractors/pinned";
import { extractCleanup } from "@ref/scripts/summaryInsights/extractors/cleanup";
import { extractStateShape } from "@ref/scripts/summaryInsights/extractors/stateShape";
import { extractCarrySemantics } from "@ref/scripts/summaryInsights/extractors/carrySemantics";
import { extractErrors } from "@ref/scripts/summaryInsights/extractors/errors";
import { extractSegmentation } from "@ref/scripts/summaryInsights/extractors/segmentation";
import { runSummaryInsights } from "@ref/scripts/summaryInsights/runtime";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "summary-insights");
const SUMMARY_FIXTURE_PATH = path.join(FIXTURE_DIR, "summary.fixture.json");
const INSIGHTS_SNAPSHOT_PATH = path.join(FIXTURE_DIR, "insights.expected.json");

function sanitizeInsightsForSnapshot(report: Record<string, unknown>): Record<string, unknown> {
  return {
    ...report,
    generated_at: "<generated_at>"
  };
}

describe("summary insights fixture contracts", () => {
  it("loads and normalizes fixture summary", () => {
    const summary = loadSummary(SUMMARY_FIXTURE_PATH);

    expect(summary.mode).toBe("carry_omega_focus");
    expect(summary.verses).toHaveLength(5);
    expect(summary.verses[1]?.carryOut.pinned).toEqual(["pin:A", "pin:B"]);
    expect(summary.verses[1]?.carryOut.pinnedCount).toBe(2);
  });

  it("extractors expose expected non-empty sections", () => {
    const summary = loadSummary(SUMMARY_FIXTURE_PATH);
    const continuity = extractContinuity(summary);
    const pinned = extractPinned(summary);
    const cleanup = extractCleanup(summary);
    const stateShape = extractStateShape(summary);
    const carrySemantics = extractCarrySemantics(summary);
    const errors = extractErrors(summary);
    const segmentation = extractSegmentation(summary);

    expect(continuity.mismatches.counts.total).toBeGreaterThan(0);
    expect(pinned.churn.transitions).toBeGreaterThan(0);
    expect(cleanup.outliers.topDroppedCount.length).toBeGreaterThan(0);
    expect(stateShape.deltas.topAcrossMetrics.length).toBeGreaterThan(0);
    expect(carrySemantics.rankings.longestFocusRuns.length).toBeGreaterThan(0);
    expect(errors.errorVerses.length).toBeGreaterThan(0);
    expect(segmentation.perBook.length).toBeGreaterThan(0);
    expect(segmentation.perChapter.length).toBeGreaterThan(0);
  });

  it("keeps mode-compliance and pinned churn math stable", () => {
    const summary = loadSummary(SUMMARY_FIXTURE_PATH);
    const continuity = extractContinuity(summary);
    const pinned = extractPinned(summary);

    expect(continuity.modeCompliance.mode).toBe("carry_omega_focus");
    expect(continuity.modeCompliance.expectedNull).toEqual({
      focus: false,
      domain: true
    });
    expect(continuity.modeCompliance.counts.domain).toBe(2);
    expect(continuity.modeCompliance.violations.map((row) => row.field)).toEqual([
      "domain",
      "domain"
    ]);

    expect(pinned.churn.transitions).toBe(4);
    expect(pinned.churn.perTransition[2]).toMatchObject({
      prevSequence: 3,
      sequence: 4,
      added: [],
      removed: ["pin:B"],
      addedCount: 0,
      removedCount: 1,
      jaccard: 0.5
    });
    expect(pinned.churn.totals).toMatchObject({
      added: 0,
      removed: 1,
      zeroChurnTransitions: 3
    });
  });

  it("matches fixture insights snapshot", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "summary-insights-snapshot-"));
    const outDir = path.join(tmpDir, "insights");

    const result = await runSummaryInsights({
      summary: SUMMARY_FIXTURE_PATH,
      outDir,
      format: "json",
      topN: 3,
      includeJoins: true,
      joinLimit: 2,
      workspaceRoot: ""
    });

    const actual = JSON.parse(fs.readFileSync(result.jsonPath ?? "", "utf8")) as Record<
      string,
      unknown
    >;
    const sanitized = sanitizeInsightsForSnapshot(actual);
    const actualText = `${JSON.stringify(sanitized, null, 2)}\n`;
    const expectedText = fs.readFileSync(INSIGHTS_SNAPSHOT_PATH, "utf8");
    expect(actualText).toBe(expectedText);
  });
});
