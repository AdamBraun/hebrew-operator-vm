import { describe, expect, it } from "vitest";
import {
  buildWrapperMetadataConsumption,
  createDisabledMetadataPlan,
  formatDisabledMetadataPlanJson,
  isMetadataDisabledArg,
  metadataCheckpointFolderSegments
} from "../../src/wrapper/checkpoints/metadata";
import { formatMetadataCheckpointId, type MetadataPlanIR } from "../../src/ir/metadata_ir";

function makePlan(): MetadataPlanIR {
  return {
    ir_version: "metadata_plan_ir.v1",
    dataset_id: "torah_1y_plan.v1",
    scope: "torah",
    cycle: "one_year",
    ref_order_source: "corpus_index",
    generated_at: "2026-03-02T00:00:00.000Z",
    plan_digest: "a".repeat(64),
    parashot: [
      {
        parasha_id: "bereshit",
        parasha_name_he: "בראשית",
        parasha_name_en: "Bereshit",
        range: {
          start: "Genesis/1/1",
          end: "Genesis/6/8"
        },
        aliyot: [
          {
            aliyah_index: 1,
            range: {
              start: "Genesis/1/1",
              end: "Genesis/2/3"
            }
          }
        ]
      }
    ],
    checkpoints: [
      {
        checkpoint_id: formatMetadataCheckpointId({
          kind: "ALIYAH_END",
          parasha_id: "bereshit",
          aliyah_index: 1,
          ref_key_end: "Genesis/2/3"
        }),
        kind: "ALIYAH_END",
        parasha_id: "bereshit",
        aliyah_index: 1,
        ref_key_end: "Genesis/2/3",
        ordinal: 10
      },
      {
        checkpoint_id: formatMetadataCheckpointId({
          kind: "PARASHA_END",
          parasha_id: "bereshit",
          aliyah_index: null,
          ref_key_end: "Genesis/6/8"
        }),
        kind: "PARASHA_END",
        parasha_id: "bereshit",
        aliyah_index: null,
        ref_key_end: "Genesis/6/8",
        ordinal: 20
      }
    ]
  };
}

describe("wrapper metadata checkpoint contract", () => {
  it("builds deterministic schedule/indexes in metadata mode on", () => {
    const consumption = buildWrapperMetadataConsumption({
      mode: "on",
      plan: makePlan()
    });

    expect(consumption.snapshotOrdinals).toEqual([10, 20]);
    expect(consumption.checkpointsByOrdinal.get(10)?.length).toBe(1);
    expect(consumption.checkpointsByRefEnd.get("Genesis/6/8")?.[0]?.kind).toBe("PARASHA_END");
    expect(consumption.parashaById.get("bereshit")?.parasha_name_en).toBe("Bereshit");

    const aliyahCheckpoint = consumption.checkpointsByOrdinal.get(10)?.[0];
    const parashaCheckpoint = consumption.checkpointsByOrdinal.get(20)?.[0];
    if (!aliyahCheckpoint || !parashaCheckpoint) {
      throw new Error("missing checkpoint in schedule");
    }

    expect(metadataCheckpointFolderSegments(aliyahCheckpoint)).toEqual([
      "parashot",
      "bereshit",
      "aliyot",
      "1"
    ]);
    expect(metadataCheckpointFolderSegments(parashaCheckpoint)).toEqual(["parashot", "bereshit"]);
  });

  it("supports metadata mode off and disabled metadata document helpers", () => {
    expect(isMetadataDisabledArg("off")).toBe(true);
    expect(isMetadataDisabledArg("OFF")).toBe(true);
    expect(isMetadataDisabledArg("path/to/MetadataPlan.json")).toBe(false);

    const disabled = createDisabledMetadataPlan();
    expect(disabled).toEqual({
      version: 1,
      notes: "metadata disabled via --metadata off",
      options: { metadata_mode: "off" },
      checkpoints: []
    });
    expect(formatDisabledMetadataPlanJson()).toContain('"metadata_mode": "off"');

    const offConsumption = buildWrapperMetadataConsumption({
      mode: "off",
      plan: makePlan()
    });
    expect(offConsumption.snapshotOrdinals).toEqual([]);
    expect(offConsumption.checkpointsByOrdinal.size).toBe(0);
    expect(offConsumption.parashaById.size).toBe(0);
  });

  it("fails fast when metadata checkpoints are not stable-sorted", () => {
    const plan = makePlan();
    plan.checkpoints = [plan.checkpoints[1]!, plan.checkpoints[0]!];
    expect(() =>
      buildWrapperMetadataConsumption({
        mode: "on",
        plan
      })
    ).toThrow(/stable-sorted by ordinal/);
  });
});
