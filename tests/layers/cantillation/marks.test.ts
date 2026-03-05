import { describe, expect, it } from "vitest";
import {
  KNOWN_TEAMIM_CODEPOINTS,
  KNOWN_TEAMIM_MARKS,
  TROPE_TABLE,
  createCantillationMarkCoverage,
  hasKnownTeamimMark,
  lookupTropeInfo,
  resolveCantillationMark,
  resolveCantillationMarkWithCoverage
} from "../../../src/layers/cantillation/marks";

describe("cantillation marks mapping", () => {
  it("exposes deterministic known mark inventory", () => {
    expect(KNOWN_TEAMIM_MARKS.length).toBe(25);
    expect(KNOWN_TEAMIM_CODEPOINTS[0]).toBe("U+0591");
    expect(KNOWN_TEAMIM_CODEPOINTS[KNOWN_TEAMIM_CODEPOINTS.length - 1]).toBe("U+05AE");

    const uniqueCodepoints = new Set(KNOWN_TEAMIM_CODEPOINTS);
    expect(uniqueCodepoints.size).toBe(KNOWN_TEAMIM_CODEPOINTS.length);

    expect(hasKnownTeamimMark("\u0596")).toBe(true);
    expect(hasKnownTeamimMark("\u05A4")).toBe(true);
    expect(hasKnownTeamimMark("\u05AD")).toBe(false);
  });

  it("maps disjunctive marks to CUT with integer rank", () => {
    const tipcha = lookupTropeInfo("\u0596");
    expect(tipcha).toEqual({
      name: "TIPCHA",
      codepoint: "U+0596",
      class: "DISJ",
      rank: 1,
      default_op: "CUT"
    });

    const zinor = lookupTropeInfo("\u05AE");
    expect(zinor?.class).toBe("DISJ");
    expect(zinor?.rank).toBe(3);
    expect(zinor?.default_op).toBe("CUT");
  });

  it("maps conjunctive marks to CONJ with null rank", () => {
    const munach = lookupTropeInfo("\u05A3");
    expect(munach).toEqual({
      name: "MUNACH",
      codepoint: "U+05A3",
      class: "CONJ",
      rank: null,
      default_op: "CONJ"
    });
  });

  it("returns UNKNOWN_MARK for unknown teamim and does not guess rank", () => {
    const unknown = resolveCantillationMark("\u05AD");
    expect(unknown).toEqual({
      kind: "unknown",
      mark: "\u05AD",
      event: {
        type: "UNKNOWN_MARK",
        codepoint: "U+05AD",
        rank: null
      }
    });
  });

  it("tracks seen/mapped/unknown coverage counters", () => {
    const coverage = createCantillationMarkCoverage();

    const one = resolveCantillationMarkWithCoverage("\u0596", coverage);
    const two = resolveCantillationMarkWithCoverage("\u05A4", coverage);
    const three = resolveCantillationMarkWithCoverage("\u05AD", coverage);

    expect(one.kind).toBe("known");
    expect(two.kind).toBe("known");
    expect(three.kind).toBe("unknown");

    expect(coverage).toEqual({
      marks_seen: 3,
      marks_mapped: 2,
      marks_unknown: 1
    });
  });

  it("keeps table entries codepoint-consistent", () => {
    for (const [mark, info] of Object.entries(TROPE_TABLE)) {
      const cp = mark.codePointAt(0);
      expect(cp).toBeDefined();
      const normalized = `U+${(cp ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
      expect(info.codepoint).toBe(normalized);
    }
  });
});
