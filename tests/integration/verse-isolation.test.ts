import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeText, type IterateTorahOptions } from "@ref/scripts/iterateTorah/runtime";
import { parseRefKey } from "@ref/scripts/pasukTrace/runtime";
import { finalizeVerse, type VerseSnapshot } from "@ref/runtime/finalizeVerse";
import { createInitialState, type State } from "@ref/state/state";
import { canonicalStringify } from "@ref/trace/hash";
import { runProgramWithTrace } from "@ref/vm/vm";

type TorahVerse = {
  n?: number;
  he?: string;
};

type TorahChapter = {
  n?: number;
  verses?: TorahVerse[];
};

type TorahBook = {
  name?: string;
  chapters?: TorahChapter[];
};

type TorahPayload = {
  books?: TorahBook[];
};

type VersePair = {
  previous: string;
  current: string;
};

const TORAH_PATH = path.resolve(process.cwd(), "data", "torah.json");
const MAQQEF = "\u05BE";
const SOF_PASUQ = "\u05C3";

const SANITIZE_OPTIONS: IterateTorahOptions = {
  input: TORAH_PATH,
  lang: "he",
  normalizeFinals: false,
  keepTeamim: true,
  allowRuntimeErrors: false
};

const VERSE_PAIRS: VersePair[] = [
  {
    previous: "Genesis/1/1",
    current: "Genesis/1/2"
  },
  {
    previous: "Leviticus/1/1",
    current: "Leviticus/1/2"
  }
];

const TORAH = loadTorahPayload();

function loadTorahPayload(): TorahPayload {
  return JSON.parse(fs.readFileSync(TORAH_PATH, "utf8")) as TorahPayload;
}

function findBook(payload: TorahPayload, bookName: string): TorahBook | null {
  const books = payload.books ?? [];
  const exact = books.find((book) => String(book.name ?? "") === bookName);
  if (exact) {
    return exact;
  }
  const normalized = bookName.toLowerCase();
  return books.find((book) => String(book.name ?? "").toLowerCase() === normalized) ?? null;
}

function verseText(refKey: string): string {
  const ref = parseRefKey(refKey);
  const book = findBook(TORAH, ref.book);
  if (!book) {
    throw new Error(`Book '${ref.book}' not found for ${refKey}`);
  }
  const chapter = (book.chapters ?? []).find((entry) => Number(entry.n) === ref.chapter);
  if (!chapter) {
    throw new Error(`Chapter '${ref.chapter}' not found for ${refKey}`);
  }
  const verse = (chapter.verses ?? []).find((entry) => Number(entry.n) === ref.verse);
  if (!verse || !String(verse.he ?? "").trim()) {
    throw new Error(`Verse '${refKey}' has no Hebrew text`);
  }
  return String(verse.he);
}

function prepareVerse(refKey: string): { source: string; cleaned: string } {
  const source = verseText(refKey);
  const cleaned = sanitizeText(source, SANITIZE_OPTIONS);
  if (!cleaned.trim()) {
    throw new Error(`Verse '${refKey}' sanitized to empty text`);
  }
  return { source, cleaned };
}

function canonicalizeSnapshot(snapshot: VerseSnapshot): string {
  return canonicalStringify(snapshot);
}

function runVerse(refKey: string, state: State = createInitialState()): VerseSnapshot {
  const { cleaned } = prepareVerse(refKey);
  const execution = runProgramWithTrace(cleaned, state, {
    finalizeAtVerseEnd: true,
    finalizeVerseOptions: {
      ref: refKey,
      cleaned
    }
  });

  if (execution.verseSnapshots.length > 0) {
    return execution.verseSnapshots[execution.verseSnapshots.length - 1];
  }

  return finalizeVerse(state, { ref: refKey, cleaned });
}

describe("integration: verse isolation parity", () => {
  for (const pair of VERSE_PAIRS) {
    it(`matches isolated snapshot for ${pair.current} after streaming ${pair.previous}`, () => {
      const previous = prepareVerse(pair.previous);
      const current = prepareVerse(pair.current);
      const pairText = `${previous.cleaned} ${current.cleaned}`;

      expect(pairText.includes(SOF_PASUQ)).toBe(true);
      expect(pairText.includes(MAQQEF)).toBe(true);

      const isolatedSnapshot = runVerse(pair.current);

      const streamState = createInitialState();
      runVerse(pair.previous, streamState);
      const streamSnapshot = runVerse(pair.current, streamState);

      expect(canonicalizeSnapshot(streamSnapshot)).toBe(canonicalizeSnapshot(isolatedSnapshot));
    });
  }
});
