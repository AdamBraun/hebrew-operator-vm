import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LETTERS_CODE_PATHS,
  computeLettersDigest,
  computeLettersLayerCodeFingerprint
} from "../../../src/layers/letters/hash";

describe("letters digest", () => {
  const baseArgs = {
    spineDigest: "a".repeat(64),
    config: {
      include_word_segmentation: true
    },
    codeFingerprint: "letters-code@1",
    version: "1.0.0"
  };

  it("is deterministic for identical inputs", () => {
    const a = computeLettersDigest(baseArgs);
    const b = computeLettersDigest(baseArgs);
    expect(a).toBe(b);
  });

  it("changes when spineDigest changes", () => {
    const baseline = computeLettersDigest(baseArgs);
    const changed = computeLettersDigest({
      ...baseArgs,
      spineDigest: "b".repeat(64)
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when config changes", () => {
    const baseline = computeLettersDigest(baseArgs);
    const changed = computeLettersDigest({
      ...baseArgs,
      config: {
        include_word_segmentation: false
      }
    });
    expect(changed).not.toBe(baseline);
  });

  it("changes when code fingerprint changes", () => {
    const baseline = computeLettersDigest(baseArgs);
    const changed = computeLettersDigest({
      ...baseArgs,
      codeFingerprint: "letters-code@2"
    });
    expect(changed).not.toBe(baseline);
  });

  it("does not depend on unrelated layer data", () => {
    const baseline = computeLettersDigest(baseArgs);
    const changed = computeLettersDigest({
      ...(baseArgs as typeof baseArgs & {
        layoutDatasetDigest: string;
        cantillationFingerprint: string;
      }),
      layoutDatasetDigest: "z".repeat(64),
      cantillationFingerprint: "cant@v9"
    });
    expect(changed).toBe(baseline);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      computeLettersDigest({
        ...baseArgs,
        spineDigest: "bad"
      })
    ).toThrow(/spineDigest/);
    expect(() =>
      computeLettersDigest({
        ...baseArgs,
        codeFingerprint: ""
      })
    ).toThrow(/codeFingerprint/);
    expect(() =>
      computeLettersDigest({
        ...baseArgs,
        config: {} as { include_word_segmentation: boolean }
      })
    ).toThrow(/include_word_segmentation/);
  });
});

describe("letters code fingerprint", () => {
  it("tracks only letters layer source files by default", () => {
    expect(DEFAULT_LETTERS_CODE_PATHS.length).toBeGreaterThan(0);
    for (const relPath of DEFAULT_LETTERS_CODE_PATHS) {
      expect(relPath.startsWith("src/layers/letters/")).toBe(true);
    }
  });

  it("is deterministic for identical file bytes and changes on file edits", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "letters-code-fp-"));
    const fileA = path.join(tmp, "a.ts");
    const fileB = path.join(tmp, "b.ts");
    fs.writeFileSync(fileA, "export const a = 1;\n", "utf8");
    fs.writeFileSync(fileB, "export const b = 2;\n", "utf8");

    const relA = path.relative(tmp, fileA);
    const relB = path.relative(tmp, fileB);

    const fp1 = await computeLettersLayerCodeFingerprint([relA, relB], tmp);
    const fp2 = await computeLettersLayerCodeFingerprint([relB, relA], tmp);
    expect(fp1).toBe(fp2);

    fs.writeFileSync(fileB, "export const b = 3;\n", "utf8");
    const fp3 = await computeLettersLayerCodeFingerprint([relA, relB], tmp);
    expect(fp3).not.toBe(fp1);
  });
});
