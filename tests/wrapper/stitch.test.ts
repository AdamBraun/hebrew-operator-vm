import { describe, expect, it } from "vitest";
import { type LayoutIRRecord } from "../../src/layers/layout/schema";
import { type GapDescriptor } from "../../src/layers/layout/spine_adapter";
import { collectBoundaryFrames, type CantillationGapEvent } from "../../src/wrapper/stitch";

function layoutRecord(args: {
  gapid: string;
  ref_key: string;
  gap_index: number;
  type: LayoutIRRecord["layout_event"]["type"];
}): LayoutIRRecord {
  const byType = {
    SPACE: { strength: "weak", source: "spine_whitespace" },
    SETUMA: { strength: "mid", source: "dataset" },
    PETUCHA: { strength: "strong", source: "dataset" },
    BOOK_BREAK: { strength: "max", source: "dataset" }
  } as const;
  const mapped = byType[args.type];
  return {
    gapid: args.gapid,
    ref_key: args.ref_key,
    gap_index: args.gap_index,
    layout_event: {
      type: args.type,
      strength: mapped.strength,
      source: mapped.source
    }
  };
}

describe("wrapper stitch", () => {
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
      ref_key: "Genesis/1/2",
      gap_index: 0,
      gapid: "Genesis/1/2#gap:0",
      whitespace: false
    }
  ];

  it("joins layout and cantillation streams by gapid without inferring layout from whitespace", async () => {
    const layoutRecords: LayoutIRRecord[] = [
      layoutRecord({
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        type: "SETUMA"
      }),
      layoutRecord({
        gapid: "Genesis/1/2#gap:0",
        ref_key: "Genesis/1/2",
        gap_index: 0,
        type: "BOOK_BREAK"
      })
    ];

    const cantillationEvents: CantillationGapEvent[] = [
      {
        gapid: "Genesis/1/1#gap:1",
        ref_key: "Genesis/1/1",
        gap_index: 1,
        event: { type: "CUT", rank: 1 }
      },
      {
        gapid: "Genesis/1/2#gap:0",
        ref_key: "Genesis/1/2",
        gap_index: 0,
        event: { type: "SOF_PASUK" }
      }
    ];

    const frames = await collectBoundaryFrames({
      gaps,
      layoutRecords,
      cantillationGapEvents: cantillationEvents
    });

    expect(frames).toHaveLength(3);
    expect(frames[0]?.layout_events).toEqual([]);
    expect(frames[0]?.cantillation_events).toEqual([]);

    // Gap 1 is whitespace=true in spine, but wrapper only uses provided LayoutIR.
    expect(frames[1]?.layout_events.map((event) => event.type)).toEqual(["SETUMA"]);
    expect(frames[1]?.cantillation_events.map((event) => event.event.type)).toEqual(["CUT"]);

    expect(frames[2]?.layout_events.map((event) => event.type)).toEqual(["BOOK_BREAK"]);
    expect(frames[2]?.cantillation_events.map((event) => event.event.type)).toEqual(["SOF_PASUK"]);
  });

  it("requires LayoutIR by default and allows missing LayoutIR only in explicit debug mode", async () => {
    await expect(
      collectBoundaryFrames({
        gaps
      })
    ).rejects.toThrow(/LayoutIR input is required/);

    const debugFrames = await collectBoundaryFrames({
      gaps,
      allowMissingLayoutIR: true
    });
    expect(debugFrames).toHaveLength(3);
    expect(debugFrames.every((frame) => frame.layout_events.length === 0)).toBe(true);
  });

  it("fails fast when layout stream references a gapid missing from spine stream", async () => {
    const layoutRecords: LayoutIRRecord[] = [
      layoutRecord({
        gapid: "Genesis/1/9#gap:0",
        ref_key: "Genesis/1/9",
        gap_index: 0,
        type: "PETUCHA"
      })
    ];

    await expect(
      collectBoundaryFrames({
        gaps,
        layoutRecords
      })
    ).rejects.toThrow(/not present in spine gap stream/);
  });
});
