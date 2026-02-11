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
    const vav = tokenize("וּ");
    const vavWithSof = tokenize("וָּ");
    expect(vav[0].dot_kind).toBe("shuruk");
    expect(vav[0].inside_dot_kind).toBe("shuruk");
    expect(vavWithSof[0].dot_kind).toBe("dagesh");
    expect(vavWithSof[0].inside_dot_kind).toBe("dagesh");
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

  it("unknown combining marks fail fast", () => {
    expect(() => tokenize("נ\u0591")).toThrow(CompileError);
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
