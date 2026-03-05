import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayerNiqqud } from "../../src/cli/build-layer-niqqud";
import { parseNiqqudIRJsonl } from "../../src/layers/niqqud/schema";

const SPINE_DIGEST = "e".repeat(64);
const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");
const EXPECTED_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "niqqud.ir.expected.jsonl"
);

function hashAnchors(anchors: readonly string[]): string {
  const joined = anchors.length === 0 ? "" : `${anchors.join("\n")}\n`;
  return crypto.createHash("sha256").update(joined, "utf8").digest("hex");
}

function setupFixture(tmpRoot: string): {
  spinePath: string;
  spineManifestPath: string;
} {
  const spineDir = path.join(tmpRoot, "outputs", "cache", "spine", SPINE_DIGEST);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");

  fs.mkdirSync(spineDir, { recursive: true });
  fs.copyFileSync(SPINE_FIXTURE, spinePath);
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

  return { spinePath, spineManifestPath };
}

describe("niqqud extractor basic fixture", () => {
  it("produces expected gid-keyed rows, preserves raw marks, and classifies known marks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-basic-fixture-"));
    const { spinePath } = setupFixture(tmp);
    const outCache = path.join(tmp, "outputs", "cache", "niqqud");

    const run = await runBuildLayerNiqqud([
      "--spine",
      spinePath,
      "--out",
      outCache,
      "--code-fingerprint",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ]);

    const actual = parseNiqqudIRJsonl(fs.readFileSync(run.niqqudIrPath, "utf8"));
    const expected = parseNiqqudIRJsonl(fs.readFileSync(EXPECTED_FIXTURE, "utf8"));

    expect(actual).toEqual(expected);
    expect(actual.map((row) => row.gid)).toEqual([
      "Genesis/1/1#g:0",
      "Genesis/1/1#g:1",
      "Genesis/1/1#g:2",
      "Genesis/1/1#g:3",
      "Genesis/1/2#g:0",
      "Genesis/1/2#g:1",
      "Genesis/1/2#g:2",
      "Genesis/1/2#g:3"
    ]);

    const withDagesh = actual.find((row) => row.gid === "Genesis/1/1#g:1");
    expect(withDagesh?.raw.niqqud).toEqual(["\u05BC", "\u05B8"]);
    expect(withDagesh?.mods.classes).toEqual(["QAMATS", "DAGESH_SHURUK_DOT"]);

    const withPatah = actual.find((row) => row.gid === "Genesis/1/1#g:0");
    expect(withPatah?.mods.classes).toEqual(["PATAH"]);

    const manifest = JSON.parse(fs.readFileSync(run.manifestPath, "utf8")) as {
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
    const anchors = actual.map((row) => `gid:${row.gid}`);
    expect(manifest.cache_manifest.ordering.first_anchor).toBe(anchors[0] ?? null);
    expect(manifest.cache_manifest.ordering.last_anchor).toBe(anchors[anchors.length - 1] ?? null);
    expect(manifest.cache_manifest.ordering.anchor_hash).toBe(hashAnchors(anchors));
    expect(manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_size).toBe(50_000);
    expect(manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_digests).toEqual([
      hashAnchors(anchors)
    ]);
  });
});
