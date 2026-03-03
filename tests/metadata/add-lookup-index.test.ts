import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildMetadataPlan } from "../../src/layers/metadata/buildMetadataPlan";
import { addLookupIndex } from "../../src/layers/metadata/addLookupIndex";
import { buildWrapperMetadataConsumption } from "../../src/wrapper/checkpoints/metadata";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "metadata");
const FIXTURE_GENERATED_AT = "2026-03-03T00:00:00.000Z";

function readFixtureJson(fileName: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")) as unknown;
}

describe("metadata addLookupIndex", () => {
  it("derives stable ref_to_parasha and ref_to_aliyah from plan + refOrder only", async () => {
    const dataset = readFixtureJson("torah_1y_plan.fixture_genesis1.v1.json");
    const refOrder = readFixtureJson("ref_order.fixture_genesis1.json") as string[];

    const plan = await buildMetadataPlan({
      dataset,
      refOrder,
      generatedAt: FIXTURE_GENERATED_AT,
      includeParashot: true
    });

    const indexedA = addLookupIndex({ plan, refOrder });
    const indexedB = addLookupIndex({ plan, refOrder });

    expect(JSON.stringify(indexedA)).toBe(JSON.stringify(indexedB));
    expect(Object.keys(indexedA.ref_to_parasha ?? {})).toHaveLength(refOrder.length);
    expect(Object.keys(indexedA.ref_to_aliyah ?? {})).toHaveLength(refOrder.length);
    expect(indexedA.ref_to_parasha?.["Genesis/1/1"]).toBe("bereshit_fixture_genesis1");
    expect(indexedA.ref_to_aliyah?.["Genesis/1/1"]).toBe(1);
    expect(indexedA.ref_to_aliyah?.["Genesis/1/31"]).toBe(7);
  });

  it("keeps wrapper consumption valid without lookup index (fallback path)", async () => {
    const dataset = readFixtureJson("torah_1y_plan.fixture_genesis1.v1.json");
    const refOrder = readFixtureJson("ref_order.fixture_genesis1.json") as string[];

    const plan = await buildMetadataPlan({
      dataset,
      refOrder,
      generatedAt: FIXTURE_GENERATED_AT,
      includeParashot: true
    });
    const indexedPlan = addLookupIndex({ plan, refOrder });

    const noIndexConsumption = buildWrapperMetadataConsumption({ mode: "on", plan });
    const withIndexConsumption = buildWrapperMetadataConsumption({ mode: "on", plan: indexedPlan });

    expect(noIndexConsumption.snapshotOrdinals).toEqual(withIndexConsumption.snapshotOrdinals);
    expect(noIndexConsumption.checkpointsByRefEnd.size).toBe(
      withIndexConsumption.checkpointsByRefEnd.size
    );
    expect(noIndexConsumption.parashaById.size).toBe(withIndexConsumption.parashaById.size);
  });
});
