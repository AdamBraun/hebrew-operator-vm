import { describe, expect, it } from "vitest";

import {
  analyzeStableCursorExportDeadness,
  renderCursorExportDeadnessReport
} from "@ref/scripts/shared/cursorExportDeadness";
import { parseArgs, runCursorExportDeadness } from "@ref/scripts/cursorExportDeadness/runtime";

describe("cursor export deadness runtime", () => {
  it("parses defaults and supports report suppression", () => {
    const parsed = parseArgs(["--no-print-report"]);
    expect(parsed.printReport).toBe(false);
    expect(parsed.benchmark).toContain("cursor-consumer-benchmark.v1.json");
    expect(parsed.outReport).toContain("stable_cursor_export_deadness_audit.md");
  });

  it("produces a stable-only summary whose counts reconcile", async () => {
    const summary = await analyzeStableCursorExportDeadness();
    const exportedPoints = summary.cases.flatMap((entry) => entry.exported_points);

    expect(summary.mode).toBe("isolated_stable");
    expect(summary.suite_status).toBe("stable-only");
    expect(summary.stable_case_count).toBe(summary.cases.length);
    expect(summary.counts.total_exported_points).toBe(exportedPoints.length);
    expect(summary.counts.consumed + summary.counts.accompanied + summary.counts.dead).toBe(
      summary.counts.total_exported_points
    );
    expect(
      summary.counts.by_letter["י"] +
        summary.counts.by_letter["ז"] +
        summary.counts.by_letter["ע"] +
        summary.counts.by_letter["ה"]
    ).toBe(summary.counts.total_exported_points);
    expect(summary.counts.by_letter["ז"]).toBeGreaterThan(0);
    expect(summary.counts.by_letter["ע"]).toBeGreaterThan(0);
    expect(summary.counts.by_letter["ה"]).toBeGreaterThan(0);

    const report = renderCursorExportDeadnessReport(summary);
    expect(report).toContain("# Stable Cursor Export Deadness Audit");
    expect(report).toContain("dataset_status: `stable-only`");
  });

  it("returns JSON plus report text through the CLI runtime wrapper", async () => {
    const result = await runCursorExportDeadness(parseArgs(["--no-print-report"]));
    expect(typeof result.reportText).toBe("string");
    expect(result.reportText).toContain("## Totals");
    expect(result.json.mode).toBe("isolated_stable");
  });
});
