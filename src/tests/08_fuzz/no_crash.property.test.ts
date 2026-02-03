import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CompileError } from "../../compile/types";
import { createInitialState } from "../../state/state";
import { RuntimeError } from "../../vm/errors";
import { runProgram } from "../../vm/vm";

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
