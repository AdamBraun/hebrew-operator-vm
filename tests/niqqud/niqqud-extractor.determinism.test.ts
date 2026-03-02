import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayerNiqqud } from "../../src/cli/build-layer-niqqud";

const SPINE_DIGEST = "f".repeat(64);
const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine.small.jsonl");

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

describe("niqqud extractor determinism", () => {
  it("emits byte-identical niqqud.ir.jsonl for identical input and config", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "niqqud-determinism-fixture-"));
    const { spinePath } = setupFixture(tmp);

    const runA = await runBuildLayerNiqqud([
      "--spine",
      spinePath,
      "--out",
      path.join(tmp, "outputs", "cache", "niqqud-a"),
      "--code-fingerprint",
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    ]);
    const runB = await runBuildLayerNiqqud([
      "--spine",
      spinePath,
      "--out",
      path.join(tmp, "outputs", "cache", "niqqud-b"),
      "--code-fingerprint",
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    ]);

    const bytesA = fs.readFileSync(runA.niqqudIrPath, "utf8");
    const bytesB = fs.readFileSync(runB.niqqudIrPath, "utf8");

    expect(bytesA).toBe(bytesB);
    expect(bytesA.endsWith("\n")).toBe(true);
  });
});
