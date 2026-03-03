import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { formatMetadataCheckpointId } from "../../src/ir/metadata_ir";

const SCHEMA_PATH = path.resolve(process.cwd(), "src", "ir", "schema", "metadata_plan.schema.json");

function loadSchema(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
}

function makeValidPlan(): Record<string, unknown> {
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
        ordinal: 0
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
        ordinal: 1
      }
    ],
    ranges: [
      {
        segment_id: "ALIYAH:bereshit:1",
        kind: "ALIYAH",
        parasha_id: "bereshit",
        aliyah_index: 1,
        start: "Genesis/1/1",
        end: "Genesis/2/3",
        ordinal_start: 0,
        ordinal_end: 0
      },
      {
        segment_id: "PARASHA:bereshit",
        kind: "PARASHA",
        parasha_id: "bereshit",
        aliyah_index: null,
        start: "Genesis/1/1",
        end: "Genesis/6/8",
        ordinal_start: 0,
        ordinal_end: 1
      }
    ],
    ref_to_segment_index: {
      "Genesis/2/3": 0,
      "Genesis/6/8": 1
    },
    ref_to_parasha: {
      "Genesis/2/3": "bereshit",
      "Genesis/6/8": "bereshit"
    },
    ref_to_aliyah: {
      "Genesis/2/3": 1,
      "Genesis/6/8": 7
    }
  };
}

describe("metadata plan IR schema", () => {
  it("accepts a valid metadata plan IR document", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(loadSchema());
    expect(validate(makeValidPlan())).toBe(true);
  });

  it("rejects checkpoint variants that do not match kind-specific rules", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(loadSchema());

    const invalidAliyahCheckpoint = makeValidPlan();
    (invalidAliyahCheckpoint.checkpoints as Array<Record<string, unknown>>)[0]!.aliyah_index = null;
    expect(validate(invalidAliyahCheckpoint)).toBe(false);

    const invalidParashaCheckpointId = makeValidPlan();
    (invalidParashaCheckpointId.checkpoints as Array<Record<string, unknown>>)[1]!.checkpoint_id =
      "PARASHA_END:bereshit:1:Genesis/6/8";
    expect(validate(invalidParashaCheckpointId)).toBe(false);
  });

  it("rejects invalid ref keys in lookup helpers", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(loadSchema());

    const invalid = makeValidPlan();
    (invalid.ref_to_segment_index as Record<string, number>)["Genesis/01/1"] = 2;
    expect(validate(invalid)).toBe(false);

    const invalidParashaLookup = makeValidPlan();
    (invalidParashaLookup.ref_to_parasha as Record<string, string>)["Joshua/1/1"] = "x";
    expect(validate(invalidParashaLookup)).toBe(false);
  });

  it("formats deterministic checkpoint ids per contract", () => {
    expect(
      formatMetadataCheckpointId({
        kind: "ALIYAH_END",
        parasha_id: "bereshit",
        aliyah_index: 4,
        ref_key_end: "Genesis/4/18"
      })
    ).toBe("ALIYAH_END:bereshit:4:Genesis/4/18");

    expect(
      formatMetadataCheckpointId({
        kind: "PARASHA_END",
        parasha_id: "bereshit",
        aliyah_index: null,
        ref_key_end: "Genesis/6/8"
      })
    ).toBe("PARASHA_END:bereshit:0:Genesis/6/8");
  });
});
