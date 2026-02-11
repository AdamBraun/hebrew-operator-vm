import { classifyDiacritic, isHebrewCombiningMark, resolveDotKind } from "./diacritics";
import { CompileError, DotKind, InsideDotKind, Token } from "./types";

const SPACE_TOKEN = "□";
const SHIN_DOT_RIGHT = "\u05C1";
const SHIN_DOT_LEFT = "\u05C2";

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

function mergeInsideDot(current: InsideDotKind, candidate: InsideDotKind, letter: string): InsideDotKind {
  if (candidate === "none") {
    return current;
  }
  if (current !== "none" && current !== candidate) {
    throw new CompileError(`Multiple inside dots on ${letter}`);
  }
  return candidate;
}

function insideDotFromDotKind(dotKind: DotKind): InsideDotKind {
  return dotKind === "none" ? "none" : dotKind;
}

export function makeSpaceToken(): Token {
  return {
    letter: SPACE_TOKEN,
    diacritics: [],
    dot_kind: "none",
    inside_dot_kind: "none",
    is_final: false,
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
    const marks: string[] = [];
    let raw = letter;
    index += 1;

    while (index < normalized.length && isHebrewCombiningMark(normalized[index])) {
      const mark = normalized[index];
      marks.push(mark);
      raw += mark;
      index += 1;
    }

    const diacritics = [];
    let insideDot: InsideDotKind = "none";

    for (const mark of marks) {
      const diacriticsForMark = classifyDiacritic(mark);
      if (!diacriticsForMark) {
        throw new CompileError(`Unsupported diacritic '${mark}' on ${letter}`);
      }
      diacritics.push(...diacriticsForMark);

      if (letter === "ש" && mark === SHIN_DOT_RIGHT) {
        insideDot = mergeInsideDot(insideDot, "shin_dot_right", letter);
      }
      if (letter === "ש" && mark === SHIN_DOT_LEFT) {
        insideDot = mergeInsideDot(insideDot, "shin_dot_left", letter);
      }
    }

    const dotKind = resolveDotKind(letter, marks);
    if (insideDot === "none") {
      insideDot = insideDotFromDotKind(dotKind);
    }

    const tokenLetter =
      letter === "ש" && insideDot === "shin_dot_right"
        ? "שׁ"
        : letter === "ש" && insideDot === "shin_dot_left"
          ? "שׂ"
          : letter;

    tokens.push({
      letter: tokenLetter,
      diacritics,
      dot_kind: dotKind,
      inside_dot_kind: insideDot,
      is_final: false,
      raw,
      meta: {}
    });
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.letter === SPACE_TOKEN) {
      token.is_final = false;
      continue;
    }
    token.is_final = i === tokens.length - 1 || tokens[i + 1].letter === SPACE_TOKEN;
  }

  return tokens;
}
