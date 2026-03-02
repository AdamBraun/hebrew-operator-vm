import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractRefOrder,
  extractRefOrderFromTorahPayload
} from "../../src/layers/metadata/extractRefOrder";

const TORAH_JSON_PATH = path.resolve(process.cwd(), "data", "torah.json");
const TORAH_BOOKS = new Set(["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]);

function loadPayload(): unknown {
  return JSON.parse(fs.readFileSync(TORAH_JSON_PATH, "utf8")) as unknown;
}

function countTorahVerses(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  const books = Array.isArray((payload as { books?: unknown[] }).books)
    ? (payload as { books: unknown[] }).books
    : [];

  let total = 0;
  for (const book of books) {
    if (!book || typeof book !== "object") {
      continue;
    }
    const name = (book as { name?: unknown }).name;
    if (typeof name !== "string" || !TORAH_BOOKS.has(name)) {
      continue;
    }
    const chapters = Array.isArray((book as { chapters?: unknown[] }).chapters)
      ? (book as { chapters: unknown[] }).chapters
      : [];
    for (const chapter of chapters) {
      if (!chapter || typeof chapter !== "object") {
        continue;
      }
      const verses = Array.isArray((chapter as { verses?: unknown[] }).verses)
        ? (chapter as { verses: unknown[] }).verses
        : [];
      total += verses.length;
    }
  }
  return total;
}

describe("metadata extractRefOrder", () => {
  it("extracts canonical Torah ref order from corpus payload", async () => {
    const refs = await extractRefOrder();
    const payload = loadPayload();
    const verseCount = countTorahVerses(payload);

    expect(refs.length).toBe(verseCount);
    expect(refs[0]).toBe("Genesis/1/1");
    expect(refs.at(-1)).toBe("Deuteronomy/34/12");
  });

  it("is deterministic across runs", async () => {
    const runA = await extractRefOrder();
    const runB = await extractRefOrder();
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
  });

  it("filters non-Torah books and canonicalizes chapter/verse ordering", () => {
    const payload = {
      books: [
        {
          name: "Joshua",
          chapters: [{ n: 1, verses: [{ n: 1 }] }]
        },
        {
          name: "Exodus",
          chapters: [
            { n: 2, verses: [{ n: 2 }, { n: 1 }] },
            { n: 1, verses: [{ n: 1 }] }
          ]
        },
        {
          name: "Genesis",
          chapters: [
            { n: 2, verses: [{ n: 1 }] },
            { n: 1, verses: [{ n: 2 }, { n: 1 }] }
          ]
        },
        {
          name: "Leviticus",
          chapters: [{ n: 1, verses: [{ n: 1 }] }]
        },
        {
          name: "Deuteronomy",
          chapters: [{ n: 1, verses: [{ n: 1 }] }]
        },
        {
          name: "Numbers",
          chapters: [{ n: 1, verses: [{ n: 1 }] }]
        }
      ]
    };

    const refs = extractRefOrderFromTorahPayload(payload);
    expect(refs).toEqual([
      "Genesis/1/1",
      "Genesis/1/2",
      "Genesis/2/1",
      "Exodus/1/1",
      "Exodus/2/1",
      "Exodus/2/2",
      "Leviticus/1/1",
      "Numbers/1/1",
      "Deuteronomy/1/1"
    ]);
  });

  it("fails fast when a required Torah book is missing", () => {
    const payloadMissingBook = {
      books: [
        { name: "Genesis", chapters: [{ n: 1, verses: [{ n: 1 }] }] },
        { name: "Exodus", chapters: [{ n: 1, verses: [{ n: 1 }] }] },
        { name: "Numbers", chapters: [{ n: 1, verses: [{ n: 1 }] }] },
        { name: "Deuteronomy", chapters: [{ n: 1, verses: [{ n: 1 }] }] }
      ]
    };

    expect(() => extractRefOrderFromTorahPayload(payloadMissingBook)).toThrow(
      /missing Torah book 'Leviticus'/
    );
  });
});
