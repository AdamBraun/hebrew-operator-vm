import { describe, expect, it } from "vitest";
import { NIQQUD_CLASS_ORDER } from "../../../src/layers/niqqud/classes";
import { RAW_NIQQUD_TO_CLASS } from "../../../src/layers/niqqud/map";

describe("niqqud class map", () => {
  it("includes required baseline class vocabulary", () => {
    const required = [
      "DAGESH_SHURUK_DOT",
      "SHVA",
      "HOLAM",
      "HIRIQ",
      "SEGOL",
      "TSERE",
      "PATAH",
      "QAMATS",
      "QUBUTS",
      "HATAF_SEGOL",
      "HATAF_PATAH",
      "HATAF_QAMATS"
    ];

    for (const entry of required) {
      expect(NIQQUD_CLASS_ORDER.includes(entry as (typeof NIQQUD_CLASS_ORDER)[number])).toBe(true);
    }
  });

  it("maps required raw marks and keeps meteg excluded", () => {
    expect(RAW_NIQQUD_TO_CLASS["\u05BC"]).toBe("DAGESH_SHURUK_DOT");
    expect(RAW_NIQQUD_TO_CLASS["\u05B0"]).toBe("SHVA");
    expect(RAW_NIQQUD_TO_CLASS["\u05B9"]).toBe("HOLAM");
    expect(RAW_NIQQUD_TO_CLASS["\u05B4"]).toBe("HIRIQ");
    expect(RAW_NIQQUD_TO_CLASS["\u05B6"]).toBe("SEGOL");
    expect(RAW_NIQQUD_TO_CLASS["\u05B5"]).toBe("TSERE");
    expect(RAW_NIQQUD_TO_CLASS["\u05B7"]).toBe("PATAH");
    expect(RAW_NIQQUD_TO_CLASS["\u05B8"]).toBe("QAMATS");
    expect(RAW_NIQQUD_TO_CLASS["\u05BB"]).toBe("QUBUTS");
    expect(RAW_NIQQUD_TO_CLASS["\u05B1"]).toBe("HATAF_SEGOL");
    expect(RAW_NIQQUD_TO_CLASS["\u05B2"]).toBe("HATAF_PATAH");
    expect(RAW_NIQQUD_TO_CLASS["\u05B3"]).toBe("HATAF_QAMATS");

    expect(RAW_NIQQUD_TO_CLASS["\u05BD"]).toBeUndefined();
  });
});
