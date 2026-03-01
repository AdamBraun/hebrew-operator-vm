import { describe, expect, it } from "vitest";
import { normalizeText, splitIntoGraphemes, splitMarks } from "../../src/spine/unicode";

describe("spine unicode utilities", () => {
  it("normalizes with NFC and NFKD, and preserves input for none", () => {
    const decomposed = "e\u0301";
    const precomposed = "é";

    expect(normalizeText(decomposed, "NFC")).toBe(precomposed);
    expect(normalizeText(precomposed, "NFKD")).toBe(decomposed);
    expect(normalizeText(decomposed, "none")).toBe(decomposed);
  });

  it("rejects unsupported normalization form values at runtime", () => {
    expect(() => normalizeText("abc", "NFD" as unknown as "none")).toThrow(/unsupported form/);
  });

  it("splits Hebrew text into graphemes and preserves full cluster strings", () => {
    const input = "בָּרָא אֱלֹהִ֑ים׃";
    const graphemes = splitIntoGraphemes(input);

    expect(graphemes.join("")).toBe(input);
    expect(graphemes).toContain("בָּ");
    expect(graphemes).toContain("הִ֑");
    expect(graphemes).toContain("׃");
  });

  it("splits base + niqqud + teamim deterministically", () => {
    const parsed = splitMarks("הִ֑");
    expect(parsed).toEqual({
      base: "ה",
      niqqud: ["ִ"],
      teamim: ["֑"],
      otherMarks: []
    });
  });

  it("classifies multiple marks on one letter with preserved order", () => {
    const parsed = splitMarks("שָּׁ֣");
    expect(parsed.base).toBe("ש");
    expect(parsed.niqqud).toEqual(["ׁ", "ּ", "ָ"]);
    expect(parsed.teamim).toEqual(["֣"]);
    expect(parsed.otherMarks).toEqual([]);
  });

  it("routes unknown Mn marks to otherMarks", () => {
    const parsed = splitMarks("ב͏ּ֑");
    expect(parsed.base).toBe("ב");
    expect(parsed.niqqud).toEqual(["ּ"]);
    expect(parsed.teamim).toEqual(["֑"]);
    expect(parsed.otherMarks).toEqual(["͏"]);
  });

  it("keeps teamim boundary classification and routes non-niqqud Hebrew marks to otherMarks", () => {
    const parsed = splitMarks("בֽ֑");
    expect(parsed.base).toBe("ב");
    expect(parsed.teamim).toEqual(["֑"]);
    expect(parsed.niqqud).toEqual([]);
    expect(parsed.otherMarks).toEqual(["ֽ"]);
  });

  it("uses deterministic fallback segmentation when Intl.Segmenter is unavailable", () => {
    const intlObj = Intl as unknown as { Segmenter?: unknown };
    const originalSegmenter = intlObj.Segmenter;
    try {
      intlObj.Segmenter = undefined;
      expect(splitIntoGraphemes("אֱבּ")).toEqual(["אֱ", "בּ"]);
      expect(splitIntoGraphemes("\u05b0א")).toEqual(["\u05b0", "א"]);
      expect(splitIntoGraphemes("א \u05b0ב")).toEqual(["א", " ", "\u05b0", "ב"]);
    } finally {
      intlObj.Segmenter = originalSegmenter;
    }
  });
});
