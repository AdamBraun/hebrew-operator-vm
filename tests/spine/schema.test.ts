import { describe, expect, it } from "vitest";
import { assertSpineRecord, isSpineRecord, type SpineRecord } from "../../src/spine/schema";

describe("spine schema validators", () => {
  it("accepts valid grapheme and gap records", () => {
    const g: SpineRecord = {
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      base_letter: "ב",
      marks_raw: { niqqud: ["ּ", "ָ"], teamim: [] },
      raw: { text: "בָּ" }
    };
    const gap: SpineRecord = {
      kind: "gap",
      gapid: "Genesis/1/1#gap:1",
      ref_key: "Genesis/1/1",
      gap_index: 1,
      raw: { whitespace: true, chars: [] }
    };

    expect(isSpineRecord(g)).toBe(true);
    expect(isSpineRecord(gap)).toBe(true);
    expect(() => assertSpineRecord(g)).not.toThrow();
    expect(() => assertSpineRecord(gap)).not.toThrow();
  });

  it("rejects missing required fields with a path-aware error", () => {
    const invalid = {
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      base_letter: "ב",
      marks_raw: { niqqud: [] },
      raw: { text: "ב" }
    };

    expect(isSpineRecord(invalid)).toBe(false);
    expect(() => assertSpineRecord(invalid)).toThrow(/\$\.marks_raw\.teamim/);
  });

  it("rejects wrong nested field types with readable path", () => {
    const invalid = {
      kind: "gap",
      gapid: "Genesis/1/1#gap:0",
      ref_key: "Genesis/1/1",
      gap_index: 0,
      raw: { whitespace: "yes", chars: [] }
    };

    expect(isSpineRecord(invalid)).toBe(false);
    expect(() => assertSpineRecord(invalid)).toThrow(/\$\.raw\.whitespace/);
  });

  it("rejects unknown fields in strict assertion mode", () => {
    const invalid = {
      kind: "g",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      base_letter: "ב",
      marks_raw: { niqqud: [], teamim: [] },
      raw: { text: "ב" },
      extra: true
    };

    expect(isSpineRecord(invalid)).toBe(true);
    expect(() => assertSpineRecord(invalid)).toThrow(/unknown field 'extra'/);
  });

  it("rejects unsupported kind values", () => {
    const invalid = {
      kind: "word",
      ref_key: "Genesis/1/1"
    };

    expect(isSpineRecord(invalid)).toBe(false);
    expect(() => assertSpineRecord(invalid)).toThrow(/\$\.kind/);
  });
});
