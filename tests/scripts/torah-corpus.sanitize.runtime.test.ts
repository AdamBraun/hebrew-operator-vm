import { describe, expect, it } from "vitest";
import { collectExecutableVerses, sanitizeText } from "@ref/scripts/torahCorpus/runtimePart1";

describe("torah corpus sanitizer", () => {
  it("does not split inline-tagged Hebrew words", () => {
    const raw = '<big>בְּ</big>רֵאשִׁ֖ית&nbsp;<span class="mam-spi-pe">{פ}</span><br>';
    const stripped = sanitizeText(raw, {
      keepTeamim: false,
      normalizeFinals: false
    });
    const kept = sanitizeText(raw, {
      keepTeamim: true,
      normalizeFinals: false
    });

    expect(stripped).toBe("בְּרֵאשִׁית");
    expect(kept).toBe("בְּרֵאשִׁ֖ית");
    expect(kept).not.toContain("בְּ רֵאשִׁ֖ית");
  });

  it("removes sefaria editorial notes from corpus sanitizer", () => {
    const rawWithFootnote =
      'זֶ֣ה סֵ֔פֶר<sup class="footnote-marker">*</sup><i class="footnote">(בספרי תימן <big>סֵ֔</big>פֶר בסמ״ך גדולה)</i> תּוֹלְדֹ֖ת';
    const malformed = "זֶ֣ה סֵ֔פֶרבספרי תימן סֵ֔פֶר בסמך גדולה תּוֹלְדֹ֖ת";
    const expected = sanitizeText("זֶ֣ה סֵ֔פֶר תּוֹלְדֹ֖ת", {
      keepTeamim: true,
      normalizeFinals: false
    });

    const cleanedMarkup = sanitizeText(rawWithFootnote, {
      keepTeamim: true,
      normalizeFinals: false
    });
    const cleanedMalformed = sanitizeText(malformed, {
      keepTeamim: true,
      normalizeFinals: false
    });

    expect(cleanedMarkup).toBe(expected);
    expect(cleanedMarkup).not.toContain("בספרי");
    expect(cleanedMarkup).not.toContain("*");
    expect(cleanedMalformed).toBe(expected);
  });

  it("keeps Genesis 1:1 word boundaries stable in collectExecutableVerses", () => {
    const source = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                {
                  n: 1,
                  he: "<big>בְּ</big>רֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים"
                }
              ]
            }
          ]
        }
      ]
    };

    const collected = collectExecutableVerses(source, {
      lang: "he",
      keepTeamim: true,
      normalizeFinals: false
    });

    expect(collected.verses).toHaveLength(1);
    expect(collected.verses[0].words).toEqual(["בְּרֵאשִׁ֖ית", "בָּרָ֣א", "אֱלֹהִ֑ים"]);
  });
});
