import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canonicalizeTraceRecord,
  canonicalizeVerseTraceRecord,
  canonicalizeWordTraceRecord
} from "@ref/trace/canonicalize";
import { hashTraceRecord } from "@ref/trace/hash";
import type { TraceRecord, VerseTraceRecord, WordTraceRecord } from "@ref/trace/types";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "trace-canonicalize");

function loadJson<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")) as T;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("trace canonicalizer", () => {
  it("matches golden canonical JSON fixtures", () => {
    const wordRaw = loadJson<WordTraceRecord>("word.raw.json");
    const verseRaw = loadJson<VerseTraceRecord>("verse.raw.json");

    const wordCanonical = canonicalizeTraceRecord(wordRaw as TraceRecord);
    const verseCanonical = canonicalizeTraceRecord(verseRaw as TraceRecord);

    const expectedWord = loadJson<TraceRecord>("word.canonical.json");
    const expectedVerse = loadJson<TraceRecord>("verse.canonical.json");

    expect(JSON.stringify(wordCanonical)).toBe(JSON.stringify(expectedWord));
    expect(JSON.stringify(verseCanonical)).toBe(JSON.stringify(expectedVerse));
  });

  it("is idempotent: canonicalize(canonicalize(x)) == canonicalize(x)", () => {
    const baseWord = loadJson<WordTraceRecord>("word.raw.json");
    const baseVerse = loadJson<VerseTraceRecord>("verse.raw.json");

    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (includeSkeleton, includeFlow, reverseEvents, reverseCrossWordEvents) => {
          const word = deepClone(baseWord);
          const verse = deepClone(baseVerse);

          word.events = reverseEvents ? [...word.events].reverse() : [...word.events];
          if (!includeSkeleton) {
            delete word.skeleton;
          } else {
            word.skeleton = ["GIMEL.BESTOW", "ALEPH.ALIAS"];
          }
          if (!includeFlow) {
            delete word.flow;
          }

          verse.cross_word_events = reverseCrossWordEvents
            ? [...verse.cross_word_events].reverse()
            : [...verse.cross_word_events];

          const onceWord = canonicalizeWordTraceRecord(word);
          const twiceWord = canonicalizeWordTraceRecord(onceWord);
          expect(twiceWord).toEqual(onceWord);

          const onceVerse = canonicalizeVerseTraceRecord(verse);
          const twiceVerse = canonicalizeVerseTraceRecord(onceVerse);
          expect(twiceVerse).toEqual(onceVerse);
        }
      )
    );
  });

  it("produces stable hashes for identical canonical records", () => {
    const rawWord = loadJson<WordTraceRecord>("word.raw.json");
    const rawVerse = loadJson<VerseTraceRecord>("verse.raw.json");

    const canonicalWordA = canonicalizeWordTraceRecord(rawWord);
    const canonicalWordB = canonicalizeWordTraceRecord(deepClone(rawWord));
    const canonicalVerseA = canonicalizeVerseTraceRecord(rawVerse);
    const canonicalVerseB = canonicalizeVerseTraceRecord(deepClone(rawVerse));

    expect(canonicalWordA.canonical_hash).toBe(hashTraceRecord(canonicalWordA));
    expect(canonicalWordB.canonical_hash).toBe(hashTraceRecord(canonicalWordB));
    expect(canonicalWordA.canonical_hash).toBe(canonicalWordB.canonical_hash);

    expect(canonicalVerseA.canonical_hash).toBe(hashTraceRecord(canonicalVerseA));
    expect(canonicalVerseB.canonical_hash).toBe(hashTraceRecord(canonicalVerseB));
    expect(canonicalVerseA.canonical_hash).toBe(canonicalVerseB.canonical_hash);
  });
});
