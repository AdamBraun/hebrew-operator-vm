import { describe, expect, it } from "vitest";
import {
  NIQQUD_CLASS_ORDER,
  RAW_NIQQUD_MARK_TO_CLASS,
  normalizeNiqqudMarks
} from "../../../src/layers/niqqud/normalize_marks";

describe("normalize niqqud marks", () => {
  it("maps raw niqqud marks to stable classes, deduplicates, and sorts deterministically", () => {
    const out = normalizeNiqqudMarks(["\u05BC", "\u05B8", "\u05B0", "\u05B8", "\u05C7"]);
    expect(out.unhandled).toEqual([]);
    expect(out.normalized).toEqual(["SHVA", "QAMATS", "DAGESH_OR_MAPIQ"]);
  });

  it("normalizes equivalent raw forms into the same class token", () => {
    expect(RAW_NIQQUD_MARK_TO_CLASS["\u05B9"]).toBe("HOLAM");
    expect(RAW_NIQQUD_MARK_TO_CLASS["\u05BA"]).toBe("HOLAM");

    const out = normalizeNiqqudMarks(["\u05BA", "\u05B9", "\u05BA"]);
    expect(out.normalized).toEqual(["HOLAM"]);
    expect(out.unhandled).toEqual([]);
  });

  it("collects unknown marks as unhandled and deduplicates them", () => {
    const out = normalizeNiqqudMarks([
      "\u0596", // teamim (not niqqud class here)
      "\u05C4", // unknown combining mark
      "\u0596",
      "A"
    ]);

    expect(out.normalized).toEqual([]);
    expect(out.unhandled).toEqual(["A", "\u0596", "\u05C4"]);
  });

  it("is input-order independent for normalized output", () => {
    const a = normalizeNiqqudMarks(["\u05B4", "\u05BC", "\u05B0", "\u05B6"]);
    const b = normalizeNiqqudMarks(["\u05B6", "\u05B0", "\u05BC", "\u05B4"]);
    expect(a).toEqual(b);

    const orderIndices = a.normalized.map((entry) => NIQQUD_CLASS_ORDER.indexOf(entry));
    const sortedIndices = [...orderIndices].sort((left, right) => left - right);
    expect(orderIndices).toEqual(sortedIndices);
  });
});
