import fs from "node:fs/promises";

export type LayoutEventType = "SPACE" | "SETUMA" | "PETUCHA" | "BOOK_BREAK";

export type LayoutDatasetEventType = Exclude<LayoutEventType, "SPACE">;

export type LayoutStrength = "weak" | "mid" | "strong" | "max";

export type LayoutEventSource = "spine_whitespace" | "dataset";

export type LayoutAnchor = {
  kind: "gap";
  gap_index: number;
};

export type LayoutDatasetEvent = {
  ref_key: string;
  anchor: LayoutAnchor;
  type: LayoutDatasetEventType;
  note?: string;
};

export type LayoutDataset = {
  dataset_id: string;
  source: string;
  version: string;
  hash_algo: "sha256";
  events: LayoutDatasetEvent[];
};

export type LayoutEvent = {
  type: LayoutEventType;
  strength: LayoutStrength;
  source: LayoutEventSource;
  meta?: Record<string, unknown>;
};

export type LayoutIRRecord = {
  gapid: string;
  ref_key: string;
  gap_index: number;
  layout_event: LayoutEvent;
};

type UnknownRecord = Record<string, unknown>;

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const OWN = Object.prototype.hasOwnProperty;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;

const LAYOUT_STRENGTH_BY_TYPE: Readonly<Record<LayoutEventType, LayoutStrength>> = {
  SPACE: "weak",
  SETUMA: "mid",
  PETUCHA: "strong",
  BOOK_BREAK: "max"
};

const LAYOUT_SOURCE_BY_TYPE: Readonly<Record<LayoutEventType, LayoutEventSource>> = {
  SPACE: "spine_whitespace",
  SETUMA: "dataset",
  PETUCHA: "dataset",
  BOOK_BREAK: "dataset"
};

const LAYOUT_TYPE_ORDER: Readonly<Record<LayoutEventType, number>> = {
  SPACE: 0,
  SETUMA: 1,
  PETUCHA: 2,
  BOOK_BREAK: 3
};

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
  return value === "SPACE" || value === "SETUMA" || value === "PETUCHA" || value === "BOOK_BREAK";
}

function isLayoutDatasetEventType(value: unknown): value is LayoutDatasetEventType {
  return value === "SETUMA" || value === "PETUCHA" || value === "BOOK_BREAK";
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function parseGapId(value: string): { ref_key: string; gap_index: number } | null {
  const match = value.match(GAPID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const parsed = Number(match[2]);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return { ref_key, gap_index: parsed };
}

function normalizeRefSegment(
  segment: string
): { kind: "int"; value: number } | { kind: "text"; value: string } {
  if (/^[0-9]+$/.test(segment)) {
    return { kind: "int", value: Number(segment) };
  }
  return { kind: "text", value: segment };
}

const TORAH_BOOK_ORDER: Readonly<Record<string, number>> = {
  Genesis: 0,
  Exodus: 1,
  Leviticus: 2,
  Numbers: 3,
  Deuteronomy: 4
};

function compareTorahBookSegment(left: string, right: string): number | null {
  const leftOrder = TORAH_BOOK_ORDER[left];
  const rightOrder = TORAH_BOOK_ORDER[right];
  if (leftOrder === undefined || rightOrder === undefined) {
    return null;
  }
  if (leftOrder === rightOrder) {
    return 0;
  }
  return leftOrder - rightOrder;
}

function toCanonicalJsonValue(value: unknown): CanonicalJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = toCanonicalJsonValue(entry);
      return normalized === undefined ? null : normalized;
    });
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(source).sort(compareText)) {
      const normalized = toCanonicalJsonValue(source[key]);
      if (normalized !== undefined) {
        out[key] = normalized;
      }
    }
    return out;
  }
  return undefined;
}

function canonicalStringify(value: unknown): string {
  const normalized = toCanonicalJsonValue(value);
  return JSON.stringify(normalized === undefined ? null : normalized);
}

export function expectedLayoutStrength(type: LayoutEventType): LayoutStrength {
  return LAYOUT_STRENGTH_BY_TYPE[type];
}

export function expectedLayoutSource(type: LayoutEventType): LayoutEventSource {
  return LAYOUT_SOURCE_BY_TYPE[type];
}

export function compareRefKeysStable(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftParts = left.split("/");
  const rightParts = right.split("/");
  const len = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < len; i += 1) {
    const l = leftParts[i];
    const r = rightParts[i];
    if (l === undefined) {
      return -1;
    }
    if (r === undefined) {
      return 1;
    }
    if (l === r) {
      continue;
    }

    if (i === 0) {
      const bookCmp = compareTorahBookSegment(l, r);
      if (bookCmp !== null) {
        if (bookCmp !== 0) {
          return bookCmp;
        }
        continue;
      }
    }

    const ln = normalizeRefSegment(l);
    const rn = normalizeRefSegment(r);

    if (ln.kind === "int" && rn.kind === "int") {
      if (ln.value !== rn.value) {
        return ln.value - rn.value;
      }
      continue;
    }

    if (ln.kind !== rn.kind) {
      return ln.kind === "text" ? -1 : 1;
    }

    return compareText(String(ln.value), String(rn.value));
  }

  return 0;
}

export function compareLayoutIRRecords(left: LayoutIRRecord, right: LayoutIRRecord): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.gap_index !== right.gap_index) {
    return left.gap_index - right.gap_index;
  }
  const leftRank = LAYOUT_TYPE_ORDER[left.layout_event.type];
  const rightRank = LAYOUT_TYPE_ORDER[right.layout_event.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return compareText(left.gapid, right.gapid);
}

export function isLayoutDatasetEvent(value: unknown): value is LayoutDatasetEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isLayoutDatasetEventType(value.type)) {
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

export function isLayoutEvent(value: unknown): value is LayoutEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (!isLayoutEventType(value.type)) {
    return false;
  }
  const expectedStrength = expectedLayoutStrength(value.type);
  const expectedSource = expectedLayoutSource(value.type);
  if (value.strength !== expectedStrength) {
    return false;
  }
  if (value.source !== expectedSource) {
    return false;
  }
  if (value.meta !== undefined && !isRecord(value.meta)) {
    return false;
  }
  return true;
}

export function isLayoutIRRecord(value: unknown): value is LayoutIRRecord {
  if (!isRecord(value)) {
    return false;
  }
  if (!isNonEmptyString(value.gapid) || !isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isNonNegativeInteger(value.gap_index)) {
    return false;
  }
  if (!isLayoutEvent(value.layout_event)) {
    return false;
  }
  const parsed = parseGapId(value.gapid);
  return (
    parsed !== null && parsed.ref_key === value.ref_key && parsed.gap_index === value.gap_index
  );
}

function fail(scope: string, path: string, message: string): never {
  throw new Error(`Invalid ${scope} at ${path}: ${message}`);
}

function assertRecord(value: unknown, path: string, scope: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(scope, path, `expected object, got ${describe(value)}`);
  }
}

function assertNoUnknownKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string,
  scope: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(scope, path, `unknown field '${key}'`);
    }
  }
}

function assertHas(record: UnknownRecord, key: string, path: string, scope: string): unknown {
  if (!hasOwn(record, key)) {
    fail(scope, `${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertString(value: unknown, path: string, scope: string): asserts value is string {
  if (typeof value !== "string") {
    fail(scope, path, `expected string, got ${describe(value)}`);
  }
}

function assertNonEmptyString(
  value: unknown,
  path: string,
  scope: string
): asserts value is string {
  assertString(value, path, scope);
  if (value.length === 0) {
    fail(scope, path, "expected non-empty string");
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string,
  scope: string
): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    fail(scope, path, `expected non-negative integer, got ${describe(value)}`);
  }
}

function assertLayoutDatasetEventType(
  value: unknown,
  path: string,
  scope: string
): asserts value is LayoutDatasetEventType {
  if (!isLayoutDatasetEventType(value)) {
    fail(scope, path, `expected SETUMA|PETUCHA|BOOK_BREAK, got ${describe(value)}`);
  }
}

function assertLayoutEventType(
  value: unknown,
  path: string,
  scope: string
): asserts value is LayoutEventType {
  if (!isLayoutEventType(value)) {
    fail(scope, path, `expected SPACE|SETUMA|PETUCHA|BOOK_BREAK, got ${describe(value)}`);
  }
}

function assertLayoutAnchor(
  value: unknown,
  path: string,
  scope: string
): asserts value is LayoutAnchor {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["kind", "gap_index"], path, scope);
  const kind = assertHas(value, "kind", path, scope);
  if (kind !== "gap") {
    fail(scope, `${path}.kind`, `expected 'gap', got ${describe(kind)}`);
  }
  assertNonNegativeInteger(assertHas(value, "gap_index", path, scope), `${path}.gap_index`, scope);
}

function assertLayoutDatasetEvent(
  value: unknown,
  path: string,
  scope: string
): asserts value is LayoutDatasetEvent {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["ref_key", "anchor", "type", "note"], path, scope);

  assertNonEmptyString(assertHas(value, "ref_key", path, scope), `${path}.ref_key`, scope);
  assertLayoutAnchor(assertHas(value, "anchor", path, scope), `${path}.anchor`, scope);
  assertLayoutDatasetEventType(assertHas(value, "type", path, scope), `${path}.type`, scope);

  if (hasOwn(value, "note") && value.note !== undefined) {
    assertString(value.note, `${path}.note`, scope);
  }
}

function assertLayoutEvent(
  value: unknown,
  path: string,
  scope: string
): asserts value is LayoutEvent {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["type", "strength", "source", "meta"], path, scope);

  const eventType = assertHas(value, "type", path, scope);
  assertLayoutEventType(eventType, `${path}.type`, scope);

  const strength = assertHas(value, "strength", path, scope);
  assertString(strength, `${path}.strength`, scope);
  const expectedStrength = expectedLayoutStrength(eventType);
  if (strength !== expectedStrength) {
    fail(scope, `${path}.strength`, `expected '${expectedStrength}' for type '${eventType}'`);
  }

  const source = assertHas(value, "source", path, scope);
  assertString(source, `${path}.source`, scope);
  const expectedSource = expectedLayoutSource(eventType);
  if (source !== expectedSource) {
    fail(scope, `${path}.source`, `expected '${expectedSource}' for type '${eventType}'`);
  }

  if (hasOwn(value, "meta") && value.meta !== undefined) {
    assertRecord(value.meta, `${path}.meta`, scope);
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

export function assertLayoutDataset(
  value: unknown,
  path = "$",
  scope = "LayoutDataset"
): asserts value is LayoutDataset {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(
    value,
    ["dataset_id", "source", "version", "hash_algo", "events"],
    path,
    scope
  );

  assertNonEmptyString(assertHas(value, "dataset_id", path, scope), `${path}.dataset_id`, scope);
  assertNonEmptyString(assertHas(value, "source", path, scope), `${path}.source`, scope);

  const version = assertHas(value, "version", path, scope);
  assertNonEmptyString(version, `${path}.version`, scope);
  if (!SEMVER.test(version)) {
    fail(scope, `${path}.version`, `expected semantic version, got ${describe(version)}`);
  }

  const hashAlgo = assertHas(value, "hash_algo", path, scope);
  if (hashAlgo !== "sha256") {
    fail(scope, `${path}.hash_algo`, `expected 'sha256', got ${describe(hashAlgo)}`);
  }

  const events = assertHas(value, "events", path, scope);
  if (!Array.isArray(events)) {
    fail(scope, `${path}.events`, `expected array, got ${describe(events)}`);
  }
  for (let i = 0; i < events.length; i += 1) {
    assertLayoutDatasetEvent(events[i], `${path}.events[${i}]`, scope);
  }
}

export function assertLayoutIRRecord(
  value: unknown,
  path = "$",
  scope = "LayoutIRRecord"
): asserts value is LayoutIRRecord {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["gapid", "ref_key", "gap_index", "layout_event"], path, scope);

  const gapid = assertHas(value, "gapid", path, scope);
  assertNonEmptyString(gapid, `${path}.gapid`, scope);

  const refKey = assertHas(value, "ref_key", path, scope);
  assertNonEmptyString(refKey, `${path}.ref_key`, scope);

  const gapIndex = assertHas(value, "gap_index", path, scope);
  assertNonNegativeInteger(gapIndex, `${path}.gap_index`, scope);

  const parsedGap = parseGapId(gapid);
  if (!parsedGap) {
    fail(scope, `${path}.gapid`, `expected '<ref_key>#gap:<gap_index>', got ${describe(gapid)}`);
  }
  if (parsedGap.ref_key !== refKey || parsedGap.gap_index !== gapIndex) {
    fail(
      scope,
      `${path}.gapid`,
      `gapid '${gapid}' must match ref_key='${refKey}' and gap_index=${String(gapIndex)}`
    );
  }

  assertLayoutEvent(assertHas(value, "layout_event", path, scope), `${path}.layout_event`, scope);
}

export function assertLayoutIRRecords(
  records: readonly LayoutIRRecord[],
  path = "$",
  scope = "LayoutIRRecords"
): void {
  const seenPairs = new Set<string>();
  let prev: LayoutIRRecord | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    assertLayoutIRRecord(row, `${path}[${i}]`, scope);

    const duplicateKey = `${row.gapid}\u0000${row.layout_event.type}`;
    if (seenPairs.has(duplicateKey)) {
      fail(
        scope,
        `${path}[${i}]`,
        `duplicate (gapid,type) pair '${row.gapid}', '${row.layout_event.type}'`
      );
    }
    seenPairs.add(duplicateKey);

    if (prev && compareLayoutIRRecords(prev, row) > 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be in deterministic ascending order by (ref_key order, gap_index, type)"
      );
    }
    prev = row;
  }
}

export function assertLayoutIRRecordsAgainstKnownGaps(
  records: readonly LayoutIRRecord[],
  knownGapIds: Iterable<string>,
  path = "$",
  scope = "LayoutIRRecords"
): void {
  assertLayoutIRRecords(records, path, scope);
  const known = new Set<string>();
  for (const gapid of knownGapIds) {
    known.add(String(gapid));
  }

  for (let i = 0; i < records.length; i += 1) {
    if (!known.has(records[i].gapid)) {
      fail(scope, `${path}[${i}].gapid`, `unknown gapid '${records[i].gapid}'`);
    }
  }
}

export function serializeLayoutIRRecord(record: LayoutIRRecord): string {
  assertLayoutIRRecord(record);
  return canonicalStringify(record);
}

export function parseLayoutIRJsonl(text: string): LayoutIRRecord[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid LayoutIRJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: LayoutIRRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid LayoutIRJsonl at line ${String(i + 1)}: ${message}`);
    }
    assertLayoutIRRecord(parsed, `$[${i}]`);
    out.push(parsed);
  }

  assertLayoutIRRecords(out);
  return out;
}

export function formatLayoutIRJsonl(records: readonly LayoutIRRecord[]): string {
  const normalized = [...records].sort(compareLayoutIRRecords);
  assertLayoutIRRecords(normalized);

  if (normalized.length === 0) {
    return "";
  }
  return `${normalized.map((record) => serializeLayoutIRRecord(record)).join("\n")}\n`;
}

export async function readLayoutIRJsonl(filePath: string): Promise<LayoutIRRecord[]> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseLayoutIRJsonl(raw);
}

export async function writeLayoutIRJsonl(
  filePath: string,
  records: readonly LayoutIRRecord[]
): Promise<void> {
  const text = formatLayoutIRJsonl(records);
  await fs.writeFile(filePath, text, "utf8");
}
