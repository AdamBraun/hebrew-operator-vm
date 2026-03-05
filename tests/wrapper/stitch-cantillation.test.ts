import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type CantillationIRRecord,
  writeCantillationIRJsonl
} from "../../src/layers/cantillation/schema";
import {
  attachCantillationToBoundaryFrame,
  attachCantillationToOp,
  indexCantillationEvents,
  loadCantillationEventIndex
} from "../../src/wrapper/stitch_cantillation";
import { type SpineRecord } from "../../src/spine/schema";

function gap(ref_key: string, gap_index: number): SpineRecord {
  return {
    kind: "gap",
    gapid: `${ref_key}#gap:${String(gap_index)}`,
    ref_key,
    gap_index,
    raw: {
      whitespace: false,
      chars: []
    }
  };
}

function g(ref_key: string, g_index: number): SpineRecord {
  return {
    kind: "g",
    gid: `${ref_key}#g:${String(g_index)}`,
    ref_key,
    g_index,
    base_letter: "א",
    marks_raw: {
      niqqud: [],
      teamim: []
    },
    raw: {
      text: "א"
    }
  };
}

function signature(index: ReturnType<typeof indexCantillationEvents>): Record<string, unknown> {
  return {
    byGid: [...index.eventsByGid.entries()].map(([anchor, events]) => ({
      anchor,
      events
    })),
    byGap: [...index.eventsByGap.entries()].map(([anchor, events]) => ({
      anchor,
      events
    }))
  };
}

describe("wrapper cantillation stitch", () => {
  it("loads events into eventsByGid/eventsByGap with deterministic collision ordering", () => {
    const records: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "ZAQEF_GADOL",
          class: "DISJ",
          rank: 2
        },
        raw: { teamim: ["\u0595"] }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "MERKHA",
          class: "CONJ",
          rank: null
        },
        raw: { teamim: ["\u05A5"] }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:2" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CONJ",
          rank: 0,
          reason: "SOF_PASUK"
        },
        raw: { source: "test" }
      }
    ];

    const a = indexCantillationEvents({ records });
    const b = indexCantillationEvents({ records: [...records].reverse() });

    expect(signature(a)).toEqual(signature(b));
    expect(a.eventsByGid.get("Genesis/1/1#g:1")).toEqual([
      {
        type: "TROPE_MARK",
        mark: "MERKHA",
        class: "CONJ",
        rank: null
      },
      {
        type: "TROPE_MARK",
        mark: "ZAQEF_GADOL",
        class: "DISJ",
        rank: 2
      }
    ]);
    expect(a.eventsByGap.get("Genesis/1/1#gap:2")).toEqual([
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 3,
        reason: "SOF_PASUK"
      }
    ]);
  });

  it("attaches gid events to op records and gap events to boundary frames", () => {
    const index = indexCantillationEvents({
      records: [
        {
          kind: "cant_event",
          anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
          ref_key: "Genesis/1/1",
          event: {
            type: "TROPE_MARK",
            mark: "TIPCHA",
            class: "DISJ",
            rank: 1
          },
          raw: { teamim: ["\u0596"] }
        },
        {
          kind: "cant_event",
          anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
          ref_key: "Genesis/1/1",
          event: {
            type: "BOUNDARY",
            op: "CUT",
            rank: 2,
            reason: "PAUSE"
          },
          raw: { source: "test" }
        }
      ]
    });

    const op = attachCantillationToOp({ gid: "Genesis/1/1#g:0", op_kind: "א" }, index);
    const frame = attachCantillationToBoundaryFrame(
      { gapid: "Genesis/1/1#gap:1", ref_key: "Genesis/1/1" },
      index
    );

    expect(op.cantillation_events).toEqual([
      {
        type: "TROPE_MARK",
        mark: "TIPCHA",
        class: "DISJ",
        rank: 1
      }
    ]);
    expect(frame.cantillation_events).toEqual([
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 2,
        reason: "PAUSE"
      }
    ]);
  });

  it("can derive gap CUT events from disjunctive trope marks when wrapper owns placement", () => {
    const ref = "Genesis/1/1";
    const spineRecords: SpineRecord[] = [
      gap(ref, 0),
      g(ref, 0),
      gap(ref, 1),
      g(ref, 1),
      gap(ref, 2)
    ];
    const records: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: `${ref}#g:1` },
        ref_key: ref,
        event: {
          type: "TROPE_MARK",
          mark: "ZAQEF_GADOL",
          class: "DISJ",
          rank: 2
        },
        raw: { teamim: ["\u0595"] }
      }
    ];

    const index = indexCantillationEvents({
      records,
      spineRecords,
      policy: {
        derive_boundaries_from_trope_marks: true
      }
    });

    expect(index.eventsByGap.get(`${ref}#gap:2`)).toEqual([
      {
        type: "BOUNDARY",
        op: "CUT",
        rank: 2,
        reason: "DISJ_TROPE"
      }
    ]);
  });

  it("requires spine input when wrapper trope placement is enabled", () => {
    const records: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "TIPCHA",
          class: "DISJ",
          rank: 1
        },
        raw: { teamim: ["\u0596"] }
      }
    ];

    expect(() =>
      indexCantillationEvents({
        records,
        policy: { derive_boundaries_from_trope_marks: true }
      })
    ).toThrow(/spineRecords are required/);
  });

  it("can load index directly from cantillation.ir.jsonl", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wrapper-cantillation-index-"));
    const irPath = path.join(tmp, "cantillation.ir.jsonl");
    const records: CantillationIRRecord[] = [
      {
        kind: "cant_event",
        anchor: { kind: "gid", id: "Genesis/1/1#g:0" },
        ref_key: "Genesis/1/1",
        event: {
          type: "TROPE_MARK",
          mark: "TIPCHA",
          class: "DISJ",
          rank: 1
        },
        raw: { teamim: ["\u0596"] }
      },
      {
        kind: "cant_event",
        anchor: { kind: "gap", id: "Genesis/1/1#gap:1" },
        ref_key: "Genesis/1/1",
        event: {
          type: "BOUNDARY",
          op: "CUT",
          rank: 3,
          reason: "SOF_PASUK"
        },
        raw: { source: "sof_pasuk_char" }
      }
    ];
    await writeCantillationIRJsonl(irPath, records);

    const index = await loadCantillationEventIndex({ cantillationIrPath: irPath });
    expect(index.eventsByGid.get("Genesis/1/1#g:0")).toHaveLength(1);
    expect(index.eventsByGap.get("Genesis/1/1#gap:1")).toHaveLength(1);
  });
});
