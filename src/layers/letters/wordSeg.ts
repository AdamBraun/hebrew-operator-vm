import { type SpineRecord } from "../../spine/schema";
import { isSupportedLetterOperator } from "./opMap";

export type WordAnchor = {
  wordId: string;
  indexInWord: number;
};

export type WordAnchorByGid = Map<string, WordAnchor>;

function assertSingleRefKey(current: string, expected: string | null): string {
  if (expected === null) {
    return current;
  }
  if (current !== expected) {
    throw new Error(
      `assignWordIds: expected records from one ref_key, saw '${current}' after '${expected}'`
    );
  }
  return expected;
}

function assertUniqueGid(seen: Set<string>, gid: string): void {
  if (seen.has(gid)) {
    throw new Error(`assignWordIds: duplicate gid '${gid}'`);
  }
  seen.add(gid);
}

function wordIdFor(refKey: string, wordIndex: number): string {
  return `${refKey}#w:${String(wordIndex)}`;
}

export function assignWordIds(spineStreamForRef: Iterable<SpineRecord>): WordAnchorByGid {
  const out: WordAnchorByGid = new Map<string, WordAnchor>();
  const seenGids = new Set<string>();

  let refKey: string | null = null;
  let wordIndex = 0;
  let indexInWord = 0;
  let seenLetter = false;
  let boundaryPending = false;

  for (const row of spineStreamForRef) {
    refKey = assertSingleRefKey(row.ref_key, refKey);

    if (row.kind === "gap") {
      if (row.raw.whitespace && seenLetter) {
        // Collapse repeated whitespace runs to a single next-word transition.
        boundaryPending = true;
      }
      continue;
    }

    assertUniqueGid(seenGids, row.gid);
    if (!isSupportedLetterOperator(String(row.base_letter ?? ""))) {
      continue;
    }

    if (boundaryPending) {
      wordIndex += 1;
      indexInWord = 0;
      boundaryPending = false;
    }

    out.set(row.gid, {
      wordId: wordIdFor(row.ref_key, wordIndex),
      indexInWord
    });

    indexInWord += 1;
    seenLetter = true;
  }

  return out;
}
