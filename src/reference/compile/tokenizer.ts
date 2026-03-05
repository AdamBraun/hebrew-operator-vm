import { classifyDiacritic, resolveDotKind } from "./diacritics";
import { isCantillationMark, lookupTrope, resolveWordTrope } from "./tropes";
import {
  CompileError,
  DotKind,
  InsideDotKind,
  SpaceBoundary,
  Token,
  Trope,
  WordToken
} from "./types";

const SPACE_TOKEN = "□";
const MAQQEF = "\u05BE";
const SOF_PASUQ = "\u05C3";
const SHIN_DOT_RIGHT = "\u05C1";
const SHIN_DOT_LEFT = "\u05C2";
const COMBINING_MARK = /\p{M}/u;
const WHITESPACE = /\s/u;

const MODERN_PUNCT_MINOR = new Set([","]);
const MODERN_PUNCT_MAJOR = new Set([";", ":", "."]);

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

type ParsedWord = WordToken & {
  boundary_after?: SpaceBoundary;
};

function mergeInsideDot(
  current: InsideDotKind,
  candidate: InsideDotKind,
  letter: string
): InsideDotKind {
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

function punctBoundary(ch: string): SpaceBoundary | null {
  if (ch === SOF_PASUQ) {
    return { mode: "cut", rank: 3, source: "punctuation" };
  }
  if (MODERN_PUNCT_MAJOR.has(ch)) {
    return { mode: "cut", rank: 2, source: "punctuation" };
  }
  if (MODERN_PUNCT_MINOR.has(ch)) {
    return { mode: "cut", rank: 1, source: "punctuation" };
  }
  return null;
}

function boundaryFromWhitespace(ch: string): SpaceBoundary {
  if (ch === "\n" || ch === "\r") {
    return { mode: "cut", rank: 3, source: "punctuation" };
  }
  return { mode: "hard", source: "whitespace" };
}

function selectBoundaryMode(word: WordToken, boundaryHint: SpaceBoundary): SpaceBoundary {
  if (boundaryHint.source === "maqqef") {
    return { mode: "glue_maqqef", source: "maqqef", left_trope: word.trope };
  }
  if (boundaryHint.source === "punctuation") {
    return { ...boundaryHint, left_trope: word.trope };
  }
  if (word.trope.kind === "conj") {
    return { mode: "glue", source: boundaryHint.source, left_trope: word.trope };
  }
  if (word.trope.kind === "disj") {
    return {
      mode: "cut",
      source: boundaryHint.source,
      rank: Number(word.trope.rank ?? 1),
      left_trope: word.trope
    };
  }
  return { mode: "hard", source: boundaryHint.source, left_trope: word.trope };
}

function tokenizeWordsWithBoundaries(input: string): ParsedWord[] {
  const normalized = input.normalize("NFD");
  const words: ParsedWord[] = [];

  let index = 0;
  let currentWordRaw = "";
  let currentLetters: Token[] = [];
  let currentTropeCandidates: Trope[] = [];

  const finalizeWord = (boundaryHint?: SpaceBoundary): void => {
    if (currentLetters.length === 0) {
      return;
    }
    const trope = resolveWordTrope(currentTropeCandidates);
    for (let i = 0; i < currentLetters.length; i += 1) {
      currentLetters[i].is_final = i === currentLetters.length - 1;
      currentLetters[i].trope = trope;
    }

    const word: ParsedWord = {
      text_raw: currentWordRaw,
      letters: currentLetters,
      trope,
      has_maqqef: boundaryHint?.source === "maqqef"
    };
    if (boundaryHint) {
      word.boundary_after = selectBoundaryMode(word, boundaryHint);
    }
    words.push(word);

    currentWordRaw = "";
    currentLetters = [];
    currentTropeCandidates = [];
  };

  while (index < normalized.length) {
    const char = normalized[index];

    if (char === SPACE_TOKEN || WHITESPACE.test(char)) {
      finalizeWord(
        char === SPACE_TOKEN ? { mode: "hard", source: "whitespace" } : boundaryFromWhitespace(char)
      );
      index += 1;
      continue;
    }

    if (char === MAQQEF) {
      finalizeWord({ mode: "glue_maqqef", source: "maqqef" });
      index += 1;
      continue;
    }

    const punctuation = punctBoundary(char);
    if (punctuation) {
      finalizeWord(punctuation);
      index += 1;
      continue;
    }

    if (COMBINING_MARK.test(char)) {
      throw new CompileError(`Dangling diacritic at index ${index}`);
    }

    if (!HEBREW_LETTERS.has(char)) {
      throw new CompileError(`Unknown character '${char}' at index ${index}`);
    }

    const letter = char;
    let letterRaw = letter;
    let execRaw = letter;
    const execMarks: string[] = [];
    index += 1;

    while (index < normalized.length && COMBINING_MARK.test(normalized[index] ?? "")) {
      const mark = normalized[index];
      letterRaw += mark;
      index += 1;

      const trope = lookupTrope(mark);
      if (trope) {
        currentTropeCandidates.push(trope);
        continue;
      }
      if (isCantillationMark(mark)) {
        // Teamim marked as OTHER are ignored by execution.
        continue;
      }

      execMarks.push(mark);
      execRaw += mark;
    }

    const diacritics = [];
    let insideDot: InsideDotKind = "none";

    for (const mark of execMarks) {
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

    const dotKind = resolveDotKind(letter, execMarks);
    if (insideDot === "none") {
      insideDot = insideDotFromDotKind(dotKind);
    }

    const tokenLetter =
      letter === "ש" && insideDot === "shin_dot_right"
        ? "שׁ"
        : letter === "ש" && insideDot === "shin_dot_left"
          ? "שׂ"
          : letter;

    currentWordRaw += letterRaw;
    currentLetters.push({
      letter: tokenLetter,
      diacritics,
      dot_kind: dotKind,
      inside_dot_kind: insideDot,
      is_final: false,
      raw: execRaw,
      meta: {}
    });
  }

  finalizeWord();
  return words;
}

export function tokenizeWords(input: string): WordToken[] {
  return tokenizeWordsWithBoundaries(input).map((word) => ({
    text_raw: word.text_raw,
    letters: word.letters,
    trope: word.trope,
    has_maqqef: word.has_maqqef
  }));
}

export function makeSpaceToken(boundary?: SpaceBoundary): Token {
  return {
    letter: SPACE_TOKEN,
    diacritics: [],
    dot_kind: "none",
    inside_dot_kind: "none",
    is_final: false,
    raw: SPACE_TOKEN,
    boundary: boundary ?? { mode: "hard", source: "whitespace" }
  };
}

export function tokenize(input: string): Token[] {
  const words = tokenizeWordsWithBoundaries(input);
  const tokens: Token[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    for (const letter of word.letters) {
      tokens.push({
        ...letter,
        trope: word.trope,
        word_index: i
      });
    }
    if (word.boundary_after) {
      tokens.push(makeSpaceToken(word.boundary_after));
    }
  }

  return tokens;
}
