import fs from "node:fs";
import path from "node:path";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { CantillationIRRecord } from "./cantillation_ir";
import type { LayoutIRRecord } from "./layout_ir";
import type { LettersIRRecord } from "./letters_ir";
import type { MetadataPlan } from "./metadata_plan";
import type { NiqqudIRRow } from "./niqqud_ir";
import type { ProgramIRRecord } from "./program_ir";
import type { SpineRecord } from "./spine";

type JsonSchema = Record<string, unknown>;

export type IRSchemaName =
  | "spine"
  | "letters_ir"
  | "niqqud_ir"
  | "cantillation_ir"
  | "layout_ir"
  | "metadata_plan"
  | "program_ir";

export type IRJsonlSchemaName = Exclude<IRSchemaName, "metadata_plan">;

type IRRecordBySchema = {
  spine: SpineRecord;
  letters_ir: LettersIRRecord;
  niqqud_ir: NiqqudIRRow;
  cantillation_ir: CantillationIRRecord;
  layout_ir: LayoutIRRecord;
  metadata_plan: MetadataPlan;
  program_ir: ProgramIRRecord;
};

const SCHEMA_DIR = path.resolve(process.cwd(), "src", "ir", "schemas");

const SCHEMA_FILE_BY_NAME: Readonly<Record<IRSchemaName, string>> = {
  spine: "spine.schema.json",
  letters_ir: "letters_ir.schema.json",
  niqqud_ir: "niqqud_ir.schema.json",
  cantillation_ir: "cantillation_ir.schema.json",
  layout_ir: "layout_ir.schema.json",
  metadata_plan: "metadata_plan.schema.json",
  program_ir: "program_ir.schema.json"
};

const SCHEMA_NAMES: readonly IRSchemaName[] = [
  "spine",
  "letters_ir",
  "niqqud_ir",
  "cantillation_ir",
  "layout_ir",
  "metadata_plan",
  "program_ir"
];

const ajv = new Ajv({ allErrors: true, strict: false });

function loadSchema(name: IRSchemaName): JsonSchema {
  const filePath = path.join(SCHEMA_DIR, SCHEMA_FILE_BY_NAME[name]);
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text) as JsonSchema;
}

function compileValidators(): { [K in IRSchemaName]: ValidateFunction<IRRecordBySchema[K]> } {
  const out = {} as { [K in IRSchemaName]: ValidateFunction<IRRecordBySchema[K]> };
  for (const schemaName of SCHEMA_NAMES) {
    const schema = loadSchema(schemaName);
    out[schemaName] = ajv.compile(schema) as ValidateFunction<IRRecordBySchema[typeof schemaName]>;
  }
  return out;
}

const validators = compileValidators();

export function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((entry) => {
      const pathValue =
        (entry as { instancePath?: string; dataPath?: string }).instancePath ??
        (entry as { instancePath?: string; dataPath?: string }).dataPath ??
        "/";
      const message = entry.message ?? "validation error";
      return `${pathValue || "/"} ${message}`;
    })
    .join("\n");
}

export function isValidIRRecord<K extends IRSchemaName>(
  schemaName: K,
  value: unknown
): value is IRRecordBySchema[K] {
  const validate = validators[schemaName];
  return Boolean(validate(value));
}

export function assertValidIRRecord<K extends IRSchemaName>(
  schemaName: K,
  value: unknown,
  label = "$"
): asserts value is IRRecordBySchema[K] {
  const validate = validators[schemaName];
  if (!validate(value)) {
    const detail = formatValidationErrors(validate.errors);
    throw new Error(`IR schema validation failed (${schemaName}) at ${label}: ${detail}`);
  }
}

export function parseJsonl(text: string): unknown[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid JSONL: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: unknown[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSONL line ${String(i + 1)}: ${message}`);
    }
    out.push(parsed);
  }
  return out;
}

export function validateJsonlRecords<K extends IRJsonlSchemaName>(
  schemaName: K,
  text: string
): IRRecordBySchema[K][] {
  const rows = parseJsonl(text);
  const out: IRRecordBySchema[K][] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    assertValidIRRecord(schemaName, row, `$[${String(i)}]`);
    out.push(row);
  }
  return out;
}

export function validateJsonDocument<K extends IRSchemaName>(
  schemaName: K,
  text: string
): IRRecordBySchema[K] {
  if (typeof text !== "string") {
    throw new Error(`Invalid JSON: expected string, got ${typeof text}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON document: ${message}`);
  }
  assertValidIRRecord(schemaName, parsed);
  return parsed;
}
