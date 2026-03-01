import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndResolveLayoutDataset } from "../../src/layers/layout/dataset_loader";
import {
  extractLayoutIRRecords,
  writeExtractedLayoutIRJsonl
} from "../../src/layers/layout/extract";
import {
  compareLayoutIRRecords,
  parseLayoutIRJsonl,
  type LayoutIRRecord
} from "../../src/layers/layout/schema";
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

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iter) {
    out.push(row);
  }
  return out;
}

async function extractFixtureRecords(): Promise<LayoutIRRecord[]> {
  const projection = await projectSpineGapsFromJsonl(SPINE_FIXTURE);
  const resolved = await loadAndResolveLayoutDataset(DATASET_FIXTURE, projection);

  return collectAsync(
    extractLayoutIRRecords({
      gaps: readSpineGapDescriptorsFromJsonl(SPINE_FIXTURE),
      eventsByGapid: resolved.eventsByGapid
    })
  );
}

describe("layout extractor (fixtures)", () => {
  it("emits SPACE only for whitespace gaps and dataset events exactly at declared anchors", async () => {
    const records = await extractFixtureRecords();
    expect(records).toHaveLength(5);

    const spaceGapIds = records
      .filter((row) => row.layout_event.type === "SPACE")
      .map((row) => row.gapid);
    expect(spaceGapIds).toEqual(["Genesis/1/1#gap:1", "Genesis/1/2#gap:1"]);
    expect(spaceGapIds).not.toContain("Genesis/1/1#gap:0");
    expect(spaceGapIds).not.toContain("Genesis/1/1#gap:2");
    expect(spaceGapIds).not.toContain("Genesis/1/2#gap:0");

    const datasetRows = records
      .filter((row) => row.layout_event.source === "dataset")
      .map((row) => `${row.gapid}:${row.layout_event.type}`);
    expect(datasetRows).toEqual([
      "Genesis/1/1#gap:1:SETUMA",
      "Genesis/1/2#gap:0:PETUCHA",
      "Genesis/1/2#gap:1:BOOK_BREAK"
    ]);
  });

  it("keeps deterministic record ordering by (ref order, gap_index, type)", async () => {
    const records = await extractFixtureRecords();

    for (let i = 1; i < records.length; i += 1) {
      expect(
        compareLayoutIRRecords(records[i - 1] as LayoutIRRecord, records[i] as LayoutIRRecord)
      ).toBeLessThanOrEqual(0);
    }

    expect(
      records.map((row) => `${row.ref_key}#${String(row.gap_index)}:${row.layout_event.type}`)
    ).toEqual([
      "Genesis/1/1#1:SPACE",
      "Genesis/1/1#1:SETUMA",
      "Genesis/1/2#0:PETUCHA",
      "Genesis/1/2#1:SPACE",
      "Genesis/1/2#1:BOOK_BREAK"
    ]);
  });

  it("is byte-deterministic across runs for identical inputs", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "layout-extractor-fixture-"));
    const outA = path.join(tmp, "layout-a.ir.jsonl");
    const outB = path.join(tmp, "layout-b.ir.jsonl");

    const projection = await projectSpineGapsFromJsonl(SPINE_FIXTURE);
    const resolved = await loadAndResolveLayoutDataset(DATASET_FIXTURE, projection);

    const runA = await writeExtractedLayoutIRJsonl({
      outputPath: outA,
      gaps: readSpineGapDescriptorsFromJsonl(SPINE_FIXTURE),
      eventsByGapid: resolved.eventsByGapid
    });
    const runB = await writeExtractedLayoutIRJsonl({
      outputPath: outB,
      gaps: readSpineGapDescriptorsFromJsonl(SPINE_FIXTURE),
      eventsByGapid: resolved.eventsByGapid
    });

    expect(runA.recordsWritten).toBe(5);
    expect(runB.recordsWritten).toBe(5);

    const bytesA = fs.readFileSync(outA, "utf8");
    const bytesB = fs.readFileSync(outB, "utf8");
    expect(bytesA).toBe(bytesB);
    expect(bytesA.endsWith("\n")).toBe(true);

    const parsed = parseLayoutIRJsonl(bytesA);
    expect(parsed).toHaveLength(5);
  });
});
