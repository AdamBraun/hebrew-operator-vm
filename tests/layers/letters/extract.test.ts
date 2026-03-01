import { describe, expect, it } from "vitest";
import { extractLettersIRRecordsForRef } from "../../../src/layers/letters/extract";
import { type SpineRecord } from "../../../src/spine/schema";

const SPINE_DIGEST = "b".repeat(64);

function gap(ref_key: string, gap_index: number, whitespace: boolean): SpineRecord {
  return {
    kind: "gap",
    gapid: `${ref_key}#gap:${String(gap_index)}`,
    ref_key,
    gap_index,
    raw: {
      whitespace,
      chars: []
    }
  };
}

function g(ref_key: string, g_index: number, base_letter: string | null, text = ""): SpineRecord {
  return {
    kind: "g",
    gid: `${ref_key}#g:${String(g_index)}`,
    ref_key,
    g_index,
    base_letter,
    marks_raw: { niqqud: [], teamim: [] },
    raw: { text }
  };
}

describe("letters extraction", () => {
  it("emits word metadata by default", () => {
    const ref = "Genesis/1/1";
    const spineRows: SpineRecord[] = [
      gap(ref, 0, false),
      g(ref, 0, "א", "א"),
      gap(ref, 1, true),
      g(ref, 1, "ך", "ך"),
      gap(ref, 2, false),
      g(ref, 2, null, ","),
      gap(ref, 3, false)
    ];

    const rows = extractLettersIRRecordsForRef({
      spineRecordsForRef: spineRows,
      spineDigest: SPINE_DIGEST
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.word).toEqual({ id: `${ref}#w:0`, index_in_word: 0 });
    expect(rows[1]?.word).toEqual({ id: `${ref}#w:1`, index_in_word: 0 });
    expect(rows[1]?.op_kind).toBe("ך");
    expect(rows[1]?.features?.isFinal).toBe(true);
  });

  it("omits word metadata when includeWordMetadata=false", () => {
    const ref = "Genesis/1/1";
    const spineRows: SpineRecord[] = [
      gap(ref, 0, false),
      g(ref, 0, "א", "א"),
      gap(ref, 1, true),
      g(ref, 1, "ב", "ב"),
      gap(ref, 2, false)
    ];

    const rows = extractLettersIRRecordsForRef({
      spineRecordsForRef: spineRows,
      spineDigest: SPINE_DIGEST,
      includeWordMetadata: false
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.word).toBeUndefined();
    expect(rows[1]?.word).toBeUndefined();
  });

  it("skips unsupported base letters in non-strict mode", () => {
    const ref = "Genesis/1/1";
    const spineRows: SpineRecord[] = [
      gap(ref, 0, false),
      g(ref, 0, "א", "א"),
      gap(ref, 1, false),
      g(ref, 1, "@", "@"),
      gap(ref, 2, false),
      g(ref, 2, null, ","),
      gap(ref, 3, false)
    ];

    const rows = extractLettersIRRecordsForRef({
      spineRecordsForRef: spineRows,
      spineDigest: SPINE_DIGEST,
      strictLetters: false
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.letter).toBe("א");
  });

  it("throws in strict mode for unsupported base letters with local context", () => {
    const ref = "Genesis/1/1";
    const offending = g(ref, 1, "@", "@");
    const spineRows: SpineRecord[] = [
      gap(ref, 0, false),
      g(ref, 0, null, ","),
      gap(ref, 1, false),
      offending,
      gap(ref, 2, false)
    ];

    expect(() =>
      extractLettersIRRecordsForRef({
        spineRecordsForRef: spineRows,
        spineDigest: SPINE_DIGEST,
        strictLetters: true
      })
    ).toThrow(/base_letter="@"/);
    expect(() =>
      extractLettersIRRecordsForRef({
        spineRecordsForRef: spineRows,
        spineDigest: SPINE_DIGEST,
        strictLetters: true
      })
    ).toThrow(new RegExp(`ref_key='${ref}'`));
    expect(() =>
      extractLettersIRRecordsForRef({
        spineRecordsForRef: spineRows,
        spineDigest: SPINE_DIGEST,
        strictLetters: true
      })
    ).toThrow(new RegExp(`gid='${offending.gid}'`));
  });
});
