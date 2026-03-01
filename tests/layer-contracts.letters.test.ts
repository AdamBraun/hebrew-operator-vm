import * as fsNode from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitLettersFromSpine } from "../src/layers/letters/extract";
import { parseLettersIRJsonl, type LettersIRRecord } from "../src/layers/letters/schema";

const SPINE_DIGEST = "d".repeat(64);

const FORBIDDEN_KEYS = new Set([
  "tau",
  "cut",
  "rank",
  "barrier",
  "layout",
  "layout_event",
  "setuma",
  "petucha",
  "book_break",
  "teamim",
  "taamim",
  "niqqud",
  "gc",
  "carry_state",
  "verse",
  "glue",
  "obligations"
]);

function collectKeysDeep(value: unknown, out: Set<string>): void {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectKeysDeep(entry, out);
    }
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out.add(key);
    collectKeysDeep(nested, out);
  }
}

function loadFixtureSpinePath(): string {
  return path.resolve(process.cwd(), "tests", "fixtures", "spine-small.jsonl");
}

describe("letters layer contract", () => {
  it("does not emit forbidden semantic/layout fields in LettersIR", async () => {
    const tmp = fsNode.mkdtempSync(path.join(os.tmpdir(), "letters-contract-"));
    const spinePath = loadFixtureSpinePath();

    const emitted = await emitLettersFromSpine({
      spinePath,
      outCacheDir: path.join(tmp, "cache", "letters"),
      spineDigestOverride: SPINE_DIGEST,
      codeFingerprint: "letters-contract-test",
      includeWordSegmentation: true
    });

    const jsonl = fsNode.readFileSync(emitted.lettersIrPath, "utf8");
    const rows = parseLettersIRJsonl(jsonl);
    const keySet = new Set<string>();
    collectKeysDeep(rows, keySet);

    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keySet.has(forbidden)).toBe(false);
    }
  });

  it("does not require non-spine input paths when digest/code are provided", async () => {
    const tmp = fsNode.mkdtempSync(path.join(os.tmpdir(), "letters-contract-"));
    const spinePath = loadFixtureSpinePath();
    const outCacheDir = path.join(tmp, "cache", "letters");
    const missingManifestPath = path.join(tmp, "missing-spine-manifest.json");

    const emitted = await emitLettersFromSpine({
      spinePath,
      outCacheDir,
      spineDigestOverride: SPINE_DIGEST,
      codeFingerprint: "letters-contract-test",
      spineManifestPath: missingManifestPath,
      includeWordSegmentation: true
    });

    expect(fsNode.existsSync(missingManifestPath)).toBe(false);
    expect(fsNode.existsSync(emitted.lettersIrPath)).toBe(true);
  });

  it("emits only allowed top-level fields", async () => {
    const tmp = fsNode.mkdtempSync(path.join(os.tmpdir(), "letters-contract-"));
    const spinePath = loadFixtureSpinePath();
    const emitted = await emitLettersFromSpine({
      spinePath,
      outCacheDir: path.join(tmp, "cache", "letters"),
      spineDigestOverride: SPINE_DIGEST,
      codeFingerprint: "letters-contract-test",
      includeWordSegmentation: true
    });

    const rows: LettersIRRecord[] = parseLettersIRJsonl(
      fsNode.readFileSync(emitted.lettersIrPath, "utf8")
    );
    const allowed = new Set([
      "kind",
      "gid",
      "ref_key",
      "g_index",
      "letter",
      "op_kind",
      "features",
      "word",
      "flags",
      "source"
    ]);

    for (const row of rows) {
      for (const key of Object.keys(row)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });

  it("does not emit an obligations field in LettersIR rows", async () => {
    const tmp = fsNode.mkdtempSync(path.join(os.tmpdir(), "letters-contract-"));
    const spinePath = loadFixtureSpinePath();
    const emitted = await emitLettersFromSpine({
      spinePath,
      outCacheDir: path.join(tmp, "cache", "letters"),
      spineDigestOverride: SPINE_DIGEST,
      codeFingerprint: "letters-contract-test",
      includeWordSegmentation: true
    });

    const rows: LettersIRRecord[] = parseLettersIRJsonl(
      fsNode.readFileSync(emitted.lettersIrPath, "utf8")
    );

    for (const row of rows) {
      expect(Object.prototype.hasOwnProperty.call(row, "obligations")).toBe(false);
    }
  });
});
