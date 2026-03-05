import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildMetadataPlan,
  DEFAULT_METADATA_DATASET_PATH
} from "../src/layers/metadata/buildMetadataPlan";
import { extractRefOrder } from "../src/layers/metadata/extractRefOrder";
import { formatMetadataCheckpointId, type MetadataPlanCheckpoint } from "../src/ir/metadata_ir";

function loadDataset(): unknown {
  return JSON.parse(fs.readFileSync(DEFAULT_METADATA_DATASET_PATH, "utf8")) as unknown;
}

function checkpointIndexById(checkpoints: readonly MetadataPlanCheckpoint[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < checkpoints.length; i += 1) {
    out.set(checkpoints[i]!.checkpoint_id, i);
  }
  return out;
}

describe("metadata plan builder", () => {
  it("assigns correct ordinals for known checkpoint refs", async () => {
    const refOrder = await extractRefOrder();
    const refIndex = new Map<string, number>(refOrder.map((ref, index) => [ref, index]));
    const plan = await buildMetadataPlan({
      dataset: loadDataset(),
      refOrder,
      generatedAt: "2026-03-03T00:00:00.000Z"
    });

    const bereshitAliyah1Id = formatMetadataCheckpointId({
      kind: "ALIYAH_END",
      parasha_id: "bereshit",
      aliyah_index: 1,
      ref_key_end: "Genesis/2/3"
    });
    const bereshitAliyah1 = plan.checkpoints.find(
      (checkpoint) => checkpoint.checkpoint_id === bereshitAliyah1Id
    );
    expect(bereshitAliyah1?.ordinal).toBe(refIndex.get("Genesis/2/3"));

    const finalParashaId = formatMetadataCheckpointId({
      kind: "PARASHA_END",
      parasha_id: "vzot_haberachah",
      aliyah_index: null,
      ref_key_end: "Deuteronomy/34/12"
    });
    const finalParashaEnd = plan.checkpoints.find(
      (checkpoint) => checkpoint.checkpoint_id === finalParashaId
    );
    expect(finalParashaEnd?.ordinal).toBe(refIndex.get("Deuteronomy/34/12"));
  });

  it("keeps stable tie ordering when parasha_end equals aliyah_end(7)", async () => {
    const plan = await buildMetadataPlan({
      dataset: loadDataset(),
      refOrder: await extractRefOrder(),
      generatedAt: "2026-03-03T00:00:00.000Z"
    });
    const checkpointPositions = checkpointIndexById(plan.checkpoints);

    for (const parasha of plan.parashot ?? []) {
      const aliyah7 = (parasha.aliyot ?? []).find((aliyah) => aliyah.aliyah_index === 7);
      if (!aliyah7) {
        throw new Error(`missing aliyah 7 for parasha '${parasha.parasha_id}'`);
      }

      const aliyah7Id = formatMetadataCheckpointId({
        kind: "ALIYAH_END",
        parasha_id: parasha.parasha_id,
        aliyah_index: 7,
        ref_key_end: aliyah7.range.end
      });
      const parashaEndId = formatMetadataCheckpointId({
        kind: "PARASHA_END",
        parasha_id: parasha.parasha_id,
        aliyah_index: null,
        ref_key_end: parasha.range.end
      });

      const aliyah7Checkpoint = plan.checkpoints.find(
        (checkpoint) => checkpoint.checkpoint_id === aliyah7Id
      );
      const parashaCheckpoint = plan.checkpoints.find(
        (checkpoint) => checkpoint.checkpoint_id === parashaEndId
      );

      expect(aliyah7Checkpoint?.ordinal).toBe(parashaCheckpoint?.ordinal);
      expect(aliyah7Checkpoint?.kind).toBe("ALIYAH_END");
      expect(parashaCheckpoint?.kind).toBe("PARASHA_END");

      const aliyah7Position = checkpointPositions.get(aliyah7Id);
      const parashaPosition = checkpointPositions.get(parashaEndId);
      expect(aliyah7Position).not.toBeUndefined();
      expect(parashaPosition).not.toBeUndefined();
      expect(parashaPosition).toBe((aliyah7Position ?? -1) + 1);
    }
  });
});
