export const REFKEY_BOOKS = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"] as const;

export type RefBook = (typeof REFKEY_BOOKS)[number];

export type RefKey = `${RefBook}/${number}/${number}`;

export type RefKeyParts = {
  book: RefBook;
  chapter: number;
  verse: number;
};

const REFKEY_BOOK_SET = new Set<string>(REFKEY_BOOKS);

const REFKEY_PATTERN =
  /^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\/([1-9][0-9]*)\/([1-9][0-9]*)$/;

const REFKEY_BOOK_ORDER: Readonly<Record<RefBook, number>> = {
  Genesis: 0,
  Exodus: 1,
  Leviticus: 2,
  Numbers: 3,
  Deuteronomy: 4
};

function fail(label: string, message: string): never {
  throw new Error(`Invalid RefKey at ${label}: ${message}`);
}

function assertPositiveSafeInteger(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    fail(label, `expected positive safe integer, got ${String(value)}`);
  }
}

export function isRefBook(value: unknown): value is RefBook {
  return typeof value === "string" && REFKEY_BOOK_SET.has(value);
}

export function assertRefBook(value: unknown, label = "book"): asserts value is RefBook {
  if (!isRefBook(value)) {
    fail(label, `expected one of ${REFKEY_BOOKS.join(", ")}, got ${String(value)}`);
  }
}

export function parseRefKey(value: string): RefKeyParts {
  if (typeof value !== "string") {
    fail("ref_key", `expected string, got ${typeof value}`);
  }

  const match = value.match(REFKEY_PATTERN);
  if (!match) {
    fail(
      "ref_key",
      `expected <Book>/<Chapter>/<Verse> with Torah book name and positive integers, got ${JSON.stringify(
        value
      )}`
    );
  }

  const book = match[1];
  const chapterRaw = match[2];
  const verseRaw = match[3];

  if (!isRefBook(book) || chapterRaw === undefined || verseRaw === undefined) {
    fail("ref_key", `could not parse ${JSON.stringify(value)}`);
  }

  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);

  if (!Number.isSafeInteger(chapter) || !Number.isSafeInteger(verse)) {
    fail("ref_key", `chapter/verse must be safe integers in ${JSON.stringify(value)}`);
  }

  return {
    book,
    chapter,
    verse
  };
}

export function formatRefKey(parts: RefKeyParts): RefKey {
  assertRefBook(parts.book, "ref_parts.book");
  assertPositiveSafeInteger(parts.chapter, "ref_parts.chapter");
  assertPositiveSafeInteger(parts.verse, "ref_parts.verse");
  return `${parts.book}/${String(parts.chapter)}/${String(parts.verse)}` as RefKey;
}

export function isRefKey(value: unknown): value is RefKey {
  if (typeof value !== "string") {
    return false;
  }
  try {
    parseRefKey(value);
    return true;
  } catch {
    return false;
  }
}

export function assertRefKey(value: unknown, label = "ref_key"): asserts value is RefKey {
  if (typeof value !== "string") {
    fail(label, `expected string, got ${typeof value}`);
  }
  if (!isRefKey(value)) {
    fail(
      label,
      `expected <Book>/<Chapter>/<Verse> with Torah book name and positive integers, got ${JSON.stringify(
        value
      )}`
    );
  }
}

export function compareRefKeysCanonical(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const leftParsed = parseRefKey(left);
  const rightParsed = parseRefKey(right);

  const bookCmp = REFKEY_BOOK_ORDER[leftParsed.book] - REFKEY_BOOK_ORDER[rightParsed.book];
  if (bookCmp !== 0) {
    return bookCmp;
  }

  if (leftParsed.chapter !== rightParsed.chapter) {
    return leftParsed.chapter - rightParsed.chapter;
  }

  return leftParsed.verse - rightParsed.verse;
}
