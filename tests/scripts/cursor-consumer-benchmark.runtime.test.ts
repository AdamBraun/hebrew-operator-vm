import { describe, expect, it } from "vitest";

import {
  assertCursorConsumerBenchmarkConsistency,
  getStableCursorConsumerBenchmarkCases,
  loadCursorConsumerBenchmark
} from "@ref/scripts/shared/cursorConsumerBenchmark";
import {
  analyzeCursorAuditWords,
  loadCursorAuditPolicy
} from "@ref/scripts/shared/cursorAuditPolicy";

describe("cursor consumer benchmark", () => {
  it("loads a fixed suite that satisfies the required coverage", () => {
    const benchmark = loadCursorConsumerBenchmark();
    expect(() => assertCursorConsumerBenchmarkConsistency(benchmark)).not.toThrow();
    expect(benchmark.required_roles).toEqual([
      "demonstrative_zeh",
      "demonstrative_zu",
      "demonstrative_zot",
      "demonstrative_eleh",
      "demonstrative_hazeh",
      "samekh_control_nes",
      "ayin_without_samekh",
      "contains_lamed",
      "contains_he"
    ]);
  });

  it("keeps stable cases aligned with the allowlist and contamination controls outside stable inference", () => {
    const benchmark = loadCursorConsumerBenchmark();
    const policy = loadCursorAuditPolicy();

    for (const entry of benchmark.cases) {
      const analysis = analyzeCursorAuditWords([entry.token], policy);
      if (entry.status === "stable") {
        expect(analysis.status).toBe("stable-only");
        expect(entry.include_in_stable_inference).toBe(true);
      } else {
        expect(analysis.status).toBe("stale-contaminated");
        expect(entry.include_in_stable_inference).toBe(false);
        expect(entry.roles).toContain("contamination_control");
        expect(entry.contamination_reason).toBeTruthy();
      }
    }
  });

  it("exposes a stable-only regression subset with the expected tokens", () => {
    const stableCases = getStableCursorConsumerBenchmarkCases();
    expect(stableCases.map((entry) => entry.token)).toEqual([
      "זה",
      "זו",
      "הזה",
      "נס",
      "העץ",
      "לך",
      "הן"
    ]);
  });

  it("keeps the contaminated controls limited to the required stale demonstratives", () => {
    const benchmark = loadCursorConsumerBenchmark();
    const contaminated = benchmark.cases.filter((entry) => entry.status === "contaminated");
    expect(contaminated.map((entry) => entry.token)).toEqual(["זאת", "אלה"]);
  });

  it("pins the dedicated ל, ה, and ע-without-ס coverage slots to the intended token shapes", () => {
    const benchmark = loadCursorConsumerBenchmark();
    const caseByRole = new Map<string, string>();

    for (const entry of benchmark.cases) {
      for (const role of entry.roles) {
        if (!caseByRole.has(role)) {
          caseByRole.set(role, entry.token);
        }
      }
    }

    expect(caseByRole.get("contains_lamed")).toContain("ל");
    expect(caseByRole.get("contains_he")).toContain("ה");
    expect(caseByRole.get("ayin_without_samekh")).toContain("ע");
    expect(caseByRole.get("ayin_without_samekh")).not.toContain("ס");
  });
});
