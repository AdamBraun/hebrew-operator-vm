import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayer } from "../../../src/cli/build-layer";
import { runBuildSpine } from "../../../src/cli/build-spine";

function makeFixtureInput(filePath: string): void {
  const payload = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1, he: "א ב" }]
          }
        ]
      }
    ]
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function writeDataset(filePath: string, note: string): void {
  const dataset = {
    dataset_id: "torah_layout_breaks.v1",
    source: "test fixture",
    version: "1.0.0",
    hash_algo: "sha256",
    events: [
      {
        ref_key: "Genesis/1/1",
        anchor: { kind: "gap", gap_index: 1 },
        type: "SETUMA",
        note
      }
    ]
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}

describe("build-layer cli (layout)", () => {
  it("builds layout from spine+dataset and cache-hits on repeated run", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-layout-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "layout");
    const datasetPath = path.join(tmp, "datasets", "layout.json");

    makeFixtureInput(inputPath);
    writeDataset(datasetPath, "v1");

    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const first = await runBuildLayer([
      "--layer",
      "layout",
      "--spine",
      spine.spinePath,
      "--dataset",
      datasetPath,
      "--out",
      outCache
    ]);
    expect(first.layer).toBe("layout");
    expect(first.cacheHit).toBe(false);
    expect(fs.existsSync(first.layoutIrPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);
    expect(fs.existsSync(first.aliasPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      inputs: { spineDigest: string; layoutDatasetDigest: string };
      counts: {
        gapsSeen: number;
        recordsEmitted: number;
        spaceCount: number;
        setumaCount: number;
        petuchaCount: number;
        bookBreakCount: number;
      };
    };
    expect(manifest.layer).toBe("layout");
    expect(manifest.inputs.spineDigest).toBe(spine.spineDigest);
    expect(manifest.counts).toEqual({
      gapsSeen: 3,
      recordsEmitted: 2,
      spaceCount: 1,
      setumaCount: 1,
      petuchaCount: 0,
      bookBreakCount: 0
    });

    const second = await runBuildLayer([
      "--layer=layout",
      `--spine=${spine.spinePath}`,
      `--dataset=${datasetPath}`,
      `--out=${outCache}`
    ]);
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
  });

  it("changes layout digest when dataset bytes change while spineDigest stays stable", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-layout-cli-"));
    const inputPath = path.join(tmp, "data", "torah.json");
    const outRoot = path.join(tmp, "outputs");
    const outCache = path.join(outRoot, "cache", "layout");
    const datasetA = path.join(tmp, "datasets", "layout.a.json");
    const datasetB = path.join(tmp, "datasets", "layout.b.json");

    makeFixtureInput(inputPath);
    writeDataset(datasetA, "v1");
    writeDataset(datasetB, "v2");

    const spine = await runBuildSpine(["--input", inputPath, "--out", outRoot]);

    const runA = await runBuildLayer([
      "--layer",
      "layout",
      "--spine",
      spine.spinePath,
      "--dataset",
      datasetA,
      "--out",
      outCache
    ]);
    const runB = await runBuildLayer([
      "--layer",
      "layout",
      "--spine",
      spine.spinePath,
      "--dataset",
      datasetB,
      "--out",
      outCache
    ]);

    expect(runA.digest).not.toBe(runB.digest);

    const manifestA = JSON.parse(fs.readFileSync(runA.manifestPath, "utf8")) as {
      inputs: { spineDigest: string; layoutDatasetDigest: string };
    };
    const manifestB = JSON.parse(fs.readFileSync(runB.manifestPath, "utf8")) as {
      inputs: { spineDigest: string; layoutDatasetDigest: string };
    };
    expect(manifestA.inputs.spineDigest).toBe(spine.spineDigest);
    expect(manifestB.inputs.spineDigest).toBe(spine.spineDigest);
    expect(manifestA.inputs.layoutDatasetDigest).not.toBe(manifestB.inputs.layoutDatasetDigest);
  });
});
