import { makeGapId, makeGid } from "./anchors";
import { type NormalizationOptions, normalizeOptions } from "./options";
import { type SpineRecord } from "./schema";
import { normalizeText, splitIntoGraphemes, splitMarks } from "./unicode";

const CONTROL_CHAR = /[\p{Cc}\p{Cf}]/gu;
const WHITESPACE = /\s/u;
const HEBREW_BASE_LETTER = /[\u05D0-\u05EA]/u;
const UNKNOWN_MARK = /^\p{Mn}$/u;

const FINAL_NORMALIZATION_MAP: Readonly<Record<string, string>> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ"
};

type BuildSpineArgs = {
  ref_key: string;
  text: string;
  opts: NormalizationOptions;
};

type GapAccumulator = {
  whitespace: boolean;
  chars: string[];
};

function isHebrewBase(base: string): boolean {
  return HEBREW_BASE_LETTER.test(base);
}

function normalizeFinalLetter(base: string, opts: NormalizationOptions): string {
  if (!opts.normalizeFinals) {
    return base;
  }
  return FINAL_NORMALIZATION_MAP[base] ?? base;
}

function stripControlCharacters(text: string): string {
  return text.replace(CONTROL_CHAR, "");
}

function assertTextInput(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new Error(`buildSpineForRef: text must be string, got ${typeof text}`);
  }
}

function collectGapData(gap: GapAccumulator, grapheme: string, opts: NormalizationOptions): void {
  for (const ch of grapheme) {
    if (WHITESPACE.test(ch)) {
      gap.whitespace = true;
      continue;
    }
    if (opts.preservePunctuation) {
      gap.chars.push(ch);
    }
  }
}

function assertUnknownMarksPolicy(
  otherMarks: readonly string[],
  refKey: string,
  grapheme: string,
  opts: NormalizationOptions
): void {
  if (!opts.errorOnUnknownMark) {
    return;
  }
  const unknown = otherMarks.find((mark) => UNKNOWN_MARK.test(mark));
  if (unknown) {
    const cp = unknown.codePointAt(0);
    const codepoint =
      cp === undefined ? "unknown" : `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    throw new Error(
      `buildSpineForRef: unknown mark ${codepoint} at ref_key=${refKey} grapheme=${JSON.stringify(grapheme)}`
    );
  }
}

/**
 * Convention A (frozen):
 * gap(0), g(0), gap(1), g(1), ... , g(n-1), gap(n)
 * where gap(i) is the gap before g(i), and gap(n) is trailing.
 */
export async function* buildSpineForRef(args: BuildSpineArgs): AsyncGenerator<SpineRecord> {
  const refKey = args.ref_key;
  assertTextInput(args.text);
  const opts = normalizeOptions(args.opts);

  let normalized = normalizeText(args.text, opts.unicodeForm);
  if (opts.stripControlChars) {
    normalized = stripControlCharacters(normalized);
  }

  const graphemes = splitIntoGraphemes(normalized);
  const pendingGap: GapAccumulator = { whitespace: false, chars: [] };

  let gIndex = 0;
  let gapIndex = 0;

  const emitGap = (): SpineRecord => {
    const record: SpineRecord = {
      kind: "gap",
      gapid: makeGapId(refKey, gapIndex),
      ref_key: refKey,
      gap_index: gapIndex,
      raw: {
        whitespace: pendingGap.whitespace,
        chars: pendingGap.chars
      }
    };
    gapIndex += 1;
    pendingGap.whitespace = false;
    pendingGap.chars = [];
    return record;
  };

  for (const grapheme of graphemes) {
    const parsed = splitMarks(grapheme);
    assertUnknownMarksPolicy(parsed.otherMarks, refKey, grapheme, opts);

    if (parsed.base && isHebrewBase(parsed.base)) {
      yield emitGap();

      const baseLetter = normalizeFinalLetter(parsed.base, opts);
      const gRecord: SpineRecord = {
        kind: "g",
        gid: makeGid(refKey, gIndex),
        ref_key: refKey,
        g_index: gIndex,
        base_letter: baseLetter,
        marks_raw: {
          niqqud: parsed.niqqud,
          teamim: parsed.teamim
        },
        raw: {
          text: grapheme
        }
      };
      gIndex += 1;
      yield gRecord;
      continue;
    }

    collectGapData(pendingGap, grapheme, opts);
  }

  yield emitGap();
}
