import { assertSpineRecord, type SpineRecord } from "../../spine/schema";
import { isSupportedLetterOperator } from "./opMap";

export type HebrewLetterContext = {
  ref_key: string;
  gid: string;
};

export function assertSpineRecordShape(record: unknown): asserts record is SpineRecord {
  assertSpineRecord(record);
}

export function isHebrewLetterOperator(letter: unknown): letter is string {
  return typeof letter === "string" && isSupportedLetterOperator(letter);
}

export function assertHebrewLetter(
  letter: unknown,
  context: HebrewLetterContext
): asserts letter is string {
  if (isHebrewLetterOperator(letter)) {
    return;
  }

  throw new Error(
    `letters extractor: unexpected base_letter=${JSON.stringify(letter)} ` +
      `at ref_key='${context.ref_key}' gid='${context.gid}'`
  );
}

export function resolveHebrewLetter(
  letter: unknown,
  context: HebrewLetterContext,
  strict: boolean
): string | null {
  if (letter === null) {
    return null;
  }
  if (isHebrewLetterOperator(letter)) {
    return letter;
  }
  if (strict) {
    assertHebrewLetter(letter, context);
  }
  return null;
}
