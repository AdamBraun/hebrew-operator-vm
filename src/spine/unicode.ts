type NormalizationForm = "NFC" | "NFKD" | "none";

const MARK_NONSPACING = /^\p{Mn}$/u;
const HEBREW_BASE_LETTER = /[\u05D0-\u05EA]/u;

const TEAMIM_START = 0x0591;
const TEAMIM_END = 0x05af;

const NIQQUD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x05b0, 0x05bc],
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c7, 0x05c7]
];

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: "grapheme" | "word" | "sentence" }
) => {
  segment(input: string): Iterable<{ segment: string }>;
};

function isMn(char: string): boolean {
  return MARK_NONSPACING.test(char);
}

function isTeamim(codePoint: number): boolean {
  return codePoint >= TEAMIM_START && codePoint <= TEAMIM_END;
}

function isNiqqud(codePoint: number): boolean {
  return NIQQUD_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function classifyMark(mark: string): "niqqud" | "teamim" | "otherMarks" {
  if (!isMn(mark)) {
    return "otherMarks";
  }
  const codePoint = mark.codePointAt(0) ?? -1;
  if (isTeamim(codePoint)) {
    return "teamim";
  }
  if (isNiqqud(codePoint)) {
    return "niqqud";
  }
  return "otherMarks";
}

function getSegmenterCtor(): SegmenterCtor | null {
  const intlObj = Intl as unknown as { Segmenter?: SegmenterCtor };
  return typeof intlObj.Segmenter === "function" ? intlObj.Segmenter : null;
}

function isHebrewBase(value: string): boolean {
  return HEBREW_BASE_LETTER.test(value);
}

function extractBaseChar(grapheme: string): string {
  for (const ch of grapheme) {
    if (!isMn(ch)) {
      return ch;
    }
  }
  return "";
}

export function normalizeText(input: string, form: NormalizationForm): string {
  if (typeof input !== "string") {
    throw new Error(`normalizeText: expected input string, got ${typeof input}`);
  }
  if (form !== "NFC" && form !== "NFKD" && form !== "none") {
    throw new Error(`normalizeText: unsupported form '${String(form)}'`);
  }
  if (form === "none") {
    return input;
  }
  return input.normalize(form);
}

export function splitIntoGraphemes(input: string): string[] {
  if (typeof input !== "string") {
    throw new Error(`splitIntoGraphemes: expected input string, got ${typeof input}`);
  }
  if (input.length === 0) {
    return [];
  }

  const Segmenter = getSegmenterCtor();
  if (Segmenter) {
    const segmenter = new Segmenter("he", { granularity: "grapheme" });
    const out: string[] = [];
    for (const item of segmenter.segment(input)) {
      out.push(item.segment);
    }
    return out;
  }

  const graphemes: string[] = [];
  for (const char of input) {
    if (isMn(char)) {
      if (graphemes.length === 0) {
        graphemes.push(char);
      } else {
        const lastIndex = graphemes.length - 1;
        const base = extractBaseChar(graphemes[lastIndex]);
        if (isHebrewBase(base)) {
          graphemes[lastIndex] += char;
        } else {
          graphemes.push(char);
        }
      }
      continue;
    }
    graphemes.push(char);
  }
  return graphemes;
}

export function splitMarks(grapheme: string): {
  base: string;
  niqqud: string[];
  teamim: string[];
  otherMarks: string[];
} {
  if (typeof grapheme !== "string") {
    throw new Error(`splitMarks: expected grapheme string, got ${typeof grapheme}`);
  }

  let base = "";
  const niqqud: string[] = [];
  const teamim: string[] = [];
  const otherMarks: string[] = [];

  for (const char of grapheme) {
    if (isMn(char)) {
      const bucket = classifyMark(char);
      if (bucket === "niqqud") {
        niqqud.push(char);
      } else if (bucket === "teamim") {
        teamim.push(char);
      } else {
        otherMarks.push(char);
      }
      continue;
    }

    if (base.length === 0) {
      base = char;
      continue;
    }

    otherMarks.push(char);
  }

  return { base, niqqud, teamim, otherMarks };
}
