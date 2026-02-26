import { Diacritic, DiacriticKind, DiacriticTier, DotKind } from "./types";

const VOWEL_MARKS: Record<string, { kind: DiacriticKind; tier: DiacriticTier }> = {
  "\u05B0": { kind: "shva", tier: "sof" },
  "\u05B4": { kind: "hiriq", tier: "sof" },
  "\u05B5": { kind: "tzere", tier: "sof" },
  "\u05B6": { kind: "segol", tier: "sof" },
  "\u05B7": { kind: "patach", tier: "sof" },
  "\u05B8": { kind: "kamatz", tier: "sof" },
  "\u05C7": { kind: "kamatz", tier: "sof" },
  "\u05B9": { kind: "holam", tier: "rosh" },
  "\u05BB": { kind: "kubutz", tier: "sof" }
};

const HATAF_MARKS: Record<string, DiacriticKind> = {
  "\u05B1": "segol",
  "\u05B2": "patach",
  "\u05B3": "kamatz"
};

const HATAF_COMPOSITE_KIND: Record<string, "hataf_segol" | "hataf_patach" | "hataf_kamatz"> = {
  "\u05B1": "hataf_segol",
  "\u05B2": "hataf_patach",
  "\u05B3": "hataf_kamatz"
};

const INSIDE_DOT_MARKS: Record<string, DiacriticKind> = {
  "\u05BC": "dagesh",
  "\u05C1": "shin_dot_right",
  "\u05C2": "shin_dot_left"
};

const DAGESH_MARK = "\u05BC";
const SOF_VOWEL_MARKS = new Set([
  ...Object.entries(VOWEL_MARKS)
    .filter(([, value]) => value.tier === "sof")
    .map(([mark]) => mark),
  ...Object.keys(HATAF_MARKS)
]);

export const HEBREW_MARK_RANGE = /[\u0591-\u05C7]/u;

export function isHebrewCombiningMark(ch: string): boolean {
  return HEBREW_MARK_RANGE.test(ch);
}

export function classifyDiacritic(mark: string): Diacritic[] | null {
  const hataf = HATAF_MARKS[mark];
  if (hataf) {
    const compositeKind = HATAF_COMPOSITE_KIND[mark];
    return [
      {
        mark,
        kind: "shva",
        tier: "sof",
        composite: {
          kind: compositeKind,
          role: "carrier_shva"
        }
      },
      {
        mark,
        kind: hataf,
        tier: "sof",
        composite: {
          kind: compositeKind,
          role: "reduced_vowel"
        }
      }
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

export function resolveDotKind(baseLetter: string, marks: string[]): DotKind {
  if (!marks.includes(DAGESH_MARK)) {
    return "none";
  }
  if (baseLetter === "ה") {
    return "mappiq";
  }
  if (baseLetter === "ו") {
    const hasOtherSofVowel = marks.some(
      (mark) => mark !== DAGESH_MARK && SOF_VOWEL_MARKS.has(mark)
    );
    if (!hasOtherSofVowel) {
      return "shuruk";
    }
  }
  return "dagesh";
}
