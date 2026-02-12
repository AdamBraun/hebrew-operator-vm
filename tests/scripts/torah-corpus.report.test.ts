import { describe, expect, it } from "vitest";
import {
  formatWarningCounts,
  markdownSafe,
  prettyRef,
  summarizeSemanticVersions,
  totalFromCounts,
  workspaceRelativePath
} from "@ref/scripts/torahCorpus/report";

describe("torah corpus report helpers", () => {
  it("formats workspace-relative paths when possible", () => {
    const absolute = `${process.cwd()}/reports/execution_report.md`;
    expect(workspaceRelativePath(absolute)).toBe("reports/execution_report.md");
  });

  it("formats warning counts in sorted order", () => {
    expect(formatWarningCounts({ WARN_B: 1, WARN_A: 2 })).toBe("WARN_A x2, WARN_B x1");
    expect(formatWarningCounts({})).toBe("none");
  });

  it("summarizes semantic versions", () => {
    expect(summarizeSemanticVersions([])).toBe("unknown");
    expect(summarizeSemanticVersions(["1.0.0"])).toBe("1.0.0");
    expect(summarizeSemanticVersions(["1.0.0", "1.1.0"])).toBe("1.0.0, 1.1.0");
  });

  it("renders pretty refs and markdown-safe text", () => {
    expect(
      prettyRef({
        key: "Genesis/1/1/0",
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 0 }
      })
    ).toBe("Genesis 1:1 (word 0)");
    expect(markdownSafe("a|b")).toBe("a\\|b");
  });

  it("totals warning counts", () => {
    expect(totalFromCounts({ A: 2, B: 3 })).toBe(5);
  });
});
