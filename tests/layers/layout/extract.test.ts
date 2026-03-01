import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type ResolvedLayoutDatasetEvent } from "../../../src/layers/layout/dataset_loader";
import {
  extractLayoutIRRecords,
  writeExtractedLayoutIRJsonl
} from "../../../src/layers/layout/extract";
import { parseLayoutIRJsonl, type LayoutIRRecord } from "../../../src/layers/layout/schema";
import { type GapDescriptor } from "../../../src/layers/layout/spine_adapter";

function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  return (async () => {
    const out: T[] = [];
    for await (const value of iter) {
      out.push(value);
    }
    return out;
  })();
}

describe("layout extractor", () => {
  it("emits SPACE and dataset events in canonical gap order", async () => {
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
      },
      {
        ref_key: "Genesis/1/1",
        gap_index: 2,
        gapid: "Genesis/1/1#gap:2",
        whitespace: false
      }
    ];

    const eventsByGapid = new Map<string, ResolvedLayoutDatasetEvent[]>([
      [
        "Genesis/1/1#gap:2",
        [
          {
            gapid: "Genesis/1/1#gap:2",
            ref_key: "Genesis/1/1",
            gap_index: 2,
            type: "PETUCHA",
            meta: {
              dataset_id: "torah_layout_breaks.v1"
            }
          }
        ]
      ],
      [
        "Genesis/1/1#gap:1",
        [
          {
            gapid: "Genesis/1/1#gap:1",
            ref_key: "Genesis/1/1",
            gap_index: 1,
            type: "SETUMA",
            meta: {
              dataset_id: "torah_layout_breaks.v1",
              note: "fixture note"
            }
          }
        ]
      ]
    ]);

    const records = await collectAsync(extractLayoutIRRecords({ gaps, eventsByGapid }));

    expect(records).toEqual<LayoutIRRecord[]>([
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: {
          type: "SPACE",
          strength: "weak",
          source: "spine_whitespace"
        }
      },
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        layout_event: {
          type: "SETUMA",
          strength: "mid",
          source: "dataset",
          meta: {
            dataset_id: "torah_layout_breaks.v1",
            note: "fixture note"
          }
        }
      },
      {
        gapid: "Genesis/1/1#gap:2",
        ref_key: "Genesis/1/1",
        gap_index: 2,
        layout_event: {
          type: "PETUCHA",
          strength: "strong",
          source: "dataset",
          meta: {
            dataset_id: "torah_layout_breaks.v1"
          }
        }
      }
    ]);
  });

  it("emits zero rows for non-whitespace gaps without dataset events", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 0,
        gapid: "Genesis/1/1#gap:0",
        whitespace: false
      }
    ];

    const records = await collectAsync(
      extractLayoutIRRecords({
        gaps,
        eventsByGapid: new Map<string, ResolvedLayoutDatasetEvent[]>()
      })
    );
    expect(records).toEqual([]);
  });

  it("rejects SETUMA and PETUCHA at the same gap", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 1,
        gapid: "Genesis/1/1#gap:1",
        whitespace: false
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
          },
          {
            gapid: "Genesis/1/1#gap:1",
            ref_key: "Genesis/1/1",
            gap_index: 1,
            type: "PETUCHA",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          }
        ]
      ]
    ]);

    await expect(collectAsync(extractLayoutIRRecords({ gaps, eventsByGapid }))).rejects.toThrow(
      /has both SETUMA and PETUCHA/
    );
  });

  it("rejects BOOK_BREAK mixed with SETUMA/PETUCHA at the same gap", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 1,
        gapid: "Genesis/1/1#gap:1",
        whitespace: false
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
            type: "BOOK_BREAK",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          },
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

    await expect(collectAsync(extractLayoutIRRecords({ gaps, eventsByGapid }))).rejects.toThrow(
      /mixes BOOK_BREAK with SETUMA\/PETUCHA/
    );
  });

  it("fails when dataset event gapids are missing from streamed spine gaps", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 0,
        gapid: "Genesis/1/1#gap:0",
        whitespace: false
      }
    ];

    const eventsByGapid = new Map<string, ResolvedLayoutDatasetEvent[]>([
      [
        "Genesis/1/1#gap:9",
        [
          {
            gapid: "Genesis/1/1#gap:9",
            ref_key: "Genesis/1/1",
            gap_index: 9,
            type: "SETUMA",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          }
        ]
      ]
    ]);

    await expect(collectAsync(extractLayoutIRRecords({ gaps, eventsByGapid }))).rejects.toThrow(
      /missing from spine gaps input/
    );
  });

  it("rejects non-canonical input gap ordering", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 2,
        gapid: "Genesis/1/1#gap:2",
        whitespace: false
      },
      {
        ref_key: "Genesis/1/1",
        gap_index: 1,
        gapid: "Genesis/1/1#gap:1",
        whitespace: true
      }
    ];

    await expect(
      collectAsync(
        extractLayoutIRRecords({
          gaps,
          eventsByGapid: new Map<string, ResolvedLayoutDatasetEvent[]>()
        })
      )
    ).rejects.toThrow(/canonical ascending order/);
  });

  it("rejects dataset event anchor mismatch against streamed gap tuple", async () => {
    const gaps: GapDescriptor[] = [
      {
        ref_key: "Genesis/1/1",
        gap_index: 1,
        gapid: "Genesis/1/1#gap:1",
        whitespace: false
      }
    ];

    const eventsByGapid = new Map<string, ResolvedLayoutDatasetEvent[]>([
      [
        "Genesis/1/1#gap:1",
        [
          {
            gapid: "Genesis/1/1#gap:1",
            ref_key: "Genesis/1/2",
            gap_index: 9,
            type: "SETUMA",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          }
        ]
      ]
    ]);

    await expect(collectAsync(extractLayoutIRRecords({ gaps, eventsByGapid }))).rejects.toThrow(
      /event anchor mismatch/
    );
  });

  it("writes canonical layout.ir.jsonl deterministically", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "layout-extract-"));
    const outOne = path.join(tmpDir, "layout.one.ir.jsonl");
    const outTwo = path.join(tmpDir, "layout.two.ir.jsonl");

    const gaps: GapDescriptor[] = [
      {
        ref_key: "Exodus/1/1",
        gap_index: 0,
        gapid: "Exodus/1/1#gap:0",
        whitespace: false
      },
      {
        ref_key: "Exodus/1/1",
        gap_index: 1,
        gapid: "Exodus/1/1#gap:1",
        whitespace: true
      },
      {
        ref_key: "Exodus/1/2",
        gap_index: 0,
        gapid: "Exodus/1/2#gap:0",
        whitespace: false
      }
    ];

    const eventsByGapid = new Map<string, ResolvedLayoutDatasetEvent[]>([
      [
        "Exodus/1/2#gap:0",
        [
          {
            gapid: "Exodus/1/2#gap:0",
            ref_key: "Exodus/1/2",
            gap_index: 0,
            type: "BOOK_BREAK",
            meta: { dataset_id: "torah_layout_breaks.v1" }
          }
        ]
      ]
    ]);

    const runOne = await writeExtractedLayoutIRJsonl({
      outputPath: outOne,
      gaps,
      eventsByGapid
    });
    const runTwo = await writeExtractedLayoutIRJsonl({
      outputPath: outTwo,
      gaps,
      eventsByGapid
    });

    expect(runOne.recordsWritten).toBe(2);
    expect(runTwo.recordsWritten).toBe(2);

    const oneText = fs.readFileSync(outOne, "utf8");
    const twoText = fs.readFileSync(outTwo, "utf8");
    expect(oneText).toBe(twoText);

    const parsed = parseLayoutIRJsonl(oneText);
    expect(parsed.map((row) => row.layout_event.type)).toEqual(["SPACE", "BOOK_BREAK"]);
  });
});
