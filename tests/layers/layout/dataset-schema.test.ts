import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeHebrewText } from "../../../impl/reference/src/scripts/shared/hebrewSanitizer";
import { assertLayoutDataset, type LayoutDataset } from "../../../src/layers/layout/schema";

type VersePayload = {
  n: number;
  he?: string;
};

type ChapterPayload = {
  n: number;
  verses?: VersePayload[];
};

type BookPayload = {
  name: string;
  chapters?: ChapterPayload[];
};

type TorahCorpusPayload = {
  books?: BookPayload[];
};

function loadLayoutDataset(): LayoutDataset {
  const datasetPath = path.resolve(
    process.cwd(),
    "src",
    "layers",
    "layout",
    "datasets",
    "torah_layout_breaks.v1.json"
  );
  const parsed = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as unknown;
  assertLayoutDataset(parsed);
  return parsed;
}

function countHebrewBaseLetters(text: string): number {
  const matches = text.match(/[\u05D0-\u05EA]/gu);
  return matches ? matches.length : 0;
}

function loadExpectedBookBreaks(): Array<{ ref_key: string; gap_index: number }> {
  const torahPath = path.resolve(process.cwd(), "data", "torah.json");
  const payload = JSON.parse(fs.readFileSync(torahPath, "utf8")) as TorahCorpusPayload;
  const books = payload.books ?? [];
  const out: Array<{ ref_key: string; gap_index: number }> = [];

  for (let b = 0; b < books.length - 1; b += 1) {
    const book = books[b];
    const bookName = String(book?.name ?? "").trim();
    if (!bookName) {
      continue;
    }

    let lastChapter: ChapterPayload | null = null;
    for (const chapter of book?.chapters ?? []) {
      const chapterN = Number(chapter?.n);
      if (!Number.isInteger(chapterN) || chapterN < 1) {
        continue;
      }
      if (!lastChapter || chapterN > Number(lastChapter.n)) {
        lastChapter = chapter;
      }
    }
    if (!lastChapter) {
      continue;
    }

    let lastVerse: VersePayload | null = null;
    for (const verse of lastChapter.verses ?? []) {
      const verseN = Number(verse?.n);
      if (!Number.isInteger(verseN) || verseN < 1) {
        continue;
      }
      if (!lastVerse || verseN > Number(lastVerse.n)) {
        lastVerse = verse;
      }
    }
    if (!lastVerse) {
      continue;
    }

    const chapterN = Number(lastChapter.n);
    const verseN = Number(lastVerse.n);
    const ref_key = `${bookName}/${chapterN}/${verseN}`;
    const clean = sanitizeHebrewText(lastVerse.he ?? "", {
      keepTeamim: true,
      normalizeFinals: false
    });
    const gap_index = countHebrewBaseLetters(clean);
    out.push({ ref_key, gap_index });
  }

  return out;
}

describe("layout dataset schema", () => {
  it("loads and validates torah layout dataset", () => {
    const dataset = loadLayoutDataset();

    expect(dataset.dataset_id).toBe("torah_layout_breaks.v1");
    expect(dataset.version).toBe("1.0.0");
    expect(dataset.hash_algo).toBe("sha256");
    expect(dataset.events.length).toBeGreaterThan(0);
    expect(dataset.source).toContain("No line/page geometry inference");
  });

  it("contains all required event families", () => {
    const dataset = loadLayoutDataset();
    const types = new Set(dataset.events.map((event) => event.type));

    expect(types.has("SETUMA")).toBe(true);
    expect(types.has("PETUCHA")).toBe(true);
    expect(types.has("BOOK_BREAK")).toBe(true);
  });

  it("keeps event objects free of geometry fields (signal comes only from dataset anchors)", () => {
    const dataset = loadLayoutDataset();

    for (const event of dataset.events) {
      expect(Object.keys(event).sort()).toEqual(
        event.note === undefined
          ? ["anchor", "ref_key", "type"]
          : ["anchor", "note", "ref_key", "type"]
      );
      expect(Object.keys(event.anchor).sort()).toEqual(["gap_index", "kind"]);
    }
  });

  it("places BOOK_BREAK at canonical end-of-book trailing gap", () => {
    const dataset = loadLayoutDataset();
    const actual = dataset.events
      .filter((event) => event.type === "BOOK_BREAK")
      .map((event) => ({
        ref_key: event.ref_key,
        gap_index: event.anchor.gap_index
      }))
      .sort((a, b) => a.ref_key.localeCompare(b.ref_key));

    const expected = loadExpectedBookBreaks().sort((a, b) => a.ref_key.localeCompare(b.ref_key));
    expect(actual).toEqual(expected);
  });
});
