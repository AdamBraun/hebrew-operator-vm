export type LayoutEventType = "SETUMA" | "PETUCHA" | "BOOK_BREAK";

export type LayoutAnchor = {
  kind: "gap";
  gap_index: number;
};

export type LayoutDatasetEvent = {
  ref_key: string;
  anchor: LayoutAnchor;
  type: LayoutEventType;
  note?: string;
};

export type LayoutDataset = {
  dataset_id: string;
  source: string;
  version: string;
  hash_algo: "sha256";
  events: LayoutDatasetEvent[];
};

type UnknownRecord = Record<string, unknown>;

const OWN = Object.prototype.hasOwnProperty;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isLayoutEventType(value: unknown): value is LayoutEventType {
  return value === "SETUMA" || value === "PETUCHA" || value === "BOOK_BREAK";
}

export function isLayoutDatasetEvent(value: unknown): value is LayoutDatasetEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isLayoutEventType(value.type)) {
    return false;
  }
  if (value.note !== undefined && typeof value.note !== "string") {
    return false;
  }
  if (!isRecord(value.anchor)) {
    return false;
  }
  if (value.anchor.kind !== "gap") {
    return false;
  }
  return isNonNegativeInteger(value.anchor.gap_index);
}

export function isLayoutDataset(value: unknown): value is LayoutDataset {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.dataset_id)) {
    return false;
  }
  if (!isNonEmptyString(value.source)) {
    return false;
  }
  if (!isNonEmptyString(value.version) || !SEMVER.test(value.version)) {
    return false;
  }
  if (value.hash_algo !== "sha256") {
    return false;
  }
  if (!Array.isArray(value.events)) {
    return false;
  }
  return value.events.every((event) => isLayoutDatasetEvent(event));
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid LayoutDataset at ${path}: ${message}`);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(path, `expected object, got ${describe(value)}`);
  }
}

function assertNoUnknownKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(path, `unknown field '${key}'`);
    }
  }
}

function assertHas(record: UnknownRecord, key: string, path: string): unknown {
  if (!hasOwn(record, key)) {
    fail(`${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    fail(path, `expected string, got ${describe(value)}`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  if (value.length === 0) {
    fail(path, "expected non-empty string");
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    fail(path, `expected non-negative integer, got ${describe(value)}`);
  }
}

function assertLayoutEventType(value: unknown, path: string): asserts value is LayoutEventType {
  if (!isLayoutEventType(value)) {
    fail(path, `expected SETUMA|PETUCHA|BOOK_BREAK, got ${describe(value)}`);
  }
}

function assertLayoutAnchor(value: unknown, path: string): asserts value is LayoutAnchor {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["kind", "gap_index"], path);
  const kind = assertHas(value, "kind", path);
  if (kind !== "gap") {
    fail(`${path}.kind`, `expected 'gap', got ${describe(kind)}`);
  }
  assertNonNegativeInteger(assertHas(value, "gap_index", path), `${path}.gap_index`);
}

function assertLayoutDatasetEvent(
  value: unknown,
  path: string
): asserts value is LayoutDatasetEvent {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["ref_key", "anchor", "type", "note"], path);

  assertNonEmptyString(assertHas(value, "ref_key", path), `${path}.ref_key`);
  assertLayoutAnchor(assertHas(value, "anchor", path), `${path}.anchor`);
  assertLayoutEventType(assertHas(value, "type", path), `${path}.type`);

  if (hasOwn(value, "note") && value.note !== undefined) {
    assertString(value.note, `${path}.note`);
  }
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

export function assertLayoutDataset(value: unknown, path = "$"): asserts value is LayoutDataset {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["dataset_id", "source", "version", "hash_algo", "events"], path);

  assertNonEmptyString(assertHas(value, "dataset_id", path), `${path}.dataset_id`);
  assertNonEmptyString(assertHas(value, "source", path), `${path}.source`);

  const version = assertHas(value, "version", path);
  assertNonEmptyString(version, `${path}.version`);
  if (!SEMVER.test(version)) {
    fail(`${path}.version`, `expected semantic version, got ${describe(version)}`);
  }

  const hashAlgo = assertHas(value, "hash_algo", path);
  if (hashAlgo !== "sha256") {
    fail(`${path}.hash_algo`, `expected 'sha256', got ${describe(hashAlgo)}`);
  }

  const events = assertHas(value, "events", path);
  if (!Array.isArray(events)) {
    fail(`${path}.events`, `expected array, got ${describe(events)}`);
  }
  for (let i = 0; i < events.length; i += 1) {
    assertLayoutDatasetEvent(events[i], `${path}.events[${i}]`);
  }
}
