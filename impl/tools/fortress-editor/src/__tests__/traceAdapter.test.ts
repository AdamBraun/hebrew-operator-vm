import { describe, expect, it } from "vitest";
import { applyWord } from "../engine/shape/applyWord";


describe("applyWord", () => {
  it("is deterministic for identical input", () => {
    const input = "בָּ";
    const runA = applyWord(input);
    const runB = applyWord(input);

    expect(runA).toEqual(runB);
  });
});
