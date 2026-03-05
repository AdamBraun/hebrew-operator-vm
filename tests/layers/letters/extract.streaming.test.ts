import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitLettersFromSpine } from "../../../src/layers/letters/extract";
import { parseLettersIRJsonl } from "../../../src/layers/letters/schema";

const SPINE_DIGEST = "c".repeat(64);

function hashAnchors(anchors: readonly string[]): string {
  const joined = anchors.length === 0 ? "" : `${anchors.join("\n")}\n`;
  return crypto.createHash("sha256").update(joined, "utf8").digest("hex");
}

function setupFixture(tmpRoot: string): {
  spinePath: string;
  spineManifestPath: string;
  lettersCacheDir: string;
} {
  const spineDir = path.join(tmpRoot, "outputs", "cache", "spine", SPINE_DIGEST);
  const lettersCacheDir = path.join(tmpRoot, "outputs", "cache", "letters");
  const fixtureSpine = path.resolve(process.cwd(), "tests", "fixtures", "spine-small.jsonl");
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");

  fs.mkdirSync(spineDir, { recursive: true });
  fs.copyFileSync(fixtureSpine, spinePath);
  fs.writeFileSync(
    spineManifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: {
          spineDigest: SPINE_DIGEST
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath, spineManifestPath, lettersCacheDir };
}

describe("letters extractor streaming", () => {
  it("streams spine jsonl to letters ir + manifest with deterministic ordering", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "letters-streaming-"));
    const { spinePath, spineManifestPath, lettersCacheDir } = setupFixture(tmp);

    const first = await emitLettersFromSpine({
      spinePath,
      spineManifestPath,
      outCacheDir: lettersCacheDir,
      includeWordSegmentation: true
    });

    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.lettersIrPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(first.outputDir).toBe(path.join(lettersCacheDir, first.digest));

    const jsonl = fs.readFileSync(first.lettersIrPath, "utf8");
    const records = parseLettersIRJsonl(jsonl);
    expect(records.map((row) => row.gid)).toEqual([
      "Genesis/1/1#g:0",
      "Genesis/1/1#g:1",
      "Genesis/1/2#g:0"
    ]);
    expect(records.map((row) => row.word?.id)).toEqual([
      "Genesis/1/1#w:0",
      "Genesis/1/1#w:1",
      "Genesis/1/2#w:0"
    ]);

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      version: string;
      inputs: { spine_digest: string; spine_path: string };
      config: { include_word_segmentation: boolean; strict_letters: boolean };
      outputs: { letters_ir_path: string };
      counts: { letters_emitted: number; refs_seen: number };
      cache_manifest: {
        ordering: {
          first_anchor: string | null;
          last_anchor: string | null;
          anchor_hash: string;
          rolling_anchor_hash: {
            chunk_size: number;
            chunk_digests: string[];
          };
        };
      };
    };
    expect(manifest.layer).toBe("letters");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.inputs.spine_digest).toBe(SPINE_DIGEST);
    expect(manifest.inputs.spine_path).toBe(spinePath);
    expect(manifest.config.include_word_segmentation).toBe(true);
    expect(manifest.config.strict_letters).toBe(false);
    expect(manifest.outputs.letters_ir_path).toBe(first.lettersIrPath);
    expect(manifest.counts).toEqual({
      letters_emitted: 3,
      refs_seen: 2
    });
    expect(records).toHaveLength(manifest.counts.letters_emitted);
    const anchors = records.map((row) => `gid:${row.gid}`);
    expect(manifest.cache_manifest.ordering.first_anchor).toBe(anchors[0] ?? null);
    expect(manifest.cache_manifest.ordering.last_anchor).toBe(anchors[anchors.length - 1] ?? null);
    expect(manifest.cache_manifest.ordering.anchor_hash).toBe(hashAnchors(anchors));
    expect(manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_size).toBe(50_000);
    expect(manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_digests).toEqual([
      hashAnchors(anchors)
    ]);

    const second = await emitLettersFromSpine({
      spinePath,
      spineManifestPath,
      outCacheDir: lettersCacheDir,
      includeWordSegmentation: true
    });
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);

    const forced = await emitLettersFromSpine({
      spinePath,
      spineManifestPath,
      outCacheDir: lettersCacheDir,
      includeWordSegmentation: true,
      force: true
    });
    expect(forced.cacheHit).toBe(false);
    expect(forced.digest).toBe(first.digest);
    expect(fs.readFileSync(forced.lettersIrPath, "utf8")).toBe(jsonl);
  });
});
