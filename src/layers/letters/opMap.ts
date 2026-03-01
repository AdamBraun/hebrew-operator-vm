export const LETTER_OPERATOR_MAP_VERSION = "1.0.0";

export type LetterOperatorFeatures = {
  isFinal: boolean;
  hebrewBlock: boolean;
  isLetter: true;
};

export type LetterOperatorClassification = {
  op_kind: string;
  letter: string;
  features: LetterOperatorFeatures;
};

type OperatorMapEntry = {
  op_kind: string;
  isFinal: boolean;
};

const FINAL_LETTERS = new Set(["ך", "ם", "ן", "ף", "ץ"]);

/**
 * Versioned, explicit mapping from normalized Hebrew base letters to operator identity.
 * Any change to values here is a contract change for downstream wrapper execution.
 */
const LETTER_OPERATOR_MAP: Readonly<Record<string, OperatorMapEntry>> = Object.freeze({
  א: { op_kind: "א", isFinal: false },
  ב: { op_kind: "ב", isFinal: false },
  ג: { op_kind: "ג", isFinal: false },
  ד: { op_kind: "ד", isFinal: false },
  ה: { op_kind: "ה", isFinal: false },
  ו: { op_kind: "ו", isFinal: false },
  ז: { op_kind: "ז", isFinal: false },
  ח: { op_kind: "ח", isFinal: false },
  ט: { op_kind: "ט", isFinal: false },
  י: { op_kind: "י", isFinal: false },
  כ: { op_kind: "כ", isFinal: false },
  ל: { op_kind: "ל", isFinal: false },
  מ: { op_kind: "מ", isFinal: false },
  נ: { op_kind: "נ", isFinal: false },
  ס: { op_kind: "ס", isFinal: false },
  ע: { op_kind: "ע", isFinal: false },
  פ: { op_kind: "פ", isFinal: false },
  צ: { op_kind: "צ", isFinal: false },
  ק: { op_kind: "ק", isFinal: false },
  ר: { op_kind: "ר", isFinal: false },
  ש: { op_kind: "ש", isFinal: false },
  ת: { op_kind: "ת", isFinal: false },
  ך: { op_kind: "ך", isFinal: true },
  ם: { op_kind: "ם", isFinal: true },
  ן: { op_kind: "ן", isFinal: true },
  ף: { op_kind: "ף", isFinal: true },
  ץ: { op_kind: "ץ", isFinal: true }
});

function isSingleCodePoint(value: string): boolean {
  return [...value].length === 1;
}

function isHebrewBlockCodePoint(letter: string): boolean {
  if (!isSingleCodePoint(letter)) {
    return false;
  }
  const cp = letter.codePointAt(0);
  return cp !== undefined && cp >= 0x0590 && cp <= 0x05ff;
}

export function isSupportedLetterOperator(letter: string): boolean {
  return (
    typeof letter === "string" && Object.prototype.hasOwnProperty.call(LETTER_OPERATOR_MAP, letter)
  );
}

export function classifyLetterOperator(letter: string): LetterOperatorClassification {
  if (typeof letter !== "string" || letter.length === 0) {
    throw new Error("classifyLetterOperator: letter must be a non-empty string");
  }
  if (!isSingleCodePoint(letter)) {
    throw new Error(
      `classifyLetterOperator: expected single base letter code point, got ${JSON.stringify(letter)}`
    );
  }
  if (!isSupportedLetterOperator(letter)) {
    throw new Error(`classifyLetterOperator: unsupported Hebrew letter ${JSON.stringify(letter)}`);
  }

  const entry = LETTER_OPERATOR_MAP[letter];
  const isFinal = FINAL_LETTERS.has(letter) ? true : entry.isFinal;

  return {
    op_kind: entry.op_kind,
    letter,
    features: {
      isFinal,
      hebrewBlock: isHebrewBlockCodePoint(letter),
      isLetter: true
    }
  };
}
