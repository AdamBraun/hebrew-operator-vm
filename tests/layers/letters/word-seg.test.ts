import { describe, expect, it } from "vitest";
import { type SpineRecord } from "../../../src/spine/schema";
import { assignWordIds } from "../../../src/layers/letters/wordSeg";

function gap(
  ref_key: string,
  gap_index: number,
  whitespace: boolean,
  extraRaw: Record<string, unknown> = {}
): SpineRecord {
  return {
    kind: "gap",
    gapid: `${ref_key}#gap:${String(gap_index)}`,
    ref_key,
    gap_index,
    raw: {
      whitespace,
      chars: [],
      ...extraRaw
    }
  };
}

function g(
  ref_key: string,
  g_index: number,
  base_letter: string | null,
  rawText?: string
): SpineRecord {
  return {
    kind: "g",
    gid: `${ref_key}#g:${String(g_index)}`,
    ref_key,
    g_index,
    base_letter,
    marks_raw: { niqqud: [], teamim: [] },
    raw: { text: rawText ?? base_letter ?? "" }
  };
}

describe("letters word segmentation", () => {
  it("derives stable word ids from raw whitespace gaps only", () => {
    const ref = "Genesis/1/1";
    const rows: SpineRecord[] = [
      gap(ref, 0, true),
      g(ref, 0, "א"),
      gap(ref, 1, true),
      g(ref, 1, "ב"),
      gap(ref, 2, false, { maqaf_char: true }),
      g(ref, 2, "ג"),
      gap(ref, 3, true),
      g(ref, 3, null, ","), // ignored non-letter grapheme
      gap(ref, 4, true),
      g(ref, 4, "ד"),
      gap(ref, 5, true)
    ];

    const byGid = assignWordIds(rows);
    expect(byGid.size).toBe(4);

    expect(byGid.get(`${ref}#g:0`)).toEqual({
      wordId: `${ref}#w:0`,
      indexInWord: 0
    });
    expect(byGid.get(`${ref}#g:1`)).toEqual({
      wordId: `${ref}#w:1`,
      indexInWord: 0
    });
    expect(byGid.get(`${ref}#g:2`)).toEqual({
      wordId: `${ref}#w:1`,
      indexInWord: 1
    });
    expect(byGid.get(`${ref}#g:4`)).toEqual({
      wordId: `${ref}#w:2`,
      indexInWord: 0
    });
  });

  it("rejects mixed ref streams (expects one ref_key)", () => {
    const rows: SpineRecord[] = [
      gap("Genesis/1/1", 0, false),
      g("Genesis/1/1", 0, "א"),
      gap("Genesis/1/2", 0, false)
    ];
    expect(() => assignWordIds(rows)).toThrow(/one ref_key/);
  });

  it("rejects duplicate gids", () => {
    const ref = "Genesis/1/1";
    const rows: SpineRecord[] = [
      gap(ref, 0, false),
      g(ref, 0, "א"),
      gap(ref, 1, false),
      g(ref, 0, "ב")
    ];
    expect(() => assignWordIds(rows)).toThrow(/duplicate gid/);
  });
});
