#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function normalizeSlug(value, label) {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) {
    throw new Error(`Missing ${label}`);
  }
  return normalized;
}

function normalizeSegment(value, label) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return raw.padStart(3, "0");
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }
}

function readStringArray(filePath, label, { segment = false } = {}) {
  const value = readJsonFile(filePath);
  if (!Array.isArray(value)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }

  const normalized = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected ${label} string at ${filePath}[${index}]`);
    }

    if (segment) {
      if (!/^\d{3}$/u.test(entry)) {
        throw new Error(`Expected zero-padded ${label} (NNN) at ${filePath}[${index}]`);
      }
      normalized.push(entry);
    } else {
      normalized.push(normalizeSlug(entry, label));
    }
  }

  return normalized;
}

function addTierEntry(tiersByBook, book, chapter, verse) {
  if (!tiersByBook.has(book)) {
    tiersByBook.set(book, new Map());
  }

  const chaptersByBook = tiersByBook.get(book);
  if (!chaptersByBook.has(chapter)) {
    chaptersByBook.set(chapter, new Set());
  }

  chaptersByBook.get(chapter).add(verse);
}

function collectFromArray(indexData) {
  const tiersByBook = new Map();

  for (let row = 0; row < indexData.length; row += 1) {
    const entry = indexData[row];
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid refs/index.json row at index ${String(row)}`);
    }

    const book = normalizeSlug(entry.book_slug, "book_slug");
    const chapter = normalizeSegment(entry.chapter, "chapter");
    const verse = normalizeSegment(entry.verse, "verse");
    addTierEntry(tiersByBook, book, chapter, verse);
  }

  return tiersByBook;
}

function collectFromNestedObject(indexData) {
  const tiersByBook = new Map();

  for (const [bookKey, chaptersValue] of Object.entries(indexData ?? {})) {
    if (!chaptersValue || typeof chaptersValue !== "object") {
      continue;
    }

    const book = normalizeSlug(bookKey, "book slug");
    for (const [chapterKey, versesValue] of Object.entries(chaptersValue)) {
      const chapter = normalizeSegment(chapterKey, "chapter");

      if (Array.isArray(versesValue)) {
        for (const verseKey of versesValue) {
          const verse = normalizeSegment(verseKey, "verse");
          addTierEntry(tiersByBook, book, chapter, verse);
        }
        continue;
      }

      if (!versesValue || typeof versesValue !== "object") {
        continue;
      }

      for (const verseKey of Object.keys(versesValue)) {
        const verse = normalizeSegment(verseKey, "verse");
        addTierEntry(tiersByBook, book, chapter, verse);
      }
    }
  }

  return tiersByBook;
}

function collectExpectedTiers(indexData) {
  if (Array.isArray(indexData)) {
    return collectFromArray(indexData);
  }

  if (indexData && typeof indexData === "object") {
    return collectFromNestedObject(indexData);
  }

  throw new Error("Unsupported refs/index.json shape");
}

function parseArgs(rawArgs) {
  const defaults = {
    refsRoot: path.resolve(repoRoot, "outputs/pasuk-trace-corpus/latest/refs")
  };

  for (const arg of rawArgs) {
    if (arg.startsWith("--refs-root=")) {
      const refsRootArg = arg.slice("--refs-root=".length).trim();
      if (refsRootArg.length === 0) {
        throw new Error("Empty --refs-root value");
      }
      defaults.refsRoot = path.resolve(process.cwd(), refsRootArg);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/validate-split-index.mjs [--refs-root=<path-to-refs-directory>]"
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return defaults;
}

function validateTiers(refsRoot, expectedByBook) {
  const booksPath = path.join(refsRoot, "books.json");
  const books = readStringArray(booksPath, "book slug");
  const actualBooks = new Set(books);

  for (const book of expectedByBook.keys()) {
    if (!actualBooks.has(book)) {
      throw new Error(`Missing book '${book}' in ${booksPath}`);
    }
  }

  for (const book of actualBooks) {
    if (!expectedByBook.has(book)) {
      throw new Error(`Unexpected extra book '${book}' in ${booksPath}`);
    }
  }

  let chapterCount = 0;
  let verseCount = 0;

  for (const book of expectedByBook.keys()) {
    const expectedChapters = expectedByBook.get(book);
    const chaptersPath = path.join(refsRoot, book, "chapters.json");
    const chapters = readStringArray(chaptersPath, "chapter", { segment: true });
    const actualChapters = new Set(chapters);

    for (const chapter of expectedChapters.keys()) {
      if (!actualChapters.has(chapter)) {
        throw new Error(`Missing chapter '${chapter}' in ${chaptersPath}`);
      }
    }

    for (const chapter of actualChapters) {
      if (!expectedChapters.has(chapter)) {
        throw new Error(`Unexpected extra chapter '${chapter}' in ${chaptersPath}`);
      }
    }

    chapterCount += expectedChapters.size;

    for (const chapter of expectedChapters.keys()) {
      const versesPath = path.join(refsRoot, book, chapter, "verses.json");
      const verses = readStringArray(versesPath, "verse", { segment: true });
      const actualVerses = new Set(verses);
      const expectedVerses = expectedChapters.get(chapter);

      for (const verse of expectedVerses) {
        if (!actualVerses.has(verse)) {
          throw new Error(`Missing verse '${verse}' in ${versesPath}`);
        }
      }

      for (const verse of actualVerses) {
        if (!expectedVerses.has(verse)) {
          throw new Error(`Unexpected extra verse '${verse}' in ${versesPath}`);
        }
      }

      verseCount += expectedVerses.size;
    }
  }

  return {
    books: expectedByBook.size,
    chapters: chapterCount,
    verses: verseCount
  };
}

function main(rawArgs) {
  const { refsRoot } = parseArgs(rawArgs);
  const indexPath = path.join(refsRoot, "index.json");
  const indexData = readJsonFile(indexPath);
  const expectedByBook = collectExpectedTiers(indexData);
  const counts = validateTiers(refsRoot, expectedByBook);

  console.log(
    `Validated split index: books=${counts.books} chapters=${counts.chapters} verses=${counts.verses} root=${refsRoot}`
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  console.error(`split-index validation failed: ${message}`);
  process.exit(1);
}
