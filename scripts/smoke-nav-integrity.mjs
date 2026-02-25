#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function parseArgs(rawArgs) {
  let refsRoot = path.resolve(repoRoot, "outputs/pasuk-trace-corpus/latest/refs");

  for (const arg of rawArgs) {
    if (arg.startsWith("--refs-root=")) {
      const value = arg.slice("--refs-root=".length).trim();
      if (!value) {
        throw new Error("Empty --refs-root value");
      }
      refsRoot = path.resolve(process.cwd(), value);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/smoke-nav-integrity.mjs [--refs-root=<path-to-refs-directory>]"
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { refsRoot };
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }

  return parsed;
}

function readNonEmptyStringArray(filePath, label) {
  const value = readJsonFile(filePath);
  if (!Array.isArray(value)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  if (value.length === 0) {
    throw new Error(`Expected non-empty ${label} array in ${filePath}`);
  }

  const normalized = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`Expected non-empty string at ${filePath}[${index}]`);
    }
    return entry.trim();
  });

  return normalized;
}

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required artifact: ${filePath}`);
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Expected file artifact, found non-file path: ${filePath}`);
  }
}

function main() {
  const { refsRoot } = parseArgs(process.argv.slice(2));

  const booksPath = path.join(refsRoot, "books.json");
  const books = readNonEmptyStringArray(booksPath, "books");
  const firstBook = books[0];

  const chaptersPath = path.join(refsRoot, firstBook, "chapters.json");
  const chapters = readNonEmptyStringArray(chaptersPath, "chapters");
  const firstChapter = chapters[0];

  const versesPath = path.join(refsRoot, firstBook, firstChapter, "verses.json");
  const verses = readNonEmptyStringArray(versesPath, "verses");
  const firstVerse = verses[0];

  const verseDir = path.join(refsRoot, firstBook, firstChapter, firstVerse);
  assertFileExists(path.join(verseDir, "trace.json"));
  assertFileExists(path.join(verseDir, "trace.txt"));
  assertFileExists(path.join(verseDir, "graph.dot"));

  console.log(
    `Navigation integrity smoke passed: ${firstBook}/${firstChapter}/${firstVerse} under ${refsRoot}`
  );
}

try {
  main();
} catch (error) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  console.error(`Navigation integrity smoke failed: ${message}`);
  process.exit(1);
}
