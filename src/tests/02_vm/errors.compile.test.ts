import { describe, expect, it } from "vitest";
import { tokenize } from "../../compile/tokenizer";
import { CompileError } from "../../compile/types";

describe("compile-time errors", () => {
  it("unknown diacritic mark throws CompileError", () => {
    expect(() => tokenize("נ\u0591")).toThrow(CompileError);
  });

  it("illegal character outside Σ throws CompileError", () => {
    expect(() => tokenize("A")).toThrow(CompileError);
  });
});
