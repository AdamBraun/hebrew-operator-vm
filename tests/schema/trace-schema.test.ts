import fs from "node:fs";
import path from "node:path";
import Ajv, { type ErrorObject } from "ajv";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = path.resolve(process.cwd(), "spec", "70-TRACE-FORMAT.schema.json");
const FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "trace-schema");

function loadJson(fileName: string): unknown {
  const full = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((entry) => `${entry.instancePath || "/"} ${entry.message ?? "validation error"}`)
    .join("\n");
}

describe("trace schema", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it("validates canonical sample fixtures", () => {
    const samples = [loadJson("valid.word-trace.json"), loadJson("valid.verse-trace.json")];

    for (const sample of samples) {
      const ok = validate(sample);
      expect(ok, formatErrors(validate.errors)).toBe(true);
    }
  });

  it("rejects invalid fixtures with meaningful errors", () => {
    const invalidCases = [
      {
        file: "invalid.missing-trace-version.json",
        expected: "required property 'trace_version'"
      },
      {
        file: "invalid.alias-missing-right.json",
        expected: "required property 'right'"
      },
      {
        file: "invalid.trace-major.json",
        expected: 'match pattern "^1\\.[0-9]+\\.[0-9]+$"'
      }
    ] as const;

    for (const testCase of invalidCases) {
      const payload = loadJson(testCase.file);
      const ok = validate(payload);
      expect(ok).toBe(false);
      const rendered = formatErrors(validate.errors);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).toContain(testCase.expected);
    }
  });
});
