import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSpineForRef } from "../../src/spine/build";
import { emitSpine } from "../../src/spine/emit";
import { defaultNormalizationOptions } from "../../src/spine/options";
import { type SpineRecord } from "../../src/spine/schema";

function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function collectFromBuilder(refKey: string, text: string): Promise<SpineRecord[]> {
  const rows: SpineRecord[] = [];
  for await (const row of buildSpineForRef({
    ref_key: refKey,
    text,
    opts: defaultNormalizationOptions()
  })) {
    rows.push(row);
  }
  return rows;
}

describe("spine emit", () => {
  it("writes content-addressed JSONL and manifest with exact counts/digest", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-emit-test-"));
    const records = await collectFromBuilder("Genesis/1/1", "בָּרָא אֱלֹהִים׃");

    const result = await emitSpine({
      records,
      input: {
        path: "data/torah.normalized.txt",
        sha256: "a".repeat(64)
      },
      options: {},
      outCacheDir: tmpDir,
      createdAt: "2026-03-01T00:00:00.000Z"
    });

    expect(result.outputDir).toBe(path.join(tmpDir, result.spineDigest));
    expect(result.spinePath).toBe(path.join(result.outputDir, "spine.jsonl"));
    expect(result.manifestPath).toBe(path.join(result.outputDir, "manifest.json"));
    expect(fs.existsSync(result.spinePath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);

    const jsonl = fs.readFileSync(result.spinePath, "utf8");
    expect(jsonl.endsWith("\n")).toBe(true);
    expect(jsonl.split("\n").filter(Boolean)).toHaveLength(records.length);
    expect(sha256Hex(jsonl)).toBe(result.spineDigest);

    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8")) as {
      layer: string;
      version: string;
      created_at: string;
      input: { path: string; sha256: string };
      options: Record<string, unknown>;
      stats: { refs: number; graphemes: number; gaps: number; bytes_out: number };
      digests: { spineDigest: string };
      schema: { spine_record_version: string };
    };
    expect(manifest.layer).toBe("spine");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.created_at).toBe("2026-03-01T00:00:00.000Z");
    expect(manifest.input).toEqual({
      path: "data/torah.normalized.txt",
      sha256: "a".repeat(64)
    });
    expect(manifest.options).toEqual(defaultNormalizationOptions());
    expect(manifest.stats).toEqual({
      refs: 1,
      graphemes: records.filter((row) => row.kind === "g").length,
      gaps: records.filter((row) => row.kind === "gap").length,
      bytes_out: Buffer.byteLength(jsonl, "utf8")
    });
    expect(manifest.digests.spineDigest).toBe(result.spineDigest);
    expect(manifest.schema.spine_record_version).toBe("1.0.0");
  });

  it("uses digest-addressed path deterministically across repeated runs", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-emit-test-"));
    const records = await collectFromBuilder("Genesis/1/2", "וְהָיָה");

    const first = await emitSpine({
      records,
      input: { path: "data/input.txt", sha256: "b".repeat(64) },
      options: { normalizeFinals: true },
      outCacheDir: tmpDir,
      createdAt: "2026-03-01T00:00:00.000Z"
    });
    const second = await emitSpine({
      records,
      input: { path: "data/input.txt", sha256: "b".repeat(64) },
      options: { normalizeFinals: true },
      outCacheDir: tmpDir,
      createdAt: "2026-03-01T01:23:45.000Z"
    });

    expect(second.spineDigest).toBe(first.spineDigest);
    expect(second.outputDir).toBe(first.outputDir);
    expect(fs.readFileSync(second.spinePath, "utf8")).toBe(
      fs.readFileSync(first.spinePath, "utf8")
    );
  });

  it("supports empty record streams as valid UTF-8 JSONL output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-emit-test-"));
    const result = await emitSpine({
      records: [],
      input: { path: "data/empty.txt", sha256: "c".repeat(64) },
      options: {},
      outCacheDir: tmpDir
    });

    const jsonl = fs.readFileSync(result.spinePath, "utf8");
    expect(jsonl).toBe("");
    expect(result.spineDigest).toBe(sha256Hex(""));
    expect(result.stats).toEqual({
      refs: 0,
      graphemes: 0,
      gaps: 0,
      bytes_out: 0
    });
  });
});
