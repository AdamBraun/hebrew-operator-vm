import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadAndResolveLayoutDataset,
  type ResolvedLayoutDatasetEvent
} from "../../src/layers/layout/dataset_loader";
import { extractLayoutIRRecords } from "../../src/layers/layout/extract";
import {
  projectSpineGapsFromJsonl,
  readSpineGapDescriptorsFromJsonl
} from "../../src/layers/layout/spine_adapter";

const SPINE_FIXTURE = path.resolve(process.cwd(), "tests", "fixtures", "spine-small.jsonl");
const DATASET_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "layout-breaks-small.v1.json"
);

type LayoutDatasetFixture = {
  dataset_id: string;
  source: string;
  version: string;
  hash_algo: "sha256";
  events: Array<{
    ref_key: string;
    anchor: {
      kind: "gap";
      gap_index: number;
    };
    type: "SETUMA" | "PETUCHA" | "BOOK_BREAK";
    note?: string;
  }>;
};

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iter) {
    out.push(row);
  }
  return out;
}

function writeTmpDataset(dataset: LayoutDatasetFixture): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "layout-dataset-validation-"));
  const filePath = path.join(dir, "dataset.json");
  fs.writeFileSync(filePath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return filePath;
}

function readFixtureDataset(): LayoutDatasetFixture {
  return JSON.parse(fs.readFileSync(DATASET_FIXTURE, "utf8")) as LayoutDatasetFixture;
}

describe("layout dataset validation (fixtures)", () => {
  it("fails fast when dataset event anchor has out-of-range gap_index", async () => {
    const projection = await projectSpineGapsFromJsonl(SPINE_FIXTURE);
    const dataset = readFixtureDataset();
    dataset.events = [
      {
        ref_key: "Genesis/1/1",
        anchor: { kind: "gap", gap_index: 99 },
        type: "SETUMA",
        note: "invalid out-of-range"
      }
    ];
    const invalidPath = writeTmpDataset(dataset);

    await expect(loadAndResolveLayoutDataset(invalidPath, projection)).rejects.toThrow(
      "layout dataset event invalid: Genesis/1/1 gap_index=99 out of range (max=2)"
    );
  });

  it("fails when both SETUMA and PETUCHA target the same gap (extractor collision policy)", async () => {
    const projection = await projectSpineGapsFromJsonl(SPINE_FIXTURE);
    const dataset = readFixtureDataset();
    dataset.events = [
      {
        ref_key: "Genesis/1/1",
        anchor: { kind: "gap", gap_index: 1 },
        type: "SETUMA"
      },
      {
        ref_key: "Genesis/1/1",
        anchor: { kind: "gap", gap_index: 1 },
        type: "PETUCHA"
      }
    ];
    const collisionPath = writeTmpDataset(dataset);
    const resolved = await loadAndResolveLayoutDataset(collisionPath, projection);

    await expect(
      collectAsync(
        extractLayoutIRRecords({
          gaps: readSpineGapDescriptorsFromJsonl(SPINE_FIXTURE),
          eventsByGapid: resolved.eventsByGapid as ReadonlyMap<
            string,
            readonly ResolvedLayoutDatasetEvent[]
          >
        })
      )
    ).rejects.toThrow(/has both SETUMA and PETUCHA/);
  });
});
