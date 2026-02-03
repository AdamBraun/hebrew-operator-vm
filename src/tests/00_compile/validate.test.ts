import { describe, expect, it } from "vitest";
import { tokenize } from "../../compile/tokenizer";
import { validateTokens } from "../../compile/validate";
import { CompileError } from "../../compile/types";
import { letterRegistry } from "../../letters/registry";

describe("token validation", () => {
  it("rejects non-Σ letters", () => {
    const tokens = [{ letter: "A", diacritics: [], inside_dot_kind: "none", raw: "A" }];
    expect(() => validateTokens(tokens, letterRegistry)).toThrow(CompileError);
  });

  it("accepts finals ך ם ן ף ץ", () => {
    const tokens = tokenize("ךםןףץ");
    expect(() => validateTokens(tokens, letterRegistry)).not.toThrow();
  });
});
