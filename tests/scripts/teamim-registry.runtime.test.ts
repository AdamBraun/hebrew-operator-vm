import { describe, expect, it } from "vitest";
import {
  buildArtifacts,
  parseArgs,
  parseInputRecords,
  type TeamimRegistryOptions
} from "@ref/scripts/teamimRegistry/runtime";

const DEFAULT_OPTS: TeamimRegistryOptions = {
  input: "/tmp/torah.normalized.teamim.txt",
  classification: "/tmp/teamim.classification.json",
  registryOut: "/tmp/teamim.registry.json",
  reportOut: "/tmp/teamim_registry_report.md"
};

function fixtureClassification(entries: Record<string, unknown>): string {
  return `${JSON.stringify(
    {
      schema_version: 1,
      selection_policy: {
        primary_accent: {
          class_priority: ["DISJUNCTIVE", "CONJUNCTIVE"],
          precedence: "higher_integer_wins",
          tie_break: "lower_codepoint_wins"
        }
      },
      entries
    },
    null,
    2
  )}\n`;
}

describe("teamim registry runtime", () => {
  it("parses command/options", () => {
    const parsed = parseArgs([
      "verify",
      "--input=/tmp/in.txt",
      "--classification=/tmp/classification.json",
      "--registry-out=/tmp/registry.json",
      "--report-out=/tmp/report.md"
    ]);

    expect(parsed.command).toBe("verify");
    expect(parsed.opts).toEqual({
      input: "/tmp/in.txt",
      classification: "/tmp/classification.json",
      registryOut: "/tmp/registry.json",
      reportOut: "/tmp/report.md"
    });
  });

  it("parses mixed line formats into records", () => {
    const records = parseInputRecords(["Genesis 1:1\tא֖ב", "", "ג֣", ""].join("\n"));

    expect(records).toEqual([
      { ref: "Genesis 1:1", lineNumber: 1, text: "א֖ב" },
      { ref: "line:3", lineNumber: 3, text: "ג֣" }
    ]);
  });

  it("builds deterministic artifacts with complete classification coverage", () => {
    const classification = fixtureClassification({
      "U+0596": {
        codepoint: "U+0596",
        unicode_name: "HEBREW ACCENT TIPEHA",
        hebrew_name: "tipcha",
        class: "DISJUNCTIVE",
        precedence: 100
      },
      "U+05A3": {
        codepoint: "U+05A3",
        unicode_name: "HEBREW ACCENT MUNAH",
        hebrew_name: "munach",
        class: "CONJUNCTIVE",
        precedence: 100
      },
      "U+05A4": {
        codepoint: "U+05A4",
        unicode_name: "HEBREW ACCENT MAHAPAKH",
        hebrew_name: "mahpakh",
        class: "CONJUNCTIVE",
        precedence: 100
      },
      "U+05AA": {
        codepoint: "U+05AA",
        unicode_name: "HEBREW ACCENT YERAH BEN YOMO",
        hebrew_name: "yerah_ben_yomo",
        class: "OTHER",
        precedence: 0
      }
    });

    const input = ["Genesis 1:1\tא֖ ב֣", "Genesis 1:2\tג֤ ד֪", ""].join("\n");
    const first = buildArtifacts(input, classification, DEFAULT_OPTS.input, DEFAULT_OPTS.classification);
    const second = buildArtifacts(input, classification, DEFAULT_OPTS.input, DEFAULT_OPTS.classification);

    expect(second.registryJson).toBe(first.registryJson);
    expect(second.reportText).toBe(first.reportText);

    const registry = JSON.parse(first.registryJson) as {
      stats: {
        teamim_marks_scanned: number;
        observed_codepoints: number;
        observed_classes: { DISJUNCTIVE: number; CONJUNCTIVE: number; OTHER: number };
      };
      observed_teamim: Record<string, { count: number; class: string }>;
    };

    expect(registry.stats.teamim_marks_scanned).toBe(4);
    expect(registry.stats.observed_codepoints).toBe(4);
    expect(registry.stats.observed_classes.DISJUNCTIVE).toBe(1);
    expect(registry.stats.observed_classes.CONJUNCTIVE).toBe(2);
    expect(registry.stats.observed_classes.OTHER).toBe(1);
    expect(registry.observed_teamim["U+0596"]?.count).toBe(1);
    expect(registry.observed_teamim["U+05A3"]?.class).toBe("CONJUNCTIVE");
  });

  it("fails when observed teamim are missing from classification", () => {
    const classification = fixtureClassification({
      "U+0596": {
        codepoint: "U+0596",
        unicode_name: "HEBREW ACCENT TIPEHA",
        hebrew_name: "tipcha",
        class: "DISJUNCTIVE",
        precedence: 100
      }
    });

    expect(() =>
      buildArtifacts("Genesis 1:1\tא֖ ב֣\n", classification, DEFAULT_OPTS.input, DEFAULT_OPTS.classification)
    ).toThrow(/Coverage check failed/);
  });
});
