import { describe, expect, it } from "vitest";
import { tokenizeWords } from "@ref/compile/tokenizer";

describe("teamim primary accent selection", () => {
  it("prefers disjunctive over conjunctive when both exist on a word", () => {
    const words = tokenizeWords("א֖֣ב");
    expect(words[0].trope.kind).toBe("disj");
    expect(words[0].trope.name).toBe("tipcha");
    expect(words[0].trope.codepoint).toBe("U+0596");
  });

  it("selects the highest-precedence disjunctive", () => {
    const words = tokenizeWords("א֖֑ב");
    expect(words[0].trope.kind).toBe("disj");
    expect(words[0].trope.name).toBe("etnahta");
    expect(words[0].trope.rank).toBe(2);
  });

  it("breaks equal-precedence disjunctive ties by lower codepoint", () => {
    const words = tokenizeWords("א֕֔ב");
    expect(words[0].trope.kind).toBe("disj");
    expect(words[0].trope.name).toBe("zaqef_qatan");
    expect(words[0].trope.codepoint).toBe("U+0594");
  });

  it("when no disjunctive exists, selects the highest-precedence conjunctive", () => {
    const words = tokenizeWords("א֥֤ב");
    expect(words[0].trope.kind).toBe("conj");
    expect(words[0].trope.name).toBe("mahpakh");
    expect(words[0].trope.codepoint).toBe("U+05A4");
  });
});
