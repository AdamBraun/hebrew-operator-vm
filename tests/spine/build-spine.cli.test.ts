import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildSpine } from "../../src/cli/build-spine";

function makeFixtureInput(filePath: string): void {
  const payload = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [
              { n: 1, he: "בְּרֵאשִׁ֖ית" },
              { n: 2, he: "וְהָאָֽרֶץ" }
            ]
          }
        ]
      }
    ]
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

describe("build-spine cli", () => {
  it("builds once, then cache-hits, and force rebuild keeps same digest", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-spine-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    makeFixtureInput(inputPath);

    const first = await runBuildSpine([
      "--input",
      inputPath,
      "--out",
      outRoot,
      "--unicode",
      "NFC",
      "--normalize-finals=false"
    ]);
    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.spinePath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(fs.existsSync(first.aliasPath)).toBe(true);

    const firstSpineStat = fs.statSync(first.spinePath);
    const firstManifestStat = fs.statSync(first.manifestPath);

    const second = await runBuildSpine([
      `--input=${inputPath}`,
      `--out=${outRoot}`,
      "--unicode=NFC",
      "--normalize-finals=false"
    ]);
    expect(second.cacheHit).toBe(true);
    expect(second.spineDigest).toBe(first.spineDigest);
    expect(second.outputDir).toBe(first.outputDir);

    const secondSpineStat = fs.statSync(second.spinePath);
    const secondManifestStat = fs.statSync(second.manifestPath);
    expect(secondSpineStat.mtimeMs).toBe(firstSpineStat.mtimeMs);
    expect(secondManifestStat.mtimeMs).toBe(firstManifestStat.mtimeMs);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const third = await runBuildSpine([
      `--input=${inputPath}`,
      `--out=${outRoot}`,
      "--unicode=NFC",
      "--normalize-finals=false",
      "--force"
    ]);
    expect(third.cacheHit).toBe(false);
    expect(third.forced).toBe(true);
    expect(third.spineDigest).toBe(first.spineDigest);

    const thirdSpineStat = fs.statSync(third.spinePath);
    const thirdManifestStat = fs.statSync(third.manifestPath);
    expect(thirdSpineStat.mtimeMs).toBeGreaterThanOrEqual(secondSpineStat.mtimeMs);
    expect(thirdManifestStat.mtimeMs).toBeGreaterThanOrEqual(secondManifestStat.mtimeMs);

    const alias = JSON.parse(fs.readFileSync(third.aliasPath, "utf8")) as {
      layer: string;
      spineDigest: string;
      manifest_path: string;
      spine_jsonl_path: string;
    };
    expect(alias.layer).toBe("spine");
    expect(alias.spineDigest).toBe(third.spineDigest);
    expect(alias.manifest_path).toBe(third.manifestPath);
    expect(alias.spine_jsonl_path).toBe(third.spinePath);
  });
});
