import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeBundleDiffIndex,
  computeVerseDiff,
  type DiffBundleSnapshot
} from "../../packages/ui/src/lib/diff";
import type { RenderOutputRecord } from "../../packages/ui/src/lib/contracts";
import type { VerseBundle } from "../../packages/ui/src/lib/data/loader";

const DATA_DIR = path.resolve(process.cwd(), "packages", "ui", "public", "data");

describe("diff logic fixtures", () => {
  it("detects changed verses between fixture bundles", () => {
    const leftBundle = readBundleSnapshot("diff-a");
    const rightBundle = readBundleSnapshot("diff-b");

    const result = computeBundleDiffIndex(leftBundle, rightBundle);

    expect(result.totalVerses).toBe(2);
    expect(result.changedVerses).toHaveLength(1);
    expect(result.changedVerses[0]).toMatchObject({
      refKey: "Genesis/1/1",
      paraphraseChanged: true,
      skeletonChanged: true,
      phraseTreeChanged: true
    });
  });

  it("computes paraphrase, ledger, and skeleton deltas for a changed verse", () => {
    const leftSide = readVerseSide("diff-a", "Genesis/1/1");
    const rightSide = readVerseSide("diff-b", "Genesis/1/1");

    const result = computeVerseDiff(leftSide, rightSide);

    expect(result.hasChanges).toBe(true);
    expect(result.paraphraseDiffs.find((entry) => entry.style === "strict")?.changed).toBe(true);
    expect(result.paraphraseDiffs.find((entry) => entry.style === "strict")?.leftText).toContain(
      "In beginning"
    );
    expect(result.paraphraseDiffs.find((entry) => entry.style === "strict")?.rightText).toContain(
      "At first light"
    );

    expect(result.wordSkeletonDiffs).toHaveLength(1);
    expect(result.wordSkeletonDiffs[0]?.wordIndex).toBe(1);
    expect(result.wordSkeletonDiffs[0]?.leftSkeleton).toEqual(["HE.DECLARE"]);
    expect(result.wordSkeletonDiffs[0]?.rightSkeleton).toEqual(["MEM.OPEN", "HE.DECLARE_BREATH"]);

    expect(
      result.ledgerAnchorDiffs.some(
        (entry) =>
          entry.linkedWordIndex === 1 &&
          entry.linkedSkeletonChanged &&
          entry.addedPointers.some((pointer) => pointer.includes("#e0-1"))
      )
    ).toBe(true);
  });
});

function readBundleSnapshot(tag: string): DiffBundleSnapshot {
  const manifestPath = path.join(DATA_DIR, tag, "ui-manifest.json");
  const refsPath = path.join(DATA_DIR, tag, "refs", "index.json");

  return {
    tag,
    manifest: readJson(manifestPath),
    refsIndex: readJson(refsPath)
  };
}

function readVerseSide(
  tag: string,
  refKey: string
): { verseBundle: VerseBundle | null; paraphraseRecords: RenderOutputRecord[] } {
  const refs = readJson<Record<string, Record<string, string>>>(
    path.join(DATA_DIR, tag, "refs", "index.json")
  );

  const wordsPath = refs.roles[refKey];
  const versePath = refs.verses[refKey];
  const paraphrasePath = refs.paraphrase[refKey];

  const wordChunk = wordsPath
    ? readJson<{
        ref: VerseBundle["ref"];
        word_traces: VerseBundle["word_traces"];
        word_phrase_roles: VerseBundle["word_phrase_roles"];
      }>(path.join(DATA_DIR, tag, wordsPath))
    : null;
  const verseChunk = versePath
    ? readJson<{
        verse_phrase_tree: NonNullable<VerseBundle["phrase_tree"]>;
      }>(path.join(DATA_DIR, tag, versePath))
    : null;
  const paraphraseChunk = paraphrasePath
    ? readJson<{ records: RenderOutputRecord[] }>(path.join(DATA_DIR, tag, paraphrasePath))
    : null;

  return {
    verseBundle:
      wordChunk || verseChunk
        ? {
            ref_key: refKey,
            ref: wordChunk?.ref ?? {
              book: "Genesis",
              chapter: 1,
              verse: 1
            },
            word_traces: wordChunk?.word_traces ?? [],
            word_phrase_roles: wordChunk?.word_phrase_roles ?? [],
            phrase_tree: verseChunk?.verse_phrase_tree ?? null
          }
        : null,
    paraphraseRecords: paraphraseChunk?.records ?? []
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
