import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertValidIRRecord,
  validateJsonDocument,
  validateJsonlRecords
} from "../../src/ir/validate";

const TINY_FIXTURE_DIR = path.resolve(process.cwd(), "tests", "fixtures", "stitcher", "tiny");

function readFixture(fileName: string): string {
  return fs.readFileSync(path.join(TINY_FIXTURE_DIR, fileName), "utf8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("ir schema validator", () => {
  it("accepts valid tiny fixture artifacts for each schema", () => {
    expect(validateJsonlRecords("spine", readFixture("Spine.jsonl"))).toHaveLength(5);
    expect(validateJsonlRecords("letters_ir", readFixture("LettersIR.jsonl"))).toHaveLength(2);
    expect(validateJsonlRecords("niqqud_ir", readFixture("NiqqudIR.jsonl"))).toHaveLength(2);
    expect(
      validateJsonlRecords("cantillation_ir", readFixture("CantillationIR.jsonl"))
    ).toHaveLength(2);
    expect(validateJsonlRecords("layout_ir", readFixture("LayoutIR.jsonl"))).toHaveLength(2);
    expect(
      validateJsonlRecords("program_ir", readFixture("ProgramIR.expected.jsonl"))
    ).toHaveLength(5);
    const metadataPlan = validateJsonDocument("metadata_plan", readFixture("MetadataPlan.json"));
    expect(metadataPlan.version).toBe(1);
  });

  it("rejects malformed anchor ids and required fields", () => {
    const validLetter = validateJsonlRecords("letters_ir", readFixture("LettersIR.jsonl"))[0];
    const malformedLetter = {
      ...clone(validLetter),
      gid: "Genesis/1/1#bad:0"
    };
    expect(() => assertValidIRRecord("letters_ir", malformedLetter)).toThrow(/letters_ir/);

    const validLayout = validateJsonlRecords("layout_ir", readFixture("LayoutIR.jsonl"))[0];
    const malformedLayout = {
      ...clone(validLayout),
      gapid: "Genesis/1/1#bad:1"
    };
    expect(() => assertValidIRRecord("layout_ir", malformedLayout)).toThrow(/layout_ir/);

    const missingRequired = {
      kind: "op",
      ref_key: "Genesis/1/1"
    };
    expect(() => assertValidIRRecord("program_ir", missingRequired)).toThrow(/program_ir/);
  });

  it("rejects invalid cantillation anchor unions and metadata plans", () => {
    const validCantillation = validateJsonlRecords(
      "cantillation_ir",
      readFixture("CantillationIR.jsonl")
    )[0];
    const malformedCantillation = {
      ...clone(validCantillation),
      anchor: {
        kind: "gap",
        id: "Genesis/1/1#g:0"
      }
    };
    expect(() => assertValidIRRecord("cantillation_ir", malformedCantillation)).toThrow(
      /cantillation_ir/
    );

    const invalidMetadata = {
      notes: "missing required version"
    };
    expect(() => assertValidIRRecord("metadata_plan", invalidMetadata)).toThrow(/metadata_plan/);

    const invalidMetadataBoundary = {
      version: 1,
      checkpoints: [
        {
          ref_end: "Genesis/1/1#g:0"
        }
      ]
    };
    expect(() => assertValidIRRecord("metadata_plan", invalidMetadataBoundary)).toThrow(
      /metadata_plan/
    );
  });
});
