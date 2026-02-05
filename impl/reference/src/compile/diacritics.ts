import { Diacritic, DiacriticKind, DiacriticTier, InsideDotKind } from "./types";

const VOWEL_MARKS: Record<string, { kind: DiacriticKind; tier: DiacriticTier }> = {
  "\u05B0": { kind: "shva", tier: "sof" },
  "\u05B4": { kind: "hiriq", tier: "sof" },
  "\u05B5": { kind: "tzere", tier: "sof" },
  "\u05B6": { kind: "segol", tier: "sof" },
  "\u05B7": { kind: "patach", tier: "sof" },
  "\u05B8": { kind: "kamatz", tier: "sof" },
  "\u05B9": { kind: "holam", tier: "rosh" },
  "\u05BB": { kind: "kubutz", tier: "sof" }
};

const HATAF_MARKS: Record<string, DiacriticKind> = {
  "\u05B1": "segol",
  "\u05B2": "patach",
  "\u05B3": "kamatz"
};

const INSIDE_DOT_MARKS: Record<string, DiacriticKind> = {
  "\u05BC": "dagesh",
  "\u05C1": "shin_dot_right",
  "\u05C2": "shin_dot_left"
};

const DAGESH_LETTERS = new Set(["ב", "ג", "ד", "כ", "ך", "פ", "ף", "ר", "ת"]);

export const HEBREW_MARK_RANGE = /[\u0591-\u05C7]/u;

export function isHebrewCombiningMark(ch: string): boolean {
  return HEBREW_MARK_RANGE.test(ch);
}

export function classifyDiacritic(mark: string): Diacritic[] | null {
  const hataf = HATAF_MARKS[mark];
  if (hataf) {
    return [
      { mark, kind: "shva", tier: "sof" },
      { mark, kind: hataf, tier: "sof" }
    ];
  }
  const vowel = VOWEL_MARKS[mark];
  if (vowel) {
    return [{ mark, kind: vowel.kind, tier: vowel.tier }];
  }
  const inside = INSIDE_DOT_MARKS[mark];
  if (inside) {
    return [{ mark, kind: inside, tier: "toch" }];
  }
  return null;
}

export function classifyInsideDot(baseLetter: string, mark: string): InsideDotKind {
  if (mark === "\u05BC") {
    if (baseLetter === "ו") {
      return "shuruk";
    }
    if (DAGESH_LETTERS.has(baseLetter)) {
      return "dagesh";
    }
    if (baseLetter === "ה") {
      return "mappiq";
    }
    return "none";
  }
  if (baseLetter === "ש" && mark === "\u05C1") {
    return "shin_dot_right";
  }
  if (baseLetter === "ש" && mark === "\u05C2") {
    return "shin_dot_left";
  }
  return "none";
}
