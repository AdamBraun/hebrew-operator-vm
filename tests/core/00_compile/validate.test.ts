import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { validateTokens } from "@ref/compile/validate";
import { CompileError } from "@ref/compile/types";
import { letterRegistry } from "@ref/letters/registry";

describe("token validation", () => {
  it("rejects non-Σ letters", () => {
    const tokens = [
      {
        letter: "A",
        diacritics: [],
        dot_kind: "none",
        inside_dot_kind: "none",
        is_final: true,
        raw: "A"
      }
    ];
    expect(() => validateTokens(tokens, letterRegistry)).toThrow(CompileError);
  });

  it("accepts finals ך ם ן ף ץ", () => {
    const tokens = tokenize("ךםןףץ");
    expect(() => validateTokens(tokens, letterRegistry)).not.toThrow();
  });
});
