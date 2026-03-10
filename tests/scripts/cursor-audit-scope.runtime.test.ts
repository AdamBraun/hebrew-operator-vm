import { describe, expect, it } from "vitest";
import {
  analyzeCursorAuditWords,
  assertCursorAuditPolicyConsistency,
  loadCursorAuditPolicy,
  renderCursorAuditScopeHeader
} from "@ref/scripts/shared/cursorAuditPolicy";
import { parseArgs } from "@ref/scripts/cursorAuditScope/runtime";

describe("cursor audit scope policy", () => {
  it("keeps the stable allowlist consistent with the exclusions", () => {
    const policy = loadCursorAuditPolicy();
    expect(() => assertCursorAuditPolicyConsistency(policy)).not.toThrow();
  });

  it("classifies stable-only words", () => {
    const result = analyzeCursorAuditWords(["זה"]);
    expect(result.status).toBe("stable-only");
    expect(result.staleWords).toEqual([]);
    expect(result.blockedWords).toEqual([]);
  });

  it("classifies stale-contaminated words", () => {
    const result = analyzeCursorAuditWords(["זאת"]);
    expect(result.status).toBe("stale-contaminated");
    expect(result.staleWords).toHaveLength(1);
    expect(result.staleWords[0]?.staleMatches).toEqual(["א", "ת"]);
    expect(result.blockedWords).toEqual([]);
  });

  it("gives ט precedence over stale contamination", () => {
    const result = analyzeCursorAuditWords(["טא"]);
    expect(result.status).toBe("blocked by `ט`");
    expect(result.blockedWords).toHaveLength(1);
    expect(result.blockedWords[0]?.graphIncompleteMatches).toEqual(["ט"]);
    expect(result.staleWords[0]?.staleMatches).toEqual(["א"]);
  });

  it("renders a markdown scope header with the allowlist and exclusions", () => {
    const result = analyzeCursorAuditWords(["העץ", "זה"]);
    const rendered = renderCursorAuditScopeHeader(result);
    expect(rendered).toContain("## Cursor Audit Scope");
    expect(rendered).toContain("- dataset_status: `stable-only`");
    expect(rendered).toContain("- stable allowlist:");
    expect(rendered).toContain("- stale exclusions:");
    expect(rendered).toContain("- graph-incomplete exclusions:");
  });
});

describe("cursor audit scope cli parsing", () => {
  it("accepts repeated word flags plus verse text", () => {
    const parsed = parseArgs(["--word=זה", "--text", "ומפרי העץ אשר בתוך הגן"]);
    expect(parsed.words).toEqual(["זה", "ומפרי", "העץ", "אשר", "בתוך", "הגן"]);
  });
});
