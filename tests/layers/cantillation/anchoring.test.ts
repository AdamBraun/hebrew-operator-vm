import { describe, expect, it } from "vitest";
import {
  CANTILLATION_ANCHORING_RULES,
  anchorPunctuationBoundaryToGap,
  anchorTropeMarkToGid,
  emitsDerivedBoundariesFromTropeMarks
} from "../../../src/layers/cantillation/anchoring";

describe("cantillation anchoring rules", () => {
  it("freezes deterministic anchoring policy", () => {
    expect(CANTILLATION_ANCHORING_RULES).toEqual({
      version: 1,
      trope_mark_anchor: "gid",
      punctuation_boundary_anchor: "gap",
      derived_boundaries_from_trope_marks: "wrapper"
    });
    expect(emitsDerivedBoundariesFromTropeMarks()).toBe(false);
  });

  it("anchors trope marks to gid", () => {
    const anchor = anchorTropeMarkToGid({
      gid: "Genesis/1/1#g:42",
      ref_key: "Genesis/1/1"
    });
    expect(anchor).toEqual({
      kind: "gid",
      id: "Genesis/1/1#g:42"
    });
  });

  it("anchors punctuation boundaries to gapid", () => {
    const anchor = anchorPunctuationBoundaryToGap({
      gapid: "Genesis/1/1#gap:41",
      ref_key: "Genesis/1/1"
    });
    expect(anchor).toEqual({
      kind: "gap",
      id: "Genesis/1/1#gap:41"
    });
  });

  it("fails on ref_key mismatch", () => {
    expect(() =>
      anchorTropeMarkToGid({
        gid: "Genesis/1/2#g:1",
        ref_key: "Genesis/1/1"
      })
    ).toThrow(/must match ref_key/);
    expect(() =>
      anchorPunctuationBoundaryToGap({
        gapid: "Genesis/1/2#gap:1",
        ref_key: "Genesis/1/1"
      })
    ).toThrow(/must match ref_key/);
  });
});
