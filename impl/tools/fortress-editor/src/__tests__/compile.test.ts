import { describe, expect, it } from "vitest";
import { applyWord } from "../engine/shape/applyWord";


describe("construction counts", () => {
  it("builds expected structure for a simple word", () => {
    const construction = applyWord("בָּ");
    expect(Object.keys(construction.strokes).length).toBeGreaterThan(0);
    expect(Object.keys(construction.regions).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(construction.anchors).length).toBeGreaterThanOrEqual(7);
    expect(construction.anchors.COURT).toBeDefined();
  });

  it("adds strokes as letters accumulate", () => {
    const construction = applyWord("בא");
    expect(Object.keys(construction.strokes).length).toBeGreaterThan(2);
  });
});
