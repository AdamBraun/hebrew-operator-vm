import { describe, expect, it } from "vitest";
import {
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

  it("normalizes a verse and strips teamim by default", () => {
    const verse = "בְּרֵאשִׁ֖ית";
    const stripped = normalizeVerse(verse, false);
    const kept = normalizeVerse(verse, true);

    expect(stripped.normalized).toBe("בְּרֵאשִׁית");
    expect(kept.normalized).toBe("בְּרֵאשִׁ֖ית");
    expect(stripped.stats.removedTeamim).toBe(1);
    expect(kept.stats.removedTeamim).toBe(0);
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
