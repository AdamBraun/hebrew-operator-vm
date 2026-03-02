import { describe, expect, it } from "vitest";
import { buildNiqqudMods } from "../../../src/layers/niqqud/mods";

describe("build niqqud mods", () => {
  it("returns empty flags/features for empty class list", () => {
    const out = buildNiqqudMods({ classes: [] });
    expect(out.mods.classes).toEqual([]);
    expect(out.mods.features).toEqual({
      hasDagesh: false,
      hasShva: false,
      vowelCount: 0
    });
    expect(out.flags).toEqual({
      empty: true,
      ambiguous: false
    });
  });

  it("computes basic features deterministically", () => {
    const out = buildNiqqudMods({ classes: ["SHVA", "DAGESH_SHURUK_DOT"] });
    expect(out.mods.classes).toEqual(["SHVA", "DAGESH_SHURUK_DOT"]);
    expect(out.mods.features).toEqual({
      hasDagesh: true,
      hasShva: true,
      vowelCount: 1
    });
    expect(out.flags.empty).toBe(false);
    expect(out.flags.ambiguous).toBe(false);
  });

  it("sets ambiguous=true when multiple vowel-like classes co-occur", () => {
    const out = buildNiqqudMods({ classes: ["QAMATS", "HOLAM"] });
    expect(out.mods.features.vowelCount).toBe(2);
    expect(out.flags.ambiguous).toBe(true);
  });

  it("sets ambiguous=true for explicit incompatible class combos", () => {
    const shinDotConflict = buildNiqqudMods({
      classes: ["SHIN_DOT_RIGHT", "SHIN_DOT_LEFT"]
    });
    expect(shinDotConflict.flags.ambiguous).toBe(true);

    const dageshRafeConflict = buildNiqqudMods({
      classes: ["DAGESH_SHURUK_DOT", "RAFE"]
    });
    expect(dageshRafeConflict.flags.ambiguous).toBe(true);
  });
});
