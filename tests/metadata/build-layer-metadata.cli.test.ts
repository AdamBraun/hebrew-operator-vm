import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBuildLayerMetadata } from "../../src/cli/build-layer-metadata";

const CREATED_AT = "2026-03-03T00:00:00.000Z";

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeFixtureTorahJson(filePath: string): void {
  const payload = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1 }, { n: 2 }]
          }
        ]
      },
      {
        name: "Exodus",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1 }, { n: 2 }]
          }
        ]
      },
      {
        name: "Leviticus",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1 }, { n: 2 }]
          }
        ]
      },
      {
        name: "Numbers",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1 }, { n: 2 }]
          }
        ]
      },
      {
        name: "Deuteronomy",
        chapters: [
          {
            n: 1,
            verses: [{ n: 1 }, { n: 2 }]
          }
        ]
      }
    ]
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeFixtureDatasetJson(filePath: string): void {
  const payload = {
    dataset_id: "torah_1y_plan.v1",
    scope: "torah",
    cycle: "one_year",
    notes: "tiny fixture dataset for metadata cli",
    parashot: [
      {
        parasha_id: "TinyParasha",
        parasha_name_he: "קטן",
        parasha_name_en: "Tiny",
        range: {
          start: "Genesis/1/1",
          end: "Deuteronomy/1/2"
        },
        aliyot: [
          {
            aliyah_index: 1,
            range: { start: "Genesis/1/1", end: "Genesis/1/2" }
          },
          {
            aliyah_index: 2,
            range: { start: "Exodus/1/1", end: "Exodus/1/1" }
          },
          {
            aliyah_index: 3,
            range: { start: "Exodus/1/2", end: "Leviticus/1/1" }
          },
          {
            aliyah_index: 4,
            range: { start: "Leviticus/1/2", end: "Numbers/1/1" }
          },
          {
            aliyah_index: 5,
            range: { start: "Numbers/1/2", end: "Numbers/1/2" }
          },
          {
            aliyah_index: 6,
            range: { start: "Deuteronomy/1/1", end: "Deuteronomy/1/1" }
          },
          {
            aliyah_index: 7,
            range: { start: "Deuteronomy/1/2", end: "Deuteronomy/1/2" }
          }
        ]
      }
    ]
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

describe("build-layer-metadata cli", () => {
  it("builds metadata.plan.json + manifest and cache-hits on repeat", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-metadata-cli-"));
    const datasetPath = path.join(tmp, "dataset.json");
    const torahJsonPath = path.join(tmp, "torah.json");
    const outRoot = path.join(tmp, "outputs", "cache", "metadata");

    writeFixtureDatasetJson(datasetPath);
    writeFixtureTorahJson(torahJsonPath);

    const first = await runBuildLayerMetadata([
      "--dataset",
      datasetPath,
      "--torah-json",
      torahJsonPath,
      "--out",
      outRoot,
      "--created-at",
      CREATED_AT
    ]);

    expect(first.layer).toBe("metadata");
    expect(first.cacheHit).toBe(false);
    expect(first.outputDir).toBe(path.join(outRoot, first.digest));
    expect(fs.existsSync(first.metadataPlanPath)).toBe(true);
    expect(fs.existsSync(first.manifestPath)).toBe(true);

    const plan = JSON.parse(fs.readFileSync(first.metadataPlanPath, "utf8")) as {
      ir_version: string;
      dataset_id: string;
      checkpoints: unknown[];
    };
    expect(plan.ir_version).toBe("metadata_plan_ir.v1");
    expect(plan.dataset_id).toBe("torah_1y_plan.v1");
    expect(Array.isArray(plan.checkpoints)).toBe(true);
    expect(plan.checkpoints.length).toBe(8);

    const manifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8")) as {
      layer: string;
      layer_version: string;
      dataset_id: string;
      dataset_digest: string;
      ref_order_digest: string;
      output_digest: string;
      inputs: {
        dataset_path: string;
        ref_order_path: string;
      };
      artifacts: string[];
    };
    expect(manifest.layer).toBe("metadata");
    expect(manifest.layer_version).toBe("1.0.0");
    expect(manifest.dataset_id).toBe("torah_1y_plan.v1");
    expect(manifest.dataset_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.ref_order_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.output_digest).toBe(sha256Hex(fs.readFileSync(first.metadataPlanPath)));
    expect(manifest.inputs.dataset_path).toBe(path.resolve(datasetPath));
    expect(manifest.inputs.ref_order_path).toBe(path.resolve(torahJsonPath));
    expect(manifest.artifacts).toEqual(
      expect.arrayContaining(["metadata.plan.json", "manifest.json"])
    );

    const second = await runBuildLayerMetadata([
      "--dataset",
      datasetPath,
      "--torah-json",
      torahJsonPath,
      "--out",
      outRoot,
      "--created-at",
      CREATED_AT
    ]);
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
  });

  it("changes cache key when metadata config changes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-layer-metadata-cli-config-"));
    const datasetPath = path.join(tmp, "dataset.json");
    const torahJsonPath = path.join(tmp, "torah.json");
    const outRoot = path.join(tmp, "outputs", "cache", "metadata");

    writeFixtureDatasetJson(datasetPath);
    writeFixtureTorahJson(torahJsonPath);

    const noRanges = await runBuildLayerMetadata([
      "--dataset",
      datasetPath,
      "--torah-json",
      torahJsonPath,
      "--out",
      outRoot,
      "--include-ranges=false",
      "--created-at",
      CREATED_AT
    ]);
    const withRanges = await runBuildLayerMetadata([
      "--dataset",
      datasetPath,
      "--torah-json",
      torahJsonPath,
      "--out",
      outRoot,
      "--include-ranges=true",
      "--created-at",
      CREATED_AT
    ]);

    expect(noRanges.digest).not.toBe(withRanges.digest);
    expect(withRanges.cacheHit).toBe(false);
  });
});
