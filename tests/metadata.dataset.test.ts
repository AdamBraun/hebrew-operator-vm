import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";

const DATASET_PATH = path.resolve(
  process.cwd(),
  "src",
  "layers",
  "metadata",
  "datasets",
  "torah_1y_plan.v1.json"
);
const SCHEMA_PATH = path.resolve(
  process.cwd(),
  "src",
  "layers",
  "metadata",
  "schema",
  "torah_1y_plan.schema.json"
);

type AnyDataset = Record<string, unknown> & {
  parashot?: Array<Record<string, unknown>>;
};

function loadDataset(): AnyDataset {
  return JSON.parse(fs.readFileSync(DATASET_PATH, "utf8")) as AnyDataset;
}

function loadSchema(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("metadata dataset schema validation", () => {
  it("rejects parasha entries missing the required 1..7 aliyah set", () => {
    const schema = loadSchema();
    const dataset = clone(loadDataset());
    const firstParasha = dataset.parashot?.[0];
    if (!firstParasha || !Array.isArray(firstParasha.aliyot)) {
      throw new Error("test fixture dataset missing parashot[0].aliyot");
    }

    firstParasha.aliyot = firstParasha.aliyot.filter(
      (entry) => (entry as { aliyah_index?: number }).aliyah_index !== 1
    );

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    expect(validate(dataset)).toBe(false);
  });

  it("rejects out-of-range RefKey values outside Torah books", () => {
    const schema = loadSchema();
    const dataset = clone(loadDataset());
    const firstParasha = dataset.parashot?.[0];
    if (!firstParasha || !firstParasha.range || typeof firstParasha.range !== "object") {
      throw new Error("test fixture dataset missing parashot[0].range");
    }

    (firstParasha.range as { start?: string }).start = "Joshua/1/1";

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    expect(validate(dataset)).toBe(false);
  });
});
