import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCantillationIR } from "../../../src/layers/cantillation/extract";
import { parseCantillationIRJsonl } from "../../../src/layers/cantillation/schema";

const SPINE_DIGEST = "c".repeat(64);
const CODE_HASH = "0".repeat(64);

function hashAnchors(anchors: readonly string[]): string {
  const joined = anchors.length === 0 ? "" : `${anchors.join("\n")}\n`;
  return crypto.createHash("sha256").update(joined, "utf8").digest("hex");
}

function writeSpineFixture(baseDir: string): { spinePath: string; spineManifestPath: string } {
  const spineDir = path.join(baseDir, "outputs", "cache", "spine", SPINE_DIGEST);
  const spinePath = path.join(spineDir, "spine.jsonl");
  const spineManifestPath = path.join(spineDir, "manifest.json");
  const ref = "Genesis/1/1";

  const rows = [
    {
      kind: "gap",
      gapid: `${ref}#gap:0`,
      ref_key: ref,
      gap_index: 0,
      raw: { whitespace: false, chars: [] }
    },
    {
      kind: "g",
      gid: `${ref}#g:0`,
      ref_key: ref,
      g_index: 0,
      base_letter: "א",
      marks_raw: {
        niqqud: [],
        teamim: ["\u05A5", "\u0595"]
      },
      raw: { text: "א" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:1`,
      ref_key: ref,
      gap_index: 1,
      raw: { whitespace: false, chars: ["\u05BE"] }
    },
    {
      kind: "g",
      gid: `${ref}#g:1`,
      ref_key: ref,
      g_index: 1,
      base_letter: "ב",
      marks_raw: {
        niqqud: [],
        teamim: ["\u05AD"]
      },
      raw: { text: "ב" }
    },
    {
      kind: "gap",
      gapid: `${ref}#gap:2`,
      ref_key: ref,
      gap_index: 2,
      raw: { whitespace: false, chars: ["\u05C3"] }
    }
  ];

  fs.mkdirSync(spineDir, { recursive: true });
  fs.writeFileSync(spinePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.writeFileSync(
    spineManifestPath,
    `${JSON.stringify(
      {
        layer: "spine",
        digests: { spineDigest: SPINE_DIGEST }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { spinePath, spineManifestPath };
}

describe("cantillation extractor", () => {
  it("streams spine into deterministic cantillation ir + manifest + stats with cache reuse", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-extract-"));
    const { spinePath, spineManifestPath } = writeSpineFixture(tmp);
    const outCacheDir = path.join(tmp, "outputs", "cache", "cantillation");

    const first = await extractCantillationIR(spinePath, outCacheDir, {
      emitUnknown: true,
      dumpStats: true,
      spineManifestPath,
      codeHashOverride: CODE_HASH
    });

    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.cantillationIrPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(first.statsPath && fs.existsSync(first.statsPath)).toBe(true);
    expect(first.outputDir).toBe(path.join(outCacheDir, first.digest));

    const records = parseCantillationIRJsonl(fs.readFileSync(first.cantillationIrPath, "utf8"));
    expect(records).toHaveLength(5);
    expect(records.map((row) => row.anchor.id)).toEqual([
      "Genesis/1/1#g:0",
      "Genesis/1/1#g:0",
      "Genesis/1/1#gap:1",
      "Genesis/1/1#g:1",
      "Genesis/1/1#gap:2"
    ]);
    expect(records[0]?.event).toEqual({
      type: "TROPE_MARK",
      mark: "MERKHA",
      class: "CONJ",
      rank: null
    });
    expect(records[1]?.event).toEqual({
      type: "TROPE_MARK",
      mark: "ZAQEF_GADOL",
      class: "DISJ",
      rank: 2
    });
    expect(records[2]?.event).toEqual({
      type: "BOUNDARY",
      op: "MAQAF_GLUE",
      rank: 0,
      reason: "MAQAF"
    });
    expect(records[3]?.event).toEqual({
      type: "UNKNOWN_MARK",
      codepoint: "U+05AD",
      rank: null
    });
    expect(records[4]?.event).toEqual({
      type: "BOUNDARY",
      op: "CUT",
      rank: 3,
      reason: "SOF_PASUK"
    });
    const anchors = records.map((row) => `${row.anchor.kind}:${row.anchor.id}`);
    expect(first.manifest.cache_manifest.ordering.first_anchor).toBe(anchors[0] ?? null);
    expect(first.manifest.cache_manifest.ordering.last_anchor).toBe(
      anchors[anchors.length - 1] ?? null
    );
    expect(first.manifest.cache_manifest.ordering.anchor_hash).toBe(hashAnchors(anchors));
    expect(first.manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_size).toBe(50_000);
    expect(first.manifest.cache_manifest.ordering.rolling_anchor_hash.chunk_digests).toEqual([
      hashAnchors(anchors)
    ]);

    expect(first.stats.totals).toEqual({
      graphemes: 2,
      marks_seen: 3,
      marks_mapped: 2,
      marks_unknown: 1,
      gap_events: 2,
      events_emitted: 5,
      gid_events: 3
    });
    expect(first.stats.marks_total).toBe(3);
    expect(first.stats.marks_mapped).toBe(2);
    expect(first.stats.marks_unknown).toBe(1);
    expect(first.stats.mapped_marks).toEqual({
      MERKHA: 1,
      ZAQEF_GADOL: 1
    });
    expect(first.stats.unknown_marks).toEqual({
      "U+05AD": 1
    });
    expect(first.stats.events_total).toBe(5);
    expect(first.stats.events_by_type).toEqual({
      TROPE_MARK: 2,
      UNKNOWN_MARK: 1,
      BOUNDARY: 2
    });
    expect(first.stats.refs_with_sof_pasuk).toBe(1);
    expect(first.stats.top_refs_by_event_count).toEqual([
      {
        ref_key: "Genesis/1/1",
        event_count: 5
      }
    ]);
    expect(first.stats.ref_key_coverage.refs).toEqual([
      {
        ref_key: "Genesis/1/1",
        graphemes: 2,
        marks_seen: 3,
        marks_mapped: 2,
        marks_unknown: 1,
        gap_events: 2,
        events_emitted: 5
      }
    ]);

    const second = await extractCantillationIR(spinePath, outCacheDir, {
      emitUnknown: true,
      dumpStats: true,
      spineManifestPath,
      codeHashOverride: CODE_HASH
    });
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);

    const forced = await extractCantillationIR(spinePath, outCacheDir, {
      emitUnknown: true,
      dumpStats: true,
      force: true,
      spineManifestPath,
      codeHashOverride: CODE_HASH
    });
    expect(forced.cacheHit).toBe(false);
    expect(forced.digest).toBe(first.digest);
    expect(fs.readFileSync(forced.cantillationIrPath, "utf8")).toBe(
      fs.readFileSync(first.cantillationIrPath, "utf8")
    );
  });

  it("fails in strict mode on unknown marks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cantillation-extract-"));
    const { spinePath, spineManifestPath } = writeSpineFixture(tmp);
    const outCacheDir = path.join(tmp, "outputs", "cache", "cantillation");

    await expect(
      extractCantillationIR(spinePath, outCacheDir, {
        strict: true,
        emitUnknown: false,
        spineManifestPath,
        codeHashOverride: CODE_HASH
      })
    ).rejects.toThrow(/unknown teamim mark.*gid='Genesis\/1\/1#g:1'.*ref_key='Genesis\/1\/1'/);
  });
});
