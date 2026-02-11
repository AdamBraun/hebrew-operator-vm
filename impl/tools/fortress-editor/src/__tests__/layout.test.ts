import { describe, expect, it } from "vitest";
import { applyWord } from "../engine/shape/applyWord";


describe("construction bounds", () => {
  it("expands bounds as geometry grows", () => {
    const construction = applyWord("באל");
    const { min, max } = construction.bounds;
    expect(max.x).toBeGreaterThan(min.x);
    expect(max.y).toBeGreaterThan(min.y);
  });
});
