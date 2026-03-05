import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndResolveLayoutDataset } from "../../../src/layers/layout/dataset_loader";
import { projectSpineGapsFromJsonl } from "../../../src/layers/layout/spine_adapter";

function writeTmpFile(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "layout-dataset-loader-"));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("layout dataset loader", () => {
  it("resolves dataset events to gapids deterministically", async () => {
    const spineJsonl = [
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:0",
        ref_key: "Genesis/1/1",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      }),
      JSON.stringify({
        kind: "g",
        gid: "Genesis/1/1#g:0",
        ref_key: "Genesis/1/1",
        g_index: 0,
        base_letter: "א",
        marks_raw: { niqqud: [], teamim: [] },
        raw: { text: "א" }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        raw: { whitespace: true, chars: [] }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/2#gap:0",
        ref_key: "Genesis/1/2",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      }),
      ""
    ].join("\n");
    const spinePath = writeTmpFile("spine.jsonl", spineJsonl);
    const projection = await projectSpineGapsFromJsonl(spinePath);

    const datasetJson = JSON.stringify(
      {
        dataset_id: "torah_layout_breaks.v1",
        source: "test fixture",
        version: "1.0.0",
        hash_algo: "sha256",
        events: [
          {
            ref_key: "Genesis/1/2",
            anchor: { kind: "gap", gap_index: 0 },
            type: "BOOK_BREAK"
          },
          {
            ref_key: "Genesis/1/1",
            anchor: { kind: "gap", gap_index: 1 },
            type: "SETUMA",
            note: "fixture note"
          }
        ]
      },
      null,
      2
    );
    const datasetPath = writeTmpFile("torah_layout_breaks.v1.json", `${datasetJson}\n`);

    const resolved = await loadAndResolveLayoutDataset(datasetPath, projection);

    expect(resolved.events).toEqual([
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        type: "SETUMA",
        meta: {
          dataset_id: "torah_layout_breaks.v1",
          note: "fixture note"
        }
      },
      {
        gapid: "Genesis/1/2#gap:0",
        ref_key: "Genesis/1/2",
        gap_index: 0,
        type: "BOOK_BREAK",
        meta: {
          dataset_id: "torah_layout_breaks.v1"
        }
      }
    ]);

    expect(resolved.eventsByGapid.get("Genesis/1/1#gap:1")).toHaveLength(1);
    expect(resolved.eventsByGapid.get("Genesis/1/2#gap:0")).toHaveLength(1);
  });

  it("fails fast with clear out-of-range message", async () => {
    const spineJsonl = [
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:0",
        ref_key: "Genesis/1/1",
        gap_index: 0,
        raw: { whitespace: false, chars: [] }
      }),
      JSON.stringify({
        kind: "gap",
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        raw: { whitespace: false, chars: [] }
      }),
      ""
    ].join("\n");
    const spinePath = writeTmpFile("spine.jsonl", spineJsonl);
    const projection = await projectSpineGapsFromJsonl(spinePath);

    const invalidDatasetJson = JSON.stringify(
      {
        dataset_id: "torah_layout_breaks.v1",
        source: "invalid fixture",
        version: "1.0.0",
        hash_algo: "sha256",
        events: [
          {
            ref_key: "Genesis/1/1",
            anchor: { kind: "gap", gap_index: 9 },
            type: "SETUMA"
          }
        ]
      },
      null,
      2
    );
    const datasetPath = writeTmpFile("invalid_dataset.json", `${invalidDatasetJson}\n`);

    await expect(loadAndResolveLayoutDataset(datasetPath, projection)).rejects.toThrow(
      "layout dataset event invalid: Genesis/1/1 gap_index=9 out of range (max=1)"
    );
  });
});
