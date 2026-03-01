import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitLettersFromSpine } from "../src/layers/letters/extract";
import { parseLettersIRJsonl } from "../src/layers/letters/schema";

const SPINE_DIGEST = "e".repeat(64);
const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");
const EXPECTED_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "letters.expected.jsonl");

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

describe("letters extractor snapshot fixture", () => {
  it("is byte-deterministic and matches the golden expected output", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "letters-snapshot-fixture-"));
    const { spinePath, spineManifestPath } = setupFixture(tmp);
    const cacheDirA = path.join(tmp, "outputs", "cache", "letters-a");
    const cacheDirB = path.join(tmp, "outputs", "cache", "letters-b");

    const runA = await emitLettersFromSpine({
      spinePath,
      spineManifestPath,
      outCacheDir: cacheDirA,
      includeWordSegmentation: true,
      strictLetters: false,
      codeFingerprint: "letters-snapshot-fixture"
    });
    const runB = await emitLettersFromSpine({
      spinePath,
      spineManifestPath,
      outCacheDir: cacheDirB,
      includeWordSegmentation: true,
      strictLetters: false,
      codeFingerprint: "letters-snapshot-fixture"
    });

    const bytesA = fs.readFileSync(runA.lettersIrPath, "utf8");
    const bytesB = fs.readFileSync(runB.lettersIrPath, "utf8");
    const expected = fs.readFileSync(EXPECTED_FIXTURE, "utf8");

    expect(bytesA).toBe(bytesB);
    expect(bytesA).toBe(expected);
    expect(bytesA.endsWith("\n")).toBe(true);
    expect(parseLettersIRJsonl(bytesA)).toHaveLength(7);
  });
});
