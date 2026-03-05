import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertLettersIRRecord,
  assertLettersIRRecords,
  assertLettersIRRecordsAgainstSpine,
  formatLettersIRJsonl,
  parseLettersIRJsonl,
  readLettersIRJsonl,
  writeLettersIRJsonl,
  type LettersIRRecord
} from "../../../src/layers/letters/schema";
import { assertSpineRecord, type SpineRecord } from "../../../src/spine/schema";

const SPINE_DIGEST_FIXTURE = "a".repeat(64);

function loadSpineFixture(fileName: string): SpineRecord[] {
  const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", fileName);
  const raw = fs.readFileSync(fixturePath, "utf8");
  const out: SpineRecord[] = [];

  for (const line of raw.split(/\r?\n/u)) {
    if (!line.trim()) {
      continue;
    }
    const parsed = JSON.parse(line) as unknown;
    assertSpineRecord(parsed);
    out.push(parsed);
  }

  return out;
}

function isHebrewBaseLetter(value: unknown): value is string {
  return typeof value === "string" && /^[\u05D0-\u05EA]$/u.test(value);
}

type WordState = {
  wordIndex: number;
  indexInWord: number;
  seenLetter: boolean;
  bumpOnNextLetter: boolean;
};

function getWordState(byRef: Map<string, WordState>, refKey: string): WordState {
  const existing = byRef.get(refKey);
  if (existing) {
    return existing;
  }
  const created: WordState = {
    wordIndex: 0,
    indexInWord: 0,
    seenLetter: false,
    bumpOnNextLetter: false
  };
  byRef.set(refKey, created);
  return created;
}

function buildLettersIRFromSpine(spineRows: readonly SpineRecord[]): LettersIRRecord[] {
  const out: LettersIRRecord[] = [];
  const wordsByRef = new Map<string, WordState>();

  for (const row of spineRows) {
    const state = getWordState(wordsByRef, row.ref_key);

    if (row.kind === "gap") {
      if (row.raw.whitespace && state.seenLetter) {
        state.bumpOnNextLetter = true;
      }
      continue;
    }

    if (!isHebrewBaseLetter(row.base_letter)) {
      continue;
    }

    if (state.bumpOnNextLetter) {
      state.wordIndex += 1;
      state.indexInWord = 0;
      state.bumpOnNextLetter = false;
    }

    out.push({
      kind: "letter_ir",
      gid: row.gid,
      ref_key: row.ref_key,
      g_index: row.g_index,
      letter: row.base_letter,
      op_kind: row.base_letter,
      word: {
        id: `${row.ref_key}#w:${String(state.wordIndex)}`,
        index_in_word: state.indexInWord
      },
      source: {
        spine_digest: SPINE_DIGEST_FIXTURE
      }
    });

    state.seenLetter = true;
    state.indexInWord += 1;
  }

  return out;
}

describe("letters ir schema", () => {
  it("accepts a valid record", () => {
    const record: LettersIRRecord = {
      kind: "letter_ir",
      gid: "Genesis/1/1#g:2",
      ref_key: "Genesis/1/1",
      g_index: 2,
      letter: "ך",
      op_kind: "כ.final",
      features: { final_form: true },
      word: { id: "Genesis/1/1#w:0", index_in_word: 2 },
      flags: { ignored: false },
      source: { spine_digest: SPINE_DIGEST_FIXTURE }
    };

    expect(() => assertLettersIRRecord(record)).not.toThrow();
  });

  it("rejects non-Hebrew letters", () => {
    const invalid = {
      kind: "letter_ir",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      letter: "A",
      op_kind: "A",
      source: { spine_digest: SPINE_DIGEST_FIXTURE }
    };

    expect(() => assertLettersIRRecord(invalid)).toThrow(/normalized Hebrew base letter/);
  });

  it("rejects gid/ref_key/g_index anchor mismatch", () => {
    const invalid = {
      kind: "letter_ir",
      gid: "Genesis/1/1#g:1",
      ref_key: "Genesis/1/1",
      g_index: 0,
      letter: "א",
      op_kind: "א",
      source: { spine_digest: SPINE_DIGEST_FIXTURE }
    };

    expect(() => assertLettersIRRecord(invalid)).toThrow(
      /must match ref_key='Genesis\/1\/1' and g_index=0/
    );
  });

  it("enforces strict spine order and unique gid", () => {
    const base: LettersIRRecord = {
      kind: "letter_ir",
      gid: "Genesis/1/1#g:0",
      ref_key: "Genesis/1/1",
      g_index: 0,
      letter: "א",
      op_kind: "א",
      source: { spine_digest: SPINE_DIGEST_FIXTURE }
    };
    const next: LettersIRRecord = {
      ...base,
      gid: "Genesis/1/1#g:1",
      g_index: 1,
      letter: "ב",
      op_kind: "ב"
    };

    expect(() => assertLettersIRRecords([next, base])).toThrow(/strict spine order/);
    expect(() => assertLettersIRRecords([base, { ...base }])).toThrow(/duplicate gid/);
  });

  it("validates fixture-derived LettersIR against spine one-to-one invariant", () => {
    const spine = loadSpineFixture("spine-small.jsonl");
    const rows = buildLettersIRFromSpine(spine);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.word?.id)).toEqual([
      "Genesis/1/1#w:0",
      "Genesis/1/1#w:1",
      "Genesis/1/2#w:0"
    ]);

    expect(() => assertLettersIRRecords(rows)).not.toThrow();
    expect(() => assertLettersIRRecordsAgainstSpine(rows, spine)).not.toThrow();
    expect(() => assertLettersIRRecordsAgainstSpine(rows.slice(0, 2), spine)).toThrow(
      /one per letter grapheme/
    );
  });

  it("round-trips jsonl in deterministic order without re-sorting", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "letters-ir-"));
    const filePath = path.join(tmp, "letters.ir.jsonl");
    const rows: LettersIRRecord[] = [
      {
        kind: "letter_ir",
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        letter: "א",
        op_kind: "א",
        source: { spine_digest: SPINE_DIGEST_FIXTURE }
      },
      {
        kind: "letter_ir",
        gid: "Genesis/1/1#g:1",
        ref_key: "Genesis/1/1",
        g_index: 1,
        letter: "ב",
        op_kind: "ב",
        source: { spine_digest: SPINE_DIGEST_FIXTURE }
      }
    ];

    const jsonl = formatLettersIRJsonl(rows);
    expect(parseLettersIRJsonl(jsonl).map((row) => row.gid)).toEqual(rows.map((row) => row.gid));

    await writeLettersIRJsonl(filePath, rows);
    const loaded = await readLettersIRJsonl(filePath);
    expect(loaded.map((row) => row.gid)).toEqual(rows.map((row) => row.gid));
  });
});
