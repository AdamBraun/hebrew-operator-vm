import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createInitialState, serializeState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

const alphabet = ["נ", "ן", "ס", "מ", "ם", " ", "\t", "\n"];

describe("property: determinism", () => {
  it("produces identical states for identical input", () => {
    fc.assert(
      fc.property(fc.stringOf(fc.constantFrom(...alphabet), { maxLength: 20 }), (program) => {
        const runOutcome = () => {
          try {
            const state = runProgram(program, createInitialState());
            return { ok: true as const, state: serializeState(state) };
          } catch (error) {
            const err = error as Error;
            return { ok: false as const, name: err.name, message: err.message };
          }
        };

        const outcomeA = runOutcome();
        const outcomeB = runOutcome();
        expect(outcomeA).toEqual(outcomeB);
      }),
      { numRuns: 50 }
    );
  });
});
