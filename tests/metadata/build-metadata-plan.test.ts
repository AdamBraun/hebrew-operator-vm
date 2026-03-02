import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { buildMetadataPlan } from "../../src/layers/metadata/buildMetadataPlan";
import { extractRefOrder } from "../../src/layers/metadata/extractRefOrder";
import { type RefKey } from "../../src/ir/refkey";

const FIXED_GENERATED_AT = "2026-03-02T00:00:00.000Z";
const METADATA_PLAN_IR_SCHEMA_PATH = path.resolve(
  process.cwd(),
  "src",
  "ir",
  "schema",
  "metadata_plan.schema.json"
);

function buildRefIndex(refOrder: readonly RefKey[]): Map<RefKey, number> {
  const out = new Map<RefKey, number>();
  for (let i = 0; i < refOrder.length; i += 1) {
    out.set(refOrder[i]!, i);
  }
  return out;
}

describe("metadata buildMetadataPlan", () => {
  it("builds deterministic metadata plan IR with stable checkpoint ordering", async () => {
    const refOrder = await extractRefOrder();
    const refIndex = buildRefIndex(refOrder);

    const planA = await buildMetadataPlan({
      refOrder,
      generatedAt: FIXED_GENERATED_AT
    });
    const planB = await buildMetadataPlan({
      refOrder,
      generatedAt: FIXED_GENERATED_AT
    });

    expect(JSON.stringify(planA)).toBe(JSON.stringify(planB));
    expect(planA.ir_version).toBe("metadata_plan_ir.v1");
    expect(planA.scope).toBe("torah");
    expect(planA.cycle).toBe("one_year");
    expect(planA.ref_order_source).toBe("corpus_index");
    expect(planA.generated_at).toBe(FIXED_GENERATED_AT);
    expect(planA.plan_digest).toMatch(/^[a-f0-9]{64}$/);

    expect(planA.checkpoints.length).toBe(54 * 8);

    for (const checkpoint of planA.checkpoints) {
      expect(refIndex.has(checkpoint.ref_key_end)).toBe(true);
      expect(checkpoint.ordinal).toBe(refIndex.get(checkpoint.ref_key_end));
    }

    for (let i = 1; i < planA.checkpoints.length; i += 1) {
      const prev = planA.checkpoints[i - 1]!;
      const curr = planA.checkpoints[i]!;

      expect(curr.ordinal).toBeGreaterThanOrEqual(prev.ordinal);
      if (curr.ordinal === prev.ordinal) {
        expect(prev.kind).toBe("ALIYAH_END");
        expect(prev.aliyah_index).toBe(7);
        expect(curr.kind).toBe("PARASHA_END");
        expect(curr.aliyah_index).toBeNull();
        expect(curr.parasha_id).toBe(prev.parasha_id);
        expect(curr.ref_key_end).toBe(prev.ref_key_end);
      }
    }

    expect(planA.checkpoints.at(-1)?.kind).toBe("PARASHA_END");
    expect(planA.checkpoints.at(-1)?.ref_key_end).toBe("Deuteronomy/34/12");
    expect(planA.checkpoints.at(-1)?.ordinal).toBe(refOrder.length - 1);
  });

  it("emits JSON that validates against Metadata Plan IR schema", async () => {
    const plan = await buildMetadataPlan({
      generatedAt: FIXED_GENERATED_AT
    });

    const schema = JSON.parse(fs.readFileSync(METADATA_PLAN_IR_SCHEMA_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    expect(validate(plan)).toBe(true);
  });

  it("fails when a checkpoint end ref is absent from corpus ref order", async () => {
    const refOrder = await extractRefOrder();
    const pruned = refOrder.filter((ref) => ref !== "Genesis/2/3");

    await expect(
      buildMetadataPlan({
        refOrder: pruned,
        generatedAt: FIXED_GENERATED_AT
      })
    ).rejects.toThrow(/not found in corpus ref order/);
  });

  it("fails when corpus ref order contains verses not covered by parashot", async () => {
    const refOrder = await extractRefOrder();
    const extended = [...refOrder, "Deuteronomy/34/13" as RefKey];

    await expect(
      buildMetadataPlan({
        refOrder: extended,
        generatedAt: FIXED_GENERATED_AT
      })
    ).rejects.toThrow(/do not cover full corpus ref order/);
  });
});
