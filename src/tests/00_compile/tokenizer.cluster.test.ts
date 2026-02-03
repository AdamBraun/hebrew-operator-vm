import { describe, expect, it } from "vitest";
import { tokenize } from "../../compile/tokenizer";

describe("tokenizer cluster formation", () => {
  it("tokenizes Hebrew letter + combining marks as one token", () => {
    const tokens = tokenize("נָ");
    expect(tokens.length).toBe(1);
    expect(tokens[0].letter).toBe("נ");
    expect(tokens[0].diacritics.some((d) => d.kind === "kamatz")).toBe(true);
  });

  it("splits adjacent base letters into separate tokens", () => {
    const tokens = tokenize("נס");
    expect(tokens.length).toBe(2);
    expect(tokens[0].letter).toBe("נ");
    expect(tokens[1].letter).toBe("ס");
  });

  it("collapses whitespace runs into a single □", () => {
    const tokens = tokenize("נ   ס");
    expect(tokens.map((t) => t.letter)).toEqual(["נ", "□", "ס"]);
  });

  it("preserves explicit newline/tab as boundary □", () => {
    const tokensNewline = tokenize("נ\nס");
    expect(tokensNewline.map((t) => t.letter)).toEqual(["נ", "□", "ס"]);
    const tokensTab = tokenize("נ\tס");
    expect(tokensTab.map((t) => t.letter)).toEqual(["נ", "□", "ס"]);
  });

  it("normalizes input (NFD)", () => {
    const tokens = tokenize("נָ");
    const tokensDecomposed = tokenize("נ\u05B8");
    expect(tokens).toEqual(tokensDecomposed);
  });
});
