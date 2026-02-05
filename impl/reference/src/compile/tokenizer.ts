import { classifyDiacritic, classifyInsideDot, isHebrewCombiningMark } from "./diacritics";
import { CompileError, InsideDotKind, Token } from "./types";

const SPACE_TOKEN = "□";

const HEBREW_LETTERS = new Set([
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ך",
  "ל",
  "מ",
  "ם",
  "נ",
  "ן",
  "ס",
  "ע",
  "פ",
  "ף",
  "צ",
  "ץ",
  "ק",
  "ר",
  "ש",
  "ת"
]);

const WHITESPACE = /\s/u;

export function makeSpaceToken(): Token {
  return {
    letter: SPACE_TOKEN,
    diacritics: [],
    inside_dot_kind: "none",
    raw: SPACE_TOKEN
  };
}

export function tokenize(input: string): Token[] {
  const normalized = input.normalize("NFD");
  const tokens: Token[] = [];
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (char === SPACE_TOKEN || WHITESPACE.test(char)) {
      if (tokens.length === 0 || tokens[tokens.length - 1].letter !== SPACE_TOKEN) {
        tokens.push(makeSpaceToken());
      }
      index += 1;
      continue;
    }

    if (isHebrewCombiningMark(char)) {
      throw new CompileError(`Dangling diacritic at index ${index}`);
    }

    if (!HEBREW_LETTERS.has(char)) {
      throw new CompileError(`Unknown character '${char}' at index ${index}`);
    }

    const letter = char;
    let insideDot: InsideDotKind = "none";
    const diacritics = [];
    let raw = letter;
    index += 1;

    while (index < normalized.length && isHebrewCombiningMark(normalized[index])) {
      const mark = normalized[index];
      raw += mark;
      const diacriticsForMark = classifyDiacritic(mark);
      const insideCandidate = classifyInsideDot(letter, mark);
      if (!diacriticsForMark && insideCandidate === "none") {
        throw new CompileError(`Unsupported diacritic '${mark}' on ${letter}`);
      }
      if (diacriticsForMark) {
        diacritics.push(...diacriticsForMark);
      }
      if (insideCandidate !== "none") {
        if (insideDot !== "none" && insideDot !== insideCandidate) {
          throw new CompileError(`Multiple inside dots on ${letter}`);
        }
        insideDot = insideCandidate;
      }
      index += 1;
    }

    tokens.push({
      letter,
      diacritics,
      inside_dot_kind: insideDot,
      raw,
      meta: {}
    });
  }

  return tokens;
}
