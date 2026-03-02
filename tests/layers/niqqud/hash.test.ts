import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NIQQUD_CODE_PATHS,
  computeNiqqudConfigDigest,
  computeNiqqudDigest,
  computeNiqqudLayerCodeFingerprint
} from "../../../src/layers/niqqud/hash";

describe("niqqud digest", () => {
  const baseArgs = {
    spineDigest: "a".repeat(64),
    config: {
      format: "jsonl",
      emit_stats: true,
      strict: false
    },
    codeFingerprint: "niqqud-code@1",
    layerVersion: 1
  };

  it("is deterministic for identical inputs", () => {
    const a = computeNiqqudDigest(baseArgs);
    const b = computeNiqqudDigest(baseArgs);
    expect(a).toBe(b);
  });

  it("changes when spineDigest changes", () => {
    const baseline = computeNiqqudDigest(baseArgs);
    const changed = computeNiqqudDigest({
      ...baseArgs,
      spineDigest: "b".repeat(64)
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when config changes", () => {
    const baseline = computeNiqqudDigest(baseArgs);
    const changed = computeNiqqudDigest({
      ...baseArgs,
      config: {
        format: "jsonl",
        emit_stats: false,
        strict: false
      }
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when codeFingerprint changes", () => {
    const baseline = computeNiqqudDigest(baseArgs);
    const changed = computeNiqqudDigest({
      ...baseArgs,
      codeFingerprint: "niqqud-code@2"
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when layerVersion changes", () => {
    const baseline = computeNiqqudDigest(baseArgs);
    const changed = computeNiqqudDigest({
      ...baseArgs,
      layerVersion: 2
    });
    expect(changed).not.toBe(baseline);
  });

  it("uses stable key ordering for config objects", () => {
    const a = computeNiqqudDigest({
      ...baseArgs,
      config: {
        format: "jsonl",
        emit_stats: true,
        strict: false
      }
    });
    const b = computeNiqqudDigest({
      ...baseArgs,
      config: {
        strict: false,
        emit_stats: true,
        format: "jsonl"
      }
    });
    expect(a).toBe(b);
  });

  it("does not depend on unrelated layer digests", () => {
    const baseline = computeNiqqudDigest(baseArgs);
    const changed = computeNiqqudDigest({
      ...(baseArgs as typeof baseArgs & {
        lettersDigest: string;
        cantillationDigest: string;
        layoutDigest: string;
      }),
      lettersDigest: "c".repeat(64),
      cantillationDigest: "d".repeat(64),
      layoutDigest: "e".repeat(64)
    });
    expect(changed).toBe(baseline);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      computeNiqqudDigest({
        ...baseArgs,
        spineDigest: "not-sha"
      })
    ).toThrow(/spineDigest/);
    expect(() =>
      computeNiqqudDigest({
        ...baseArgs,
        config: [] as unknown as object
      })
    ).toThrow(/config/);
    expect(() =>
      computeNiqqudDigest({
        ...baseArgs,
        codeFingerprint: ""
      })
    ).toThrow(/codeFingerprint/);
    expect(() =>
      computeNiqqudDigest({
        ...baseArgs,
        layerVersion: -1
      })
    ).toThrow(/layerVersion/);
  });
});

describe("niqqud config digest", () => {
  it("is deterministic and key-order independent", () => {
    const a = computeNiqqudConfigDigest({
      format: "jsonl",
      emit_stats: true,
      strict: false
    });
    const b = computeNiqqudConfigDigest({
      strict: false,
      emit_stats: true,
      format: "jsonl"
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("niqqud code fingerprint", () => {
  it("tracks only niqqud layer source files by default", () => {
    expect(DEFAULT_NIQQUD_CODE_PATHS.length).toBeGreaterThan(0);
    for (const relPath of DEFAULT_NIQQUD_CODE_PATHS) {
      expect(relPath.startsWith("src/layers/niqqud/")).toBe(true);
    }
  });

  it("is deterministic for identical file bytes and changes on file edits", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-code-fp-"));
    const fileA = path.join(tmp, "a.ts");
    const fileB = path.join(tmp, "b.ts");
    fs.writeFileSync(fileA, "export const a = 1;\n", "utf8");
    fs.writeFileSync(fileB, "export const b = 2;\n", "utf8");

    const relA = path.relative(tmp, fileA);
    const relB = path.relative(tmp, fileB);

    const fp1 = await computeNiqqudLayerCodeFingerprint([relA, relB], tmp);
    const fp2 = await computeNiqqudLayerCodeFingerprint([relB, relA], tmp);
    expect(fp1).toBe(fp2);

    fs.writeFileSync(fileB, "export const b = 3;\n", "utf8");
    const fp3 = await computeNiqqudLayerCodeFingerprint([relA, relB], tmp);
    expect(fp3).not.toBe(fp1);
  });
});
