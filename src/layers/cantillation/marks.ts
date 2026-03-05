export type TropeClass = "CONJ" | "DISJ";

export type TropeDefaultOp = "CUT" | "CONJ";

export type TropeInfo = {
  name: string;
  codepoint: string;
  class: TropeClass;
  rank: number | null;
  default_op: TropeDefaultOp;
};

export type KnownMarkResolution = {
  kind: "known";
  mark: string;
  info: TropeInfo;
};

export type UnknownMarkResolution = {
  kind: "unknown";
  mark: string;
  event: {
    type: "UNKNOWN_MARK";
    codepoint: string;
    rank: null;
  };
};

export type MarkResolution = KnownMarkResolution | UnknownMarkResolution;

export type CantillationMarkCoverage = {
  marks_seen: number;
  marks_mapped: number;
  marks_unknown: number;
};

const CODEPOINT_KEY_PATTERN = /^U\+([0-9A-F]{4,6})$/u;

function parseCodepointKey(codepoint: string): number {
  const match = codepoint.match(CODEPOINT_KEY_PATTERN);
  if (!match) {
    throw new Error(`cantillation marks: invalid codepoint key '${codepoint}'`);
  }
  return Number.parseInt(match[1] ?? "", 16);
}

function compareCodepointKey(left: string, right: string): number {
  return parseCodepointKey(left) - parseCodepointKey(right);
}

function toCodepointKey(mark: string): string {
  if (typeof mark !== "string" || mark.length === 0) {
    throw new Error("cantillation marks: mark must be non-empty string");
  }
  const chars = Array.from(mark);
  if (chars.length !== 1) {
    throw new Error(`cantillation marks: expected single mark, got '${mark}'`);
  }
  const cp = chars[0].codePointAt(0);
  if (cp === undefined) {
    throw new Error(`cantillation marks: unable to parse codepoint for '${mark}'`);
  }
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function ensureKnownMarkConsistency(table: Record<string, TropeInfo>): void {
  for (const [mark, info] of Object.entries(table)) {
    const derivedCodepoint = toCodepointKey(mark);
    if (derivedCodepoint !== info.codepoint) {
      throw new Error(
        `cantillation marks: key '${mark}' codepoint ${derivedCodepoint} does not match entry ${info.codepoint}`
      );
    }

    if (info.class === "DISJ") {
      if (typeof info.rank !== "number" || !Number.isInteger(info.rank) || info.rank < 1) {
        throw new Error(
          `cantillation marks: DISJ mark '${info.name}' (${info.codepoint}) must define integer rank >= 1`
        );
      }
      if (info.default_op !== "CUT") {
        throw new Error(
          `cantillation marks: DISJ mark '${info.name}' (${info.codepoint}) must default to CUT`
        );
      }
      continue;
    }

    if (info.rank !== null) {
      throw new Error(
        `cantillation marks: CONJ mark '${info.name}' (${info.codepoint}) must use rank=null`
      );
    }
    if (info.default_op !== "CONJ") {
      throw new Error(
        `cantillation marks: CONJ mark '${info.name}' (${info.codepoint}) must default to CONJ`
      );
    }
  }
}

/**
 * Source-of-truth table for observed teamim marks in current corpus policy.
 * Keys are raw Unicode combining marks from `marks_raw.teamim`.
 */
export const TROPE_TABLE: Record<string, TropeInfo> = {
  "\u0591": {
    name: "ETNAHTA",
    codepoint: "U+0591",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0592": {
    name: "SEGOL",
    codepoint: "U+0592",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0593": {
    name: "SHALSHELET",
    codepoint: "U+0593",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0594": {
    name: "ZAQEF_QATAN",
    codepoint: "U+0594",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0595": {
    name: "ZAQEF_GADOL",
    codepoint: "U+0595",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0596": {
    name: "TIPCHA",
    codepoint: "U+0596",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u0597": {
    name: "REVIA",
    codepoint: "U+0597",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u0598": {
    name: "ZARQA",
    codepoint: "U+0598",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u0599": {
    name: "PASHTA",
    codepoint: "U+0599",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u059A": {
    name: "YETIV",
    codepoint: "U+059A",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u059B": {
    name: "TEVIR",
    codepoint: "U+059B",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u059C": {
    name: "GERESH",
    codepoint: "U+059C",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u059E": {
    name: "GERSHAYIM",
    codepoint: "U+059E",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u059F": {
    name: "QARNEY_PARA",
    codepoint: "U+059F",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u05A0": {
    name: "TELISHA_GEDOLA",
    codepoint: "U+05A0",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u05A1": {
    name: "PAZER",
    codepoint: "U+05A1",
    class: "DISJ",
    rank: 2,
    default_op: "CUT"
  },
  "\u05A3": {
    name: "MUNACH",
    codepoint: "U+05A3",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A4": {
    name: "MAHPAKH",
    codepoint: "U+05A4",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A5": {
    name: "MERKHA",
    codepoint: "U+05A5",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A6": {
    name: "MERKHA_KEFULA",
    codepoint: "U+05A6",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A7": {
    name: "DARGA",
    codepoint: "U+05A7",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A8": {
    name: "QADMA",
    codepoint: "U+05A8",
    class: "CONJ",
    rank: null,
    default_op: "CONJ"
  },
  "\u05A9": {
    name: "TELISHA_QETANA",
    codepoint: "U+05A9",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u05AA": {
    name: "YERAH_BEN_YOMO",
    codepoint: "U+05AA",
    class: "DISJ",
    rank: 1,
    default_op: "CUT"
  },
  "\u05AE": {
    name: "ZINOR",
    codepoint: "U+05AE",
    class: "DISJ",
    rank: 3,
    default_op: "CUT"
  }
};

ensureKnownMarkConsistency(TROPE_TABLE);

export const KNOWN_TEAMIM_MARKS: readonly string[] = Object.freeze(
  Object.keys(TROPE_TABLE).sort((left, right) =>
    compareCodepointKey(toCodepointKey(left), toCodepointKey(right))
  )
);

export const KNOWN_TEAMIM_CODEPOINTS: readonly string[] = Object.freeze(
  KNOWN_TEAMIM_MARKS.map((mark) => TROPE_TABLE[mark].codepoint)
);

export function lookupTropeInfo(mark: string): TropeInfo | null {
  if (typeof mark !== "string" || mark.length === 0) {
    return null;
  }
  return TROPE_TABLE[mark] ?? null;
}

export function hasKnownTeamimMark(mark: string): boolean {
  return lookupTropeInfo(mark) !== null;
}

export function createCantillationMarkCoverage(): CantillationMarkCoverage {
  return {
    marks_seen: 0,
    marks_mapped: 0,
    marks_unknown: 0
  };
}

export function resolveCantillationMark(mark: string): MarkResolution {
  const info = lookupTropeInfo(mark);
  if (info) {
    return {
      kind: "known",
      mark,
      info
    };
  }

  const codepoint = toCodepointKey(mark);
  return {
    kind: "unknown",
    mark,
    event: {
      type: "UNKNOWN_MARK",
      codepoint,
      rank: null
    }
  };
}

export function resolveCantillationMarkWithCoverage(
  mark: string,
  coverage: CantillationMarkCoverage
): MarkResolution {
  coverage.marks_seen += 1;
  const resolved = resolveCantillationMark(mark);
  if (resolved.kind === "known") {
    coverage.marks_mapped += 1;
  } else {
    coverage.marks_unknown += 1;
  }
  return resolved;
}
