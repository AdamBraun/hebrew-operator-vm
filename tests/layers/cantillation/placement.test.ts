import { describe, expect, it } from "vitest";
import {
  CANTILLATION_PLACEMENT_POLICY_VERSION,
  placeDisjCutBoundaries,
  placeDisjCutBoundary,
  refEndGapId,
  type DisjMarkPlacementInput
} from "../../../src/layers/cantillation/placement";
import { type SpineRecord } from "../../../src/spine/schema";

function gap(ref_key: string, gap_index: number): SpineRecord {
  return {
    kind: "gap",
    gapid: `${ref_key}#gap:${String(gap_index)}`,
    ref_key,
    gap_index,
    raw: {
      whitespace: false,
      chars: []
    }
  };
}

function g(ref_key: string, g_index: number): SpineRecord {
  return {
    kind: "g",
    gid: `${ref_key}#g:${String(g_index)}`,
    ref_key,
    g_index,
    base_letter: "א",
    marks_raw: {
      niqqud: [],
      teamim: []
    },
    raw: {
      text: "א"
    }
  };
}

describe("cantillation placement policy", () => {
  it("uses policy version 1", () => {
    expect(CANTILLATION_PLACEMENT_POLICY_VERSION).toBe(1);
  });

  it("places a DISJ gid boundary on the next gap in the same ref", () => {
    const ref = "Genesis/1/1";
    const spine: SpineRecord[] = [gap(ref, 0), g(ref, 0), gap(ref, 1), g(ref, 1), gap(ref, 2)];
    const placement = placeDisjCutBoundary({
      input: {
        gid: `${ref}#g:1`,
        ref_key: ref,
        rank: 2,
        mark: "ZAQEF_GADOL"
      },
      spineRecords: spine
    });

    expect(placement.target).toEqual({
      kind: "gap",
      id: `${ref}#gap:2`,
      gap_index: 2
    });
  });

  it("falls back to synthetic ref_end_gap when no following gap exists", () => {
    const ref = "Genesis/1/1";
    const spine: SpineRecord[] = [gap(ref, 0), g(ref, 0), gap(ref, 1), g(ref, 1)];
    const placement = placeDisjCutBoundary({
      input: {
        gid: `${ref}#g:1`,
        ref_key: ref,
        rank: 1,
        mark: "TIPCHA"
      },
      spineRecords: spine
    });

    expect(placement.target).toEqual({
      kind: "ref_end_gap",
      id: refEndGapId(ref),
      after_g_index: 1
    });
  });

  it("produces deterministic placement ordering independent of input order", () => {
    const spine: SpineRecord[] = [
      gap("Genesis/1/2", 0),
      g("Genesis/1/2", 0),
      gap("Genesis/1/2", 1),
      gap("Genesis/1/10", 0),
      g("Genesis/1/10", 0),
      gap("Genesis/1/10", 1),
      g("Genesis/1/10", 1),
      gap("Genesis/1/10", 2)
    ];

    const inputsA: DisjMarkPlacementInput[] = [
      { gid: "Genesis/1/10#g:1", ref_key: "Genesis/1/10", rank: 3, mark: "ZINOR" },
      { gid: "Genesis/1/2#g:0", ref_key: "Genesis/1/2", rank: 1, mark: "TIPCHA" },
      { gid: "Genesis/1/10#g:0", ref_key: "Genesis/1/10", rank: 2, mark: "ZAQEF_GADOL" }
    ];
    const inputsB = [...inputsA].reverse();

    const a = placeDisjCutBoundaries({ inputs: inputsA, spineRecords: spine });
    const b = placeDisjCutBoundaries({ inputs: inputsB, spineRecords: spine });
    expect(b).toEqual(a);
    expect(a).toEqual([
      {
        ref_key: "Genesis/1/2",
        source_gid: "Genesis/1/2#g:0",
        source_mark: "TIPCHA",
        rank: 1,
        target: {
          kind: "gap",
          id: "Genesis/1/2#gap:1",
          gap_index: 1
        }
      },
      {
        ref_key: "Genesis/1/10",
        source_gid: "Genesis/1/10#g:0",
        source_mark: "ZAQEF_GADOL",
        rank: 2,
        target: {
          kind: "gap",
          id: "Genesis/1/10#gap:1",
          gap_index: 1
        }
      },
      {
        ref_key: "Genesis/1/10",
        source_gid: "Genesis/1/10#g:1",
        source_mark: "ZINOR",
        rank: 3,
        target: {
          kind: "gap",
          id: "Genesis/1/10#gap:2",
          gap_index: 2
        }
      }
    ]);
  });

  it("fails on duplicate gaps for the same (ref_key, gap_index)", () => {
    const ref = "Genesis/1/1";
    const spine: SpineRecord[] = [
      gap(ref, 0),
      {
        kind: "gap",
        gapid: `${ref}#gap:0:dupe`,
        ref_key: ref,
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      },
      g(ref, 0)
    ];

    expect(() =>
      placeDisjCutBoundaries({
        inputs: [{ gid: `${ref}#g:0`, ref_key: ref, rank: 1, mark: "TIPCHA" }],
        spineRecords: spine
      })
    ).toThrow(/duplicate gap_index=0/);
  });

  it("fails when gid ref_key does not match input ref_key", () => {
    const ref = "Genesis/1/1";
    const spine: SpineRecord[] = [gap(ref, 0), g(ref, 0), gap(ref, 1)];

    expect(() =>
      placeDisjCutBoundaries({
        inputs: [{ gid: `${ref}#g:0`, ref_key: "Genesis/1/2", rank: 1, mark: "TIPCHA" }],
        spineRecords: spine
      })
    ).toThrow(/must match ref_key/);
  });
});
