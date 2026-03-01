import { describe, expect, it } from "vitest";
import {
  LETTER_OPERATOR_MAP_VERSION,
  classifyLetterOperator,
  isSupportedLetterOperator
} from "../../../src/layers/letters/opMap";

const BASE_LETTERS = [
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ל",
  "מ",
  "נ",
  "ס",
  "ע",
  "פ",
  "צ",
  "ק",
  "ר",
  "ש",
  "ת"
] as const;

const FINAL_FORMS = ["ך", "ם", "ן", "ף", "ץ"] as const;

describe("letter operator map", () => {
  it("exposes a stable, versioned mapping contract", () => {
    expect(LETTER_OPERATOR_MAP_VERSION).toBe("1.0.0");
  });

  it("classifies all base letters deterministically", () => {
    for (const letter of BASE_LETTERS) {
      const first = classifyLetterOperator(letter);
      const second = classifyLetterOperator(letter);

      expect(first).toEqual(second);
      expect(first.op_kind).toBe(letter);
      expect(first.letter).toBe(letter);
      expect(first.features.isFinal).toBe(false);
      expect(first.features.hebrewBlock).toBe(true);
      expect(first.features.isLetter).toBe(true);
    }
  });

  it("classifies final forms explicitly and preserves glyph identity", () => {
    for (const finalLetter of FINAL_FORMS) {
      const result = classifyLetterOperator(finalLetter);
      expect(result.op_kind).toBe(finalLetter);
      expect(result.letter).toBe(finalLetter);
      expect(result.features.isFinal).toBe(true);
      expect(result.features.hebrewBlock).toBe(true);
      expect(result.features.isLetter).toBe(true);
    }
  });

  it("supports all 27 Hebrew letter forms expected by the layer", () => {
    const all = [...BASE_LETTERS, ...FINAL_FORMS];
    for (const letter of all) {
      expect(isSupportedLetterOperator(letter)).toBe(true);
    }
  });

  it("does not classify unexpected chars (error policy)", () => {
    const invalid = ["", " ", "A", "־", "שׁ", "ּ", "1", "/"];
    for (const ch of invalid) {
      expect(isSupportedLetterOperator(ch)).toBe(false);
      expect(() => classifyLetterOperator(ch)).toThrow(/classifyLetterOperator/);
    }
  });
});
