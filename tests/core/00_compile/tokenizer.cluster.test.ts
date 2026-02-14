import { describe, expect, it } from "vitest";
import { tokenize, tokenizeWords } from "@ref/compile/tokenizer";

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
    expect(tokensNewline[1].boundary?.mode).toBe("cut");
    expect(tokensNewline[1].boundary?.rank).toBe(3);
    const tokensTab = tokenize("נ\tס");
    expect(tokensTab.map((t) => t.letter)).toEqual(["נ", "□", "ס"]);
    expect(tokensTab[1].boundary?.mode).toBe("hard");
  });

  it("normalizes input (NFD)", () => {
    const tokens = tokenize("נָ");
    const tokensDecomposed = tokenize("נ\u05B8");
    expect(tokens).toEqual(tokensDecomposed);
  });

  it("maps shin/sin dots into explicit token letters", () => {
    const shin = tokenize("שׁ");
    const sin = tokenize("שׂ");
    expect(shin[0].letter).toBe("שׁ");
    expect(sin[0].letter).toBe("שׂ");
  });

  it("extracts trope marks into word metadata and strips them from executable raw clusters", () => {
    const words = tokenizeWords("נ֖ס");
    expect(words.length).toBe(1);
    expect(words[0].trope.kind).toBe("disj");
    expect(words[0].trope.rank).toBe(1);
    expect(words[0].letters[0].raw).toBe("נ");
  });

  it("selects glue/cut boundary modes from the left word trope", () => {
    const conj = tokenize("נ֣ ס");
    const disj = tokenize("נ֖ ס");
    const conjBoundary = conj.find((token) => token.letter === "□");
    const disjBoundary = disj.find((token) => token.letter === "□");
    expect(conjBoundary?.boundary?.mode).toBe("glue");
    expect(disjBoundary?.boundary?.mode).toBe("cut");
    expect(disjBoundary?.boundary?.rank).toBe(1);
  });

  it("treats maqqef as glue boundary even when the left word has no trope", () => {
    const tokens = tokenize("נ־ס");
    expect(tokens.map((token) => token.letter)).toEqual(["נ", "□", "ס"]);
    const boundary = tokens[1];
    expect(boundary.boundary?.mode).toBe("glue_maqqef");
    expect(boundary.boundary?.source).toBe("maqqef");
  });
});
