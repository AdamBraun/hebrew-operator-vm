import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CompileError } from "@ref/compile/types";
import { createInitialState } from "@ref/state/state";
import { RuntimeError } from "@ref/vm/errors";
import { runProgram } from "@ref/vm/vm";

const alphabet = ["נ", "ן", "ס", "מ", "ם", " ", "\t", "\n", "\u0591"];

describe("property: no crash", () => {
  it("either succeeds or throws a typed error", () => {
    fc.assert(
      fc.property(fc.stringOf(fc.constantFrom(...alphabet), { maxLength: 20 }), (program) => {
        try {
          runProgram(program, createInitialState());
        } catch (error) {
          expect(error instanceof CompileError || error instanceof RuntimeError).toBe(true);
        }
      }),
      { numRuns: 50 }
    );
  });
});
