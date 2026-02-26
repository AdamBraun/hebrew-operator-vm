import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { CompileError } from "@ref/compile/types";

describe("diacritics mapping", () => {
  it("U+05BC defaults to dagesh on non-he/non-shuruk letters", () => {
    const lamed = tokenize("לּ");
    const bet = tokenize("בּ");
    expect(lamed[0].dot_kind).toBe("dagesh");
    expect(lamed[0].inside_dot_kind).toBe("dagesh");
    expect(bet[0].dot_kind).toBe("dagesh");
    expect(bet[0].inside_dot_kind).toBe("dagesh");
  });

  it("shuruk is detected only for the vav carrier pattern", () => {
    const vavDotOnly = tokenize("וּ");
    expect(vavDotOnly[0].dot_kind).toBe("shuruk");
    expect(vavDotOnly[0].inside_dot_kind).toBe("shuruk");

    const sofVowelMarks = [
      "\u05B0", // shva
      "\u05B4", // hiriq
      "\u05B5", // tzere
      "\u05B6", // segol
      "\u05B7", // patach
      "\u05B8", // kamatz
      "\u05BB", // kubutz
      "\u05B1", // hataf segol -> shva + segol
      "\u05B2", // hataf patach -> shva + patach
      "\u05B3", // hataf kamatz -> shva + kamatz
      "\u05C7" // qamatz qatan -> kamatz
    ];

    for (const sofMark of sofVowelMarks) {
      const token = tokenize(`ו${sofMark}\u05BC`)[0];
      expect(token.dot_kind).toBe("dagesh");
      expect(token.inside_dot_kind).toBe("dagesh");
    }
  });

  it("classifies Exodus 29:34 יִוָּתֵר vav-dot as dagesh", () => {
    const tokens = tokenize("יִוָּתֵר");
    expect(tokens[1].raw).toBe("וָּ");
    expect(tokens[1].dot_kind).toBe("dagesh");
    expect(tokens[1].inside_dot_kind).toBe("dagesh");
  });

  it("he + U+05BC resolves to mappiq", () => {
    const yah = tokenize("יָהּ");
    const lah = tokenize("לָהּ");
    expect(yah[1].dot_kind).toBe("mappiq");
    expect(yah[1].inside_dot_kind).toBe("mappiq");
    expect(lah[1].dot_kind).toBe("mappiq");
    expect(lah[1].inside_dot_kind).toBe("mappiq");
  });

  it("shin dot right/left classification", () => {
    const right = tokenize("שׁ");
    const left = tokenize("שׂ");
    expect(right[0].letter).toBe("שׁ");
    expect(left[0].letter).toBe("שׂ");
    expect(right[0].inside_dot_kind).toBe("shin_dot_right");
    expect(left[0].inside_dot_kind).toBe("shin_dot_left");
  });

  it("shin/sin dot can coexist with dagesh on ש", () => {
    const shin = tokenize("שּׁ");
    const sin = tokenize("שּׂ");
    expect(shin[0].letter).toBe("שׁ");
    expect(shin[0].inside_dot_kind).toBe("shin_dot_right");
    expect(shin[0].dot_kind).toBe("dagesh");
    expect(sin[0].letter).toBe("שׂ");
    expect(sin[0].inside_dot_kind).toBe("shin_dot_left");
    expect(sin[0].dot_kind).toBe("dagesh");
  });

  it("unknown non-trope combining marks fail fast", () => {
    expect(() => tokenize("נ\u05C4")).toThrow(CompileError);
  });

  it("hataf marks normalize to shva + base vowel", () => {
    const segol = tokenize("א\u05B1");
    const patach = tokenize("א\u05B2");
    const kamatz = tokenize("א\u05B3");

    expect(segol[0].diacritics.map((d) => d.kind)).toEqual(["shva", "segol"]);
    expect(patach[0].diacritics.map((d) => d.kind)).toEqual(["shva", "patach"]);
    expect(kamatz[0].diacritics.map((d) => d.kind)).toEqual(["shva", "kamatz"]);
  });
});
