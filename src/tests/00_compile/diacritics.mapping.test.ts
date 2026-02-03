import { describe, expect, it } from "vitest";
import { tokenize } from "../../compile/tokenizer";
import { CompileError } from "../../compile/types";

describe("diacritics mapping", () => {
  it("dagesh is detected for beged-kefet letters", () => {
    const tokens = tokenize("בּ");
    expect(tokens[0].inside_dot_kind).toBe("dagesh");
  });

  it("shuruk is detected only for וּ", () => {
    const vav = tokenize("וּ");
    const bet = tokenize("בּ");
    expect(vav[0].inside_dot_kind).toBe("shuruk");
    expect(bet[0].inside_dot_kind).toBe("dagesh");
  });

  it("shin dot right/left classification", () => {
    const right = tokenize("שׁ");
    const left = tokenize("שׂ");
    expect(right[0].inside_dot_kind).toBe("shin_dot_right");
    expect(left[0].inside_dot_kind).toBe("shin_dot_left");
  });

  it("unknown combining marks fail fast", () => {
    expect(() => tokenize("נ\u0591")).toThrow(CompileError);
  });
});
