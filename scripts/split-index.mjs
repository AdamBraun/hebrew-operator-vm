#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const refsRoot = path.resolve(repoRoot, "outputs/pasuk-trace-corpus/latest/refs");
const indexPath = path.join(refsRoot, "index.json");

function compareAsc(left, right) {
  return left.localeCompare(right, "en");
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

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

  for (const entry of indexData) {
    if (!entry || typeof entry !== "object") {
      continue;
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

function collectTiers(indexData) {
  if (Array.isArray(indexData)) {
    return collectFromArray(indexData);
  }

  if (indexData && typeof indexData === "object") {
    return collectFromNestedObject(indexData);
  }

  throw new Error("Unsupported refs/index.json shape");
}

function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing index file: ${indexPath}`);
  }

  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const tiersByBook = collectTiers(indexData);

  const books = Array.from(tiersByBook.keys()).sort(compareAsc);
  writeJsonFile(path.join(refsRoot, "books.json"), books);

  let chaptersWritten = 0;
  let versesWritten = 0;

  for (const book of books) {
    const chaptersByBook = tiersByBook.get(book);
    const chapters = Array.from(chaptersByBook.keys()).sort(compareAsc);
    writeJsonFile(path.join(refsRoot, book, "chapters.json"), chapters);
    chaptersWritten += 1;

    for (const chapter of chapters) {
      const verses = Array.from(chaptersByBook.get(chapter)).sort(compareAsc);
      writeJsonFile(path.join(refsRoot, book, chapter, "verses.json"), verses);
      versesWritten += 1;
    }
  }

  console.log(
    `Wrote ${books.length} books, ${chaptersWritten} chapter indexes, and ${versesWritten} verse indexes.`
  );
}

main();
