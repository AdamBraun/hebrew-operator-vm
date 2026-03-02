import { compareRefKeysCanonical, formatRefKey, parseRefKey, type RefKey } from "../../ir/refkey";
import {
  type PlanAliyah,
  type PlanParasha,
  type PlanRange,
  type Torah1YPlanDataset,
  validatePlanDataset
} from "./validatePlanDataset";

type UnknownRecord = Record<string, unknown>;

const OWN = Object.prototype.hasOwnProperty;

function fail(path: string, message: string): never {
  throw new Error(`metadata plan dataset normalize error at ${path}: ${message}`);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function describe(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(path, `expected object, got ${describe(value)}`);
  }
}

function assertHas(record: UnknownRecord, key: string, path: string): unknown {
  if (!hasOwn(record, key)) {
    fail(`${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, `expected string, got ${describe(value)}`);
  }
  return value;
}

function assertNonEmptyString(value: unknown, path: string): string {
  const text = assertString(value, path);
  if (text.length === 0) {
    fail(path, "expected non-empty string");
  }
  return text;
}

function assertInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(path, `expected integer, got ${describe(value)}`);
  }
  return value;
}

function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, `expected array, got ${describe(value)}`);
  }
  return value;
}

function canonicalizeSlug(value: unknown, path: string): string {
  const text = assertNonEmptyString(value, path);
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (normalized.length === 0) {
    fail(path, `slug canonicalized to empty value from ${JSON.stringify(text)}`);
  }
  return normalized;
}

function canonicalizeRefKey(value: unknown, path: string): RefKey {
  const text = assertNonEmptyString(value, path);
  try {
    return formatRefKey(parseRefKey(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(path, message);
  }
}

function normalizeRange(value: unknown, path: string): PlanRange {
  assertRecord(value, path);
  const start = canonicalizeRefKey(assertHas(value, "start", path), `${path}.start`);
  const end = canonicalizeRefKey(assertHas(value, "end", path), `${path}.end`);
  return { start, end };
}

function normalizeAliyah(value: unknown, path: string): PlanAliyah {
  assertRecord(value, path);
  const aliyah_index = assertInteger(
    assertHas(value, "aliyah_index", path),
    `${path}.aliyah_index`
  );
  const range = normalizeRange(assertHas(value, "range", path), `${path}.range`);
  return { aliyah_index, range };
}

function compareAliyah(left: PlanAliyah, right: PlanAliyah): number {
  return left.aliyah_index - right.aliyah_index;
}

function normalizeParasha(value: unknown, path: string): PlanParasha {
  assertRecord(value, path);

  const parasha_id = canonicalizeSlug(assertHas(value, "parasha_id", path), `${path}.parasha_id`);
  const parasha_name_he = assertNonEmptyString(
    assertHas(value, "parasha_name_he", path),
    `${path}.parasha_name_he`
  );
  const parasha_name_en = assertNonEmptyString(
    assertHas(value, "parasha_name_en", path),
    `${path}.parasha_name_en`
  );
  const range = normalizeRange(assertHas(value, "range", path), `${path}.range`);

  const aliyotRaw = assertArray(assertHas(value, "aliyot", path), `${path}.aliyot`);
  const aliyot = aliyotRaw.map((entry, index) =>
    normalizeAliyah(entry, `${path}.aliyot[${String(index)}]`)
  );
  aliyot.sort(compareAliyah);

  return {
    parasha_id,
    parasha_name_he,
    parasha_name_en,
    range,
    aliyot
  };
}

function compareParasha(left: PlanParasha, right: PlanParasha): number {
  const startCmp = compareRefKeysCanonical(left.range.start, right.range.start);
  if (startCmp !== 0) {
    return startCmp;
  }
  const endCmp = compareRefKeysCanonical(left.range.end, right.range.end);
  if (endCmp !== 0) {
    return endCmp;
  }
  return compareText(left.parasha_id, right.parasha_id);
}

export function normalizePlanDataset(value: unknown): Torah1YPlanDataset {
  const path = "$";
  assertRecord(value, path);

  const dataset_id = assertNonEmptyString(
    assertHas(value, "dataset_id", path),
    `${path}.dataset_id`
  ).trim();
  const scope = assertNonEmptyString(assertHas(value, "scope", path), `${path}.scope`).trim();
  const cycle = assertNonEmptyString(assertHas(value, "cycle", path), `${path}.cycle`).trim();

  let notes: string | undefined;
  if (hasOwn(value, "notes")) {
    const rawNotes = value.notes;
    if (rawNotes !== undefined) {
      notes = assertString(rawNotes, `${path}.notes`);
    }
  }

  const parashotRaw = assertArray(assertHas(value, "parashot", path), `${path}.parashot`);
  const parashot = parashotRaw.map((entry, index) =>
    normalizeParasha(entry, `${path}.parashot[${String(index)}]`)
  );
  parashot.sort(compareParasha);

  const normalized: Torah1YPlanDataset = {
    dataset_id,
    scope,
    cycle,
    ...(notes === undefined ? {} : { notes }),
    parashot
  };

  return validatePlanDataset(normalized);
}
