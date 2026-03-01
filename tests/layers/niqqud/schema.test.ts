import { describe, expect, it } from "vitest";
import {
  NIQQUD_IR_VERSION,
  assertNiqqudIRRow,
  formatNiqqudIRJsonl,
  isNiqqudIRRow,
  parseNiqqudIRJsonl,
  type NiqqudIRRow
} from "../../../src/layers/niqqud/schema";

function baseRow(overrides: Partial<NiqqudIRRow> = {}): NiqqudIRRow {
  return {
    kind: "niqqud",
    version: NIQQUD_IR_VERSION,
    gid: "Genesis/1/1#g:0",
    ref_key: "Genesis/1/1",
    g_index: 0,
    raw: { niqqud: ["ְ"] },
    mods: {
      classes: ["SHVA"],
      features: {
        hasDagesh: false,
        shvaKind: "unknown"
      }
    },
    unhandled: [],
    ...overrides
  };
}

describe("niqqud ir schema", () => {
  it("accepts valid rows with optional forward-compat flags", () => {
    const row = baseRow({
      flags: {
        empty: false,
        ambiguous: false,
        normalized_from: []
      }
    });

    expect(isNiqqudIRRow(row)).toBe(true);
    expect(() => assertNiqqudIRRow(row)).not.toThrow();
  });

  it("rejects gid/ref_key/g_index mismatch", () => {
    const row = baseRow({
      gid: "Genesis/1/1#g:9",
      g_index: 0
    });
    expect(() => assertNiqqudIRRow(row)).toThrow(/must match ref_key/);
  });

  it("rejects non-primitive feature values", () => {
    const row = baseRow({
      mods: {
        classes: ["SHVA"],
        features: {
          bad: { nested: true } as unknown as string
        }
      }
    });
    expect(() => assertNiqqudIRRow(row)).toThrow(/string\|number\|boolean/);
  });

  it("formats/parses JSONL deterministically", () => {
    const rows: NiqqudIRRow[] = [
      baseRow({
        gid: "Genesis/1/1#g:1",
        g_index: 1,
        raw: { niqqud: [] },
        mods: { classes: [], features: {} },
        unhandled: [],
        flags: { empty: true, ambiguous: false }
      }),
      baseRow({
        gid: "Genesis/1/1#g:0",
        g_index: 0,
        raw: { niqqud: ["ִ"] },
        mods: { classes: ["HIRIQ"], features: { vowelClass: "i" } },
        unhandled: []
      })
    ];

    const text = formatNiqqudIRJsonl(rows);
    expect(text.endsWith("\n")).toBe(true);

    const parsed = parseNiqqudIRJsonl(text);
    expect(parsed.map((row) => row.gid)).toEqual(["Genesis/1/1#g:0", "Genesis/1/1#g:1"]);
  });
});
