import fs from "node:fs/promises";
import path from "node:path";
import { formatRefKey, REFKEY_BOOKS, type RefBook, type RefKey } from "../../ir/refkey";

type UnknownRecord = Record<string, unknown>;

type TorahVerse = {
  n?: number;
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

export type ExtractRefOrderArgs = {
  torahJsonPath?: string;
};

export const DEFAULT_TORAH_JSON_PATH = path.resolve(process.cwd(), "data", "torah.json");

const OWN = Object.prototype.hasOwnProperty;

function fail(pathLabel: string, message: string): never {
  throw new Error(`metadata ref order invalid at ${pathLabel}: ${message}`);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, pathLabel: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(pathLabel, `expected object, got ${typeof value}`);
  }
}

function assertArray(value: unknown, pathLabel: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(pathLabel, `expected array, got ${typeof value}`);
  }
  return value;
}

function assertHas(record: UnknownRecord, key: string, pathLabel: string): unknown {
  if (!hasOwn(record, key)) {
    fail(`${pathLabel}.${key}`, "missing required field");
  }
  return record[key];
}

function assertString(value: unknown, pathLabel: string): string {
  if (typeof value !== "string") {
    fail(pathLabel, `expected string, got ${typeof value}`);
  }
  return value;
}

function assertPositiveInteger(value: unknown, pathLabel: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    fail(pathLabel, `expected positive integer, got ${String(value)}`);
  }
  return value;
}

function compareNumber(left: number, right: number): number {
  return left - right;
}

function findTorahBooks(payload: unknown): Map<RefBook, TorahBook> {
  assertRecord(payload, "$");
  const booksRaw = assertArray(assertHas(payload, "books", "$"), "$.books");

  const out = new Map<RefBook, TorahBook>();

  for (let i = 0; i < booksRaw.length; i += 1) {
    const pathLabel = `$.books[${String(i)}]`;
    const bookRaw = booksRaw[i];
    assertRecord(bookRaw, pathLabel);
    const bookName = assertString(assertHas(bookRaw, "name", pathLabel), `${pathLabel}.name`);

    if (!REFKEY_BOOKS.includes(bookName as RefBook)) {
      continue;
    }

    const canonicalBook = bookName as RefBook;
    if (out.has(canonicalBook)) {
      fail(pathLabel, `duplicate Torah book '${canonicalBook}'`);
    }
    out.set(canonicalBook, bookRaw as TorahBook);
  }

  for (const bookName of REFKEY_BOOKS) {
    if (!out.has(bookName)) {
      fail("$.books", `missing Torah book '${bookName}'`);
    }
  }

  return out;
}

function extractRefsForBook(book: RefBook, bookData: TorahBook, pathLabel: string): RefKey[] {
  const chaptersRaw = assertArray(
    assertHas(bookData as UnknownRecord, "chapters", pathLabel),
    `${pathLabel}.chapters`
  );
  const chapterByNumber = new Map<number, TorahChapter>();

  for (let chapterIndex = 0; chapterIndex < chaptersRaw.length; chapterIndex += 1) {
    const chapterPath = `${pathLabel}.chapters[${String(chapterIndex)}]`;
    const chapterRaw = chaptersRaw[chapterIndex];
    assertRecord(chapterRaw, chapterPath);
    const chapterN = assertPositiveInteger(
      assertHas(chapterRaw, "n", chapterPath),
      `${chapterPath}.n`
    );
    if (chapterByNumber.has(chapterN)) {
      fail(`${chapterPath}.n`, `duplicate chapter number ${String(chapterN)} in ${book}`);
    }
    chapterByNumber.set(chapterN, chapterRaw as TorahChapter);
  }

  const chapterNumbers = [...chapterByNumber.keys()].sort(compareNumber);
  const refs: RefKey[] = [];

  for (const chapterN of chapterNumbers) {
    const chapterData = chapterByNumber.get(chapterN);
    if (!chapterData) {
      continue;
    }
    const chapterPath = `${pathLabel}.chapters[n=${String(chapterN)}]`;
    const versesRaw = assertArray(
      assertHas(chapterData as UnknownRecord, "verses", chapterPath),
      `${chapterPath}.verses`
    );
    const verseNumbers = new Set<number>();
    const sortedVerseNumbers: number[] = [];

    for (let verseIndex = 0; verseIndex < versesRaw.length; verseIndex += 1) {
      const versePath = `${chapterPath}.verses[${String(verseIndex)}]`;
      const verseRaw = versesRaw[verseIndex];
      assertRecord(verseRaw, versePath);
      const verseN = assertPositiveInteger(assertHas(verseRaw, "n", versePath), `${versePath}.n`);
      if (verseNumbers.has(verseN)) {
        fail(
          `${versePath}.n`,
          `duplicate verse number ${String(verseN)} in ${book}/${String(chapterN)}`
        );
      }
      verseNumbers.add(verseN);
      sortedVerseNumbers.push(verseN);
    }

    sortedVerseNumbers.sort(compareNumber);
    for (const verseN of sortedVerseNumbers) {
      refs.push(
        formatRefKey({
          book,
          chapter: chapterN,
          verse: verseN
        })
      );
    }
  }

  return refs;
}

export function extractRefOrderFromTorahPayload(payload: unknown): RefKey[] {
  const books = findTorahBooks(payload);
  const refs: RefKey[] = [];

  for (const book of REFKEY_BOOKS) {
    const bookData = books.get(book);
    if (!bookData) {
      continue;
    }
    refs.push(...extractRefsForBook(book, bookData, `$.books[name=${book}]`));
  }

  if (refs.length === 0) {
    fail("$.books", "no Torah verses found");
  }

  return refs;
}

export async function extractRefOrder(args: ExtractRefOrderArgs = {}): Promise<RefKey[]> {
  const torahJsonPath = args.torahJsonPath ?? DEFAULT_TORAH_JSON_PATH;
  const text = await fs.readFile(torahJsonPath, "utf8");
  let payload: unknown;

  try {
    payload = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`metadata ref order invalid at ${torahJsonPath}: invalid JSON (${message})`);
  }

  return extractRefOrderFromTorahPayload(payload);
}
