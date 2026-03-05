import { describe, expect, it } from "vitest";
import { type SpineRecord } from "../../src/spine/schema";
import { attachMetadataCheckpoints } from "../../src/wrapper/stitch/metadataAttach";
import { buildSpineTraversalPlan } from "../../src/wrapper/stitch/spinePlan";

function gap(refKey: string, gapIndex: number): SpineRecord {
  return {
    kind: "gap",
    gapid: `${refKey}#gap:${String(gapIndex)}`,
    ref_key: refKey,
    gap_index: gapIndex,
    raw: {
      whitespace: false,
      chars: []
    }
  };
}

function g(refKey: string, gIndex: number): SpineRecord {
  return {
    kind: "g",
    gid: `${refKey}#g:${String(gIndex)}`,
    ref_key: refKey,
    g_index: gIndex,
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

describe("metadataAttach", () => {
  it("maps checkpoint ref_key_end to ref end plan index", async () => {
    const spinePlan = await buildSpineTraversalPlan([
      gap("Genesis/1/1", 0),
      g("Genesis/1/1", 0),
      gap("Genesis/1/1", 1),
      gap("Genesis/1/2", 0),
      g("Genesis/1/2", 0),
      gap("Genesis/1/2", 1)
    ]);

    const attached = attachMetadataCheckpoints({
      spinePlan,
      metadataPlan: {
        checkpoints: [
          {
            kind: "ALIYAH_END",
            parasha_id: "bereshit",
            aliyah_index: 1,
            ref_end: "Genesis/1/1",
            checkpoint_id: "ALIYAH_END:bereshit:1:Genesis/1/1"
          },
          {
            kind: "ALIYAH_END",
            parasha_id: "bereshit",
            aliyah_index: 7,
            ref_key_end: "Genesis/1/2",
            checkpoint_id: "ALIYAH_END:bereshit:7:Genesis/1/2"
          }
        ]
      }
    });

    expect(attached.checkpoints).toEqual([
      {
        kind: "ALIYAH_END",
        parasha_id: "bereshit",
        aliyah_index: 1,
        plan_index_end: 2,
        ref_key_end: "Genesis/1/1",
        checkpoint_id: "ALIYAH_END:bereshit:1:Genesis/1/1"
      },
      {
        kind: "ALIYAH_END",
        parasha_id: "bereshit",
        aliyah_index: 7,
        plan_index_end: 5,
        ref_key_end: "Genesis/1/2",
        checkpoint_id: "ALIYAH_END:bereshit:7:Genesis/1/2"
      }
    ]);
    expect(attached.checkpointsByRefEnd["Genesis/1/1"]?.[0]?.plan_index_end).toBe(2);
    expect(attached.checkpointsByRefEnd["Genesis/1/2"]?.[0]?.plan_index_end).toBe(5);
    expect(attached.checkpointsByIndex["2"]?.[0]?.ref_key_end).toBe("Genesis/1/1");
    expect(attached.checkpointsByIndex["5"]?.[0]?.ref_key_end).toBe("Genesis/1/2");
    expect(attached.refIndexByRef).toEqual({
      "Genesis/1/1": { startPlanIndex: 0, endPlanIndex: 2 },
      "Genesis/1/2": { startPlanIndex: 3, endPlanIndex: 5 }
    });
  });

  it("emits stable ordering when parasha_end and aliyah_end share the same ref", async () => {
    const spinePlan = await buildSpineTraversalPlan([
      gap("Genesis/1/1", 0),
      g("Genesis/1/1", 0),
      gap("Genesis/1/1", 1)
    ]);

    const attached = attachMetadataCheckpoints({
      spinePlan,
      metadataPlan: {
        checkpoints: [
          {
            kind: "PARASHA_END",
            parasha_id: "bereshit",
            aliyah_index: null,
            ref_key_end: "Genesis/1/1",
            checkpoint_id: "PARASHA_END:bereshit:0:Genesis/1/1"
          },
          {
            kind: "ALIYAH_END",
            parasha_id: "bereshit",
            aliyah_index: 7,
            ref_key_end: "Genesis/1/1",
            checkpoint_id: "ALIYAH_END:bereshit:7:Genesis/1/1"
          }
        ]
      }
    });

    expect(attached.checkpoints.map((checkpoint) => checkpoint.checkpoint_id)).toEqual([
      "ALIYAH_END:bereshit:7:Genesis/1/1",
      "PARASHA_END:bereshit:0:Genesis/1/1"
    ]);
    expect(attached.checkpoints.every((checkpoint) => checkpoint.plan_index_end === 2)).toBe(true);
    expect(attached.checkpointsByIndex["2"]?.map((checkpoint) => checkpoint.kind)).toEqual([
      "ALIYAH_END",
      "PARASHA_END"
    ]);
  });

  it("fails fast when checkpoint ref is missing from spine ref index", async () => {
    const spinePlan = await buildSpineTraversalPlan([
      gap("Genesis/1/1", 0),
      g("Genesis/1/1", 0),
      gap("Genesis/1/1", 1)
    ]);

    expect(() =>
      attachMetadataCheckpoints({
        spinePlan,
        metadataPlan: {
          checkpoints: [
            {
              kind: "ALIYAH_END",
              parasha_id: "bereshit",
              aliyah_index: 1,
              ref_key_end: "Genesis/1/2"
            }
          ]
        }
      })
    ).toThrow(/checkpoint ref 'Genesis\/1\/2' does not exist in spine ref index/);
  });
});
