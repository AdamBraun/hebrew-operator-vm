import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgramWithTrace } from "../../vm/vm";

describe("vm register updates", () => {
  it("after a letter, F becomes output handle and K grows", () => {
    const { trace } = runProgramWithTrace("ה", createInitialState());
    const leading = trace[0];
    const letter = trace[1];

    expect(leading.token).toBe("□");
    expect(letter.token).toBe("ה");
    expect(letter.F).not.toBe(leading.F);
    expect(letter.KLength).toBe(leading.KLength + 1);
  });

  it("after □, OStack_word is resolved", () => {
    const { trace } = runProgramWithTrace("נ", createInitialState());
    const trailing = trace[trace.length - 1];
    expect(trailing.token).toBe("□");
    expect(trailing.OStackLength).toBe(0);
  });
});
