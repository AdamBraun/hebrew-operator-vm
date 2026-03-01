import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitLayout } from "../../../src/layers/layout/emit";
import { computeLayoutDatasetDigest } from "../../../src/layers/layout/hash";
import { parseLayoutIRJsonl } from "../../../src/layers/layout/schema";
import { type GapDescriptor } from "../../../src/layers/layout/spine_adapter";
import { type ResolvedLayoutDatasetEvent } from "../../../src/layers/layout/dataset_loader";

describe("layout emit", () => {
  it("writes digest-addressed layout.ir.jsonl + manifest with required fields and counts", async () => {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "layout-emit-test-"));
    const datasetBytes = Buffer.from(
      '{"dataset_id":"torah_layout_breaks.v1","version":"1.0.0","events":[]}\n',
      "utf8"
    );
    const layoutDatasetDigest = computeLayoutDatasetDigest(datasetBytes);

    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 0,
        gapid: "Genesis/1/1#gap:0",
        whitespace: false
      },
      {
        ref_key: "Genesis/1/1",
        gap_index: 1,
        gapid: "Genesis/1/1#gap:1",
        whitespace: true
      }
    ];
    const eventsByGapid = new Map<string, ResolvedLayoutDatasetEvent[]>([
      [
        "Genesis/1/1#gap:1",
        [
          {
            gapid: "Genesis/1/1#gap:1",
            ref_key: "Genesis/1/1",
            gap_index: 1,
            type: "SETUMA",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          }
        ]
      ]
    ]);

    const result = await emitLayout({
      gaps,
      eventsByGapid,
      spineDigest: "a".repeat(64),
      layoutDatasetDigest,
      layoutLayerCodeDigest: "layout-module@1.0.0",
      layoutConfig: {
        jsonl_trailing_newline: true
      },
      dataset: {
        dataset_id: "torah_layout_breaks.v1",
        version: "1.0.0"
      },
      outCacheDir: outRoot,
      createdAt: "2026-03-01T00:00:00.000Z"
    });

    expect(result.cacheHit).toBe(false);
    expect(result.outputDir).toBe(path.join(outRoot, result.digest));
    expect(fs.existsSync(result.layoutIrPath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);

    const layoutRows = parseLayoutIRJsonl(fs.readFileSync(result.layoutIrPath, "utf8"));
    expect(layoutRows.map((row) => row.layout_event.type)).toEqual(["SPACE", "SETUMA"]);

    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8")) as {
      layer: string;
      digest: string;
      inputs: { spineDigest: string; layoutDatasetDigest: string };
      dataset: { dataset_id: string; version: string };
      counts: {
        gapsSeen: number;
        recordsEmitted: number;
        spaceCount: number;
        setumaCount: number;
        petuchaCount: number;
        bookBreakCount: number;
      };
      created_at: string;
    };
    expect(manifest.layer).toBe("layout");
    expect(manifest.digest).toBe(result.digest);
    expect(manifest.inputs).toEqual({
      spineDigest: "a".repeat(64),
      layoutDatasetDigest
    });
    expect(manifest.dataset).toEqual({
      dataset_id: "torah_layout_breaks.v1",
      version: "1.0.0"
    });
    expect(manifest.counts).toEqual({
      gapsSeen: 2,
      recordsEmitted: 2,
      spaceCount: 1,
      setumaCount: 1,
      petuchaCount: 0,
      bookBreakCount: 0
    });
    expect(manifest.created_at).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns cache hit when digest inputs match and cached files exist", async () => {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "layout-emit-test-"));
    const layoutDatasetDigest = computeLayoutDatasetDigest("dataset-v1");
    const sharedArgs = {
      spineDigest: "b".repeat(64),
      layoutDatasetDigest,
      layoutLayerCodeDigest: "layout-module@1.0.0",
      layoutConfig: { jsonl_trailing_newline: true },
      dataset: {
        dataset_id: "torah_layout_breaks.v1",
        version: "1.0.0"
      },
      outCacheDir: outRoot
    };

    const first = await emitLayout({
      gaps: [
        {
          ref_key: "Genesis/1/1",
          gap_index: 0,
          gapid: "Genesis/1/1#gap:0",
          whitespace: true
        }
      ],
      eventsByGapid: new Map<string, ResolvedLayoutDatasetEvent[]>(),
      ...sharedArgs
    });
    expect(first.cacheHit).toBe(false);

    const second = await emitLayout({
      // should not be consumed on cache hit, because digest-addressed artifacts already exist
      gaps: [],
      eventsByGapid: new Map<string, ResolvedLayoutDatasetEvent[]>(),
      ...sharedArgs
    });
    expect(second.cacheHit).toBe(true);
    expect(second.digest).toBe(first.digest);
    expect(second.outputDir).toBe(first.outputDir);
    expect(fs.readFileSync(second.layoutIrPath, "utf8")).toBe(
      fs.readFileSync(first.layoutIrPath, "utf8")
    );
  });

  it("dataset digest changes layout digest while keeping spineDigest fixed", async () => {
    const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "layout-emit-test-"));
    const spineDigest = "c".repeat(64);
    const common = {
      gaps: [] as GapDescriptor[],
      eventsByGapid: new Map<string, ResolvedLayoutDatasetEvent[]>(),
      spineDigest,
      layoutLayerCodeDigest: "layout-module@1.0.0",
      layoutConfig: { jsonl_trailing_newline: true },
      dataset: {
        dataset_id: "torah_layout_breaks.v1",
        version: "1.0.0"
      },
      outCacheDir: outRoot
    };

    const runA = await emitLayout({
      ...common,
      layoutDatasetDigest: computeLayoutDatasetDigest("dataset-version-a")
    });
    const runB = await emitLayout({
      ...common,
      layoutDatasetDigest: computeLayoutDatasetDigest("dataset-version-b")
    });

    expect(runA.digest).not.toBe(runB.digest);
    expect(runA.manifest.inputs.spineDigest).toBe(spineDigest);
    expect(runB.manifest.inputs.spineDigest).toBe(spineDigest);
  });
});
