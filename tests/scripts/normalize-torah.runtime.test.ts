import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPORT,
  DEFAULT_SHA,
  DEFAULT_TEAMIM_OUT,
  DEFAULT_TEAMIM_REPORT,
  DEFAULT_TEAMIM_SHA,
  DEFAULT_OUT,
  buildNormalizationResult,
  normalizeVerse,
  parseArgs
} from "@ref/scripts/normalizeTorah/runtime";

describe("normalize torah runtime", () => {
  it("parses command and options", () => {
    const parsed = parseArgs([
      "verify",
      "--input=/tmp/in.json",
      "--out=/tmp/out.txt",
      "--sha-out=/tmp/out.sha256",
      "--report-out=/tmp/report.md",
      "--keep-teamim"
    ]);

    expect(parsed.command).toBe("verify");
    expect(parsed.opts).toEqual({
      input: "/tmp/in.json",
      out: "/tmp/out.txt",
      shaOut: "/tmp/out.sha256",
      reportOut: "/tmp/report.md",
      keepTeamim: true
    });
  });

  it("uses canonical teamim artifact defaults when --keep-teamim is set", () => {
    const parsedStrip = parseArgs([]);
    expect(parsedStrip.opts.out).toBe(DEFAULT_OUT);
    expect(parsedStrip.opts.shaOut).toBe(DEFAULT_SHA);
    expect(parsedStrip.opts.reportOut).toBe(DEFAULT_REPORT);
    expect(parsedStrip.opts.keepTeamim).toBe(false);

    const parsedKeep = parseArgs(["--keep-teamim"]);
    expect(parsedKeep.opts.out).toBe(DEFAULT_TEAMIM_OUT);
    expect(parsedKeep.opts.shaOut).toBe(DEFAULT_TEAMIM_SHA);
    expect(parsedKeep.opts.reportOut).toBe(DEFAULT_TEAMIM_REPORT);
    expect(parsedKeep.opts.keepTeamim).toBe(true);
  });

  it("normalizes a verse and strips teamim by default", () => {
    const verse = "בְּרֵאשִׁ֖ית";
    const stripped = normalizeVerse(verse, false);
    const kept = normalizeVerse(verse, true);

    expect(stripped.normalized).toBe("בְּרֵאשִׁית");
    expect(kept.normalized).toBe("בְּרֵאשִׁ֖ית");
    expect(stripped.stats.removedTeamim).toBe(1);
    expect(kept.stats.removedTeamim).toBe(0);
    expect(kept.stats.teamimObservedByCodepoint.get("֖".codePointAt(0) ?? 0)).toBe(1);
  });

  it("removes inline markup without splitting words and strips parasha markers", () => {
    const verse = '<big>בְּ</big>רֵאשִׁ֖ית&nbsp;<span class="mam-spi-pe">{פ}</span><br>';
    const kept = normalizeVerse(verse, true);

    expect(kept.normalized).toBe("בְּרֵאשִׁ֖ית");
    expect(kept.normalized).not.toContain("{פ}");
    expect(kept.stats.policyTransformations.get("parasha_markers_removed")).toBe(1);
  });

  it("fails loudly on unsupported combining marks", () => {
    expect(() => normalizeVerse("א\u0301", true, "Genesis 1:1")).toThrow(
      /Unsupported combining mark U\+0301/
    );
    expect(() => normalizeVerse("א\u0301", true, "Genesis 1:1")).toThrow(/Context:/);
  });

  it("builds deterministic normalization output", () => {
    const source = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                { n: 1, he: "<big>בְּ</big>רֵאשִׁ֖ית" },
                { n: 2, he: "וְהָאָֽרֶץ" }
              ]
            }
          ]
        }
      ]
    };

    const first = buildNormalizationResult(source, false);
    const second = buildNormalizationResult(source, false);
    expect(second.normalizedText).toBe(first.normalizedText);
    expect(second.checksum).toBe(first.checksum);
    expect(first.stats.sourceIdempotenceFailures).toBe(0);
    expect(first.stats.outputIdempotenceFailures).toBe(0);
  });
});
