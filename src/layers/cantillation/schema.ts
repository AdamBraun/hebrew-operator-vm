import fs from "node:fs/promises";
import { type SpineRecord } from "../../spine/schema";

export const CANTILLATION_IR_VERSION = 1;

export type CantillationAnchorKind = "gid" | "gap";

export type CantillationGidAnchor = {
  kind: "gid";
  id: string;
};

export type CantillationGapAnchor = {
  kind: "gap";
  id: string;
};

export type CantillationAnchor = CantillationGidAnchor | CantillationGapAnchor;

export type CantillationTropeMarkEvent = {
  type: "TROPE_MARK";
  mark: string;
  class: string;
  rank: number;
};

export type CantillationBoundaryEvent = {
  type: "BOUNDARY";
  op: string;
  rank: number;
  reason: string;
};

export type CantillationEvent = CantillationTropeMarkEvent | CantillationBoundaryEvent;

export type CantillationRaw = {
  teamim?: string[];
  source?: string;
  [key: string]: unknown;
};

export type CantillationIRRecord = {
  kind: "cant_event";
  anchor: CantillationAnchor;
  ref_key: string;
  event: CantillationEvent;
  raw: CantillationRaw;
};

export type CantillationGidEventRecord = CantillationIRRecord & {
  anchor: CantillationGidAnchor;
  event: CantillationTropeMarkEvent;
};

export type CantillationGapEventRecord = CantillationIRRecord & {
  anchor: CantillationGapAnchor;
  event: CantillationBoundaryEvent;
};

export type ResolvedCantillationAnchor = {
  kind: CantillationAnchorKind;
  id: string;
  ref_key: string;
  index: number;
};

export const CANTILLATION_IR_RECORD_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "spec/schemas/cantillation-ir-record.schema.json",
  title: "CantillationIRRecord",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "anchor", "ref_key", "event", "raw"],
      properties: {
        kind: { const: "cant_event" },
        anchor: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "id"],
          properties: {
            kind: { const: "gid" },
            id: {
              type: "string",
              minLength: 1,
              pattern: "^.+#g:[0-9]+$"
            }
          }
        },
        ref_key: {
          type: "string",
          minLength: 1
        },
        event: {
          type: "object",
          additionalProperties: false,
          required: ["type", "mark", "class", "rank"],
          properties: {
            type: { const: "TROPE_MARK" },
            mark: { type: "string", minLength: 1 },
            class: { type: "string", minLength: 1 },
            rank: { type: "integer", minimum: 0 }
          }
        },
        raw: {
          type: "object",
          required: ["teamim"],
          properties: {
            teamim: {
              type: "array",
              items: { type: "string" }
            }
          },
          additionalProperties: true
        }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "anchor", "ref_key", "event", "raw"],
      properties: {
        kind: { const: "cant_event" },
        anchor: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "id"],
          properties: {
            kind: { const: "gap" },
            id: {
              type: "string",
              minLength: 1,
              pattern: "^.+#gap:[0-9]+$"
            }
          }
        },
        ref_key: {
          type: "string",
          minLength: 1
        },
        event: {
          type: "object",
          additionalProperties: false,
          required: ["type", "op", "rank", "reason"],
          properties: {
            type: { const: "BOUNDARY" },
            op: { type: "string", minLength: 1 },
            rank: { type: "integer", minimum: 0 },
            reason: { type: "string", minLength: 1 }
          }
        },
        raw: {
          type: "object",
          required: ["source"],
          properties: {
            source: {
              type: "string",
              minLength: 1
            }
          },
          additionalProperties: true
        }
      }
    }
  ]
} as const;

type UnknownRecord = Record<string, unknown>;

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const OWN = Object.prototype.hasOwnProperty;
const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;
const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;

const ANCHOR_KIND_ORDER: Readonly<Record<CantillationAnchorKind, number>> = {
  gid: 0,
  gap: 1
};

const EVENT_TYPE_ORDER: Readonly<Record<CantillationEvent["type"], number>> = {
  TROPE_MARK: 0,
  BOUNDARY: 1
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function normalizeRefSegment(
  segment: string
): { kind: "int"; value: number } | { kind: "text"; value: string } {
  if (/^[0-9]+$/.test(segment)) {
    return { kind: "int", value: Number(segment) };
  }
  return { kind: "text", value: segment };
}

function parseAnchorId(
  kind: CantillationAnchorKind,
  id: string
): ResolvedCantillationAnchor | null {
  const match = kind === "gid" ? id.match(GID_PATTERN) : id.match(GAPID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const parsed = Number(match[2]);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return {
    kind,
    id,
    ref_key,
    index: parsed
  };
}

function hasCanonicalTeamimOrder(teamim: readonly string[]): boolean {
  const normalized = normalizeCantillationTeamim(teamim);
  if (normalized.length !== teamim.length) {
    return false;
  }
  for (let i = 0; i < teamim.length; i += 1) {
    if (teamim[i] !== normalized[i]) {
      return false;
    }
  }
  return true;
}

export function normalizeCantillationTeamim(teamim: readonly string[]): string[] {
  return [...teamim].sort(compareText);
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

export function resolveCantillationAnchor(
  anchor: CantillationAnchor
): ResolvedCantillationAnchor | null {
  return parseAnchorId(anchor.kind, anchor.id);
}

export function cantillationEventSortKey(event: CantillationEvent): string {
  if (event.type === "TROPE_MARK") {
    return `${event.type}\u0000${event.class}\u0000${String(event.rank)}\u0000${event.mark}`;
  }
  return `${event.type}\u0000${event.op}\u0000${String(event.rank)}\u0000${event.reason}`;
}

export function compareCantillationEvents(
  left: CantillationEvent,
  right: CantillationEvent
): number {
  if (left.type !== right.type) {
    return EVENT_TYPE_ORDER[left.type] - EVENT_TYPE_ORDER[right.type];
  }

  if (left.type === "TROPE_MARK" && right.type === "TROPE_MARK") {
    const classCmp = compareText(left.class, right.class);
    if (classCmp !== 0) {
      return classCmp;
    }
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return compareText(left.mark, right.mark);
  }

  const l = left as CantillationBoundaryEvent;
  const r = right as CantillationBoundaryEvent;
  const opCmp = compareText(l.op, r.op);
  if (opCmp !== 0) {
    return opCmp;
  }
  if (l.rank !== r.rank) {
    return l.rank - r.rank;
  }
  return compareText(l.reason, r.reason);
}

export function compareCantillationIRRecords(
  left: CantillationIRRecord,
  right: CantillationIRRecord
): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }

  if (left.anchor.kind !== right.anchor.kind) {
    return ANCHOR_KIND_ORDER[left.anchor.kind] - ANCHOR_KIND_ORDER[right.anchor.kind];
  }

  const leftAnchor = resolveCantillationAnchor(left.anchor);
  const rightAnchor = resolveCantillationAnchor(right.anchor);
  if (!leftAnchor || !rightAnchor) {
    return compareText(left.anchor.id, right.anchor.id);
  }

  if (leftAnchor.index !== rightAnchor.index) {
    return leftAnchor.index - rightAnchor.index;
  }

  const eventCmp = compareCantillationEvents(left.event, right.event);
  if (eventCmp !== 0) {
    return eventCmp;
  }

  const idCmp = compareText(left.anchor.id, right.anchor.id);
  if (idCmp !== 0) {
    return idCmp;
  }

  return compareText(cantillationEventSortKey(left.event), cantillationEventSortKey(right.event));
}

function isCantillationAnchor(value: unknown): value is CantillationAnchor {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "gid" && value.kind !== "gap") {
    return false;
  }
  if (!isNonEmptyString(value.id)) {
    return false;
  }
  return parseAnchorId(value.kind, value.id) !== null;
}

function isCantillationTropeMarkEvent(value: unknown): value is CantillationTropeMarkEvent {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === "TROPE_MARK" &&
    isNonEmptyString(value.mark) &&
    isNonEmptyString(value.class) &&
    isNonNegativeInteger(value.rank)
  );
}

function isCantillationBoundaryEvent(value: unknown): value is CantillationBoundaryEvent {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.type === "BOUNDARY" &&
    isNonEmptyString(value.op) &&
    isNonNegativeInteger(value.rank) &&
    isNonEmptyString(value.reason)
  );
}

function isCantillationEvent(value: unknown): value is CantillationEvent {
  return isCantillationTropeMarkEvent(value) || isCantillationBoundaryEvent(value);
}

export function isCantillationIRRecord(value: unknown): value is CantillationIRRecord {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "cant_event") {
    return false;
  }
  if (!isCantillationAnchor(value.anchor)) {
    return false;
  }
  if (!isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isCantillationEvent(value.event)) {
    return false;
  }
  if (!isRecord(value.raw)) {
    return false;
  }

  const parsed = resolveCantillationAnchor(value.anchor);
  if (!parsed || parsed.ref_key !== value.ref_key) {
    return false;
  }

  if (value.anchor.kind === "gid") {
    if (value.event.type !== "TROPE_MARK") {
      return false;
    }
    if (!isStringArray(value.raw.teamim)) {
      return false;
    }
    if (!hasCanonicalTeamimOrder(value.raw.teamim)) {
      return false;
    }
    return true;
  }

  if (value.event.type !== "BOUNDARY") {
    return false;
  }
  return isNonEmptyString(value.raw.source);
}

function fail(scope: string, path: string, message: string): never {
  throw new Error(`Invalid ${scope} at ${path}: ${message}`);
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

function assertStringArray(value: unknown, path: string, scope: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail(scope, path, `expected string[], got ${describe(value)}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      fail(scope, `${path}[${i}]`, `expected string, got ${describe(value[i])}`);
    }
  }
}

function assertCantillationAnchor(
  value: unknown,
  path: string,
  scope: string
): asserts value is CantillationAnchor {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["kind", "id"], path, scope);

  const kind = assertHas(value, "kind", path, scope);
  if (kind !== "gid" && kind !== "gap") {
    fail(scope, `${path}.kind`, `expected 'gid' | 'gap', got ${describe(kind)}`);
  }

  const id = assertHas(value, "id", path, scope);
  assertNonEmptyString(id, `${path}.id`, scope);

  const parsed = parseAnchorId(kind, id);
  if (!parsed) {
    const expected = kind === "gid" ? "'<ref_key>#g:<g_index>'" : "'<ref_key>#gap:<gap_index>'";
    fail(scope, `${path}.id`, `expected ${expected}, got ${describe(id)}`);
  }
}

function assertCantillationEvent(
  value: unknown,
  path: string,
  scope: string
): asserts value is CantillationEvent {
  assertRecord(value, path, scope);
  const type = assertHas(value, "type", path, scope);

  if (type === "TROPE_MARK") {
    assertNoUnknownKeys(value, ["type", "mark", "class", "rank"], path, scope);
    assertNonEmptyString(assertHas(value, "mark", path, scope), `${path}.mark`, scope);
    assertNonEmptyString(assertHas(value, "class", path, scope), `${path}.class`, scope);
    assertNonNegativeInteger(assertHas(value, "rank", path, scope), `${path}.rank`, scope);
    return;
  }

  if (type === "BOUNDARY") {
    assertNoUnknownKeys(value, ["type", "op", "rank", "reason"], path, scope);
    assertNonEmptyString(assertHas(value, "op", path, scope), `${path}.op`, scope);
    assertNonNegativeInteger(assertHas(value, "rank", path, scope), `${path}.rank`, scope);
    assertNonEmptyString(assertHas(value, "reason", path, scope), `${path}.reason`, scope);
    return;
  }

  fail(scope, `${path}.type`, `expected 'TROPE_MARK' | 'BOUNDARY', got ${describe(type)}`);
}

function assertCantillationRaw(
  value: unknown,
  event: CantillationEvent,
  path: string,
  scope: string
): asserts value is CantillationRaw {
  assertRecord(value, path, scope);

  if (event.type === "TROPE_MARK") {
    const teamim = assertHas(value, "teamim", path, scope);
    assertStringArray(teamim, `${path}.teamim`, scope);
    if (!hasCanonicalTeamimOrder(teamim)) {
      fail(scope, `${path}.teamim`, "teamim marks must be sorted in canonical order");
    }
    if (hasOwn(value, "source") && value.source !== undefined) {
      assertNonEmptyString(value.source, `${path}.source`, scope);
    }
    return;
  }

  const source = assertHas(value, "source", path, scope);
  assertNonEmptyString(source, `${path}.source`, scope);
  if (hasOwn(value, "teamim") && value.teamim !== undefined) {
    const teamim = value.teamim;
    assertStringArray(teamim, `${path}.teamim`, scope);
    if (!hasCanonicalTeamimOrder(teamim)) {
      fail(scope, `${path}.teamim`, "teamim marks must be sorted in canonical order");
    }
  }
}

function assertAnchorMatchesRecord(
  anchor: CantillationAnchor,
  ref_key: string,
  event: CantillationEvent,
  path: string,
  scope: string
): void {
  const parsed = resolveCantillationAnchor(anchor);
  if (!parsed) {
    fail(scope, `${path}.anchor.id`, "invalid anchor id");
  }
  if (parsed.ref_key !== ref_key) {
    fail(scope, `${path}.anchor.id`, `anchor '${anchor.id}' must match ref_key='${ref_key}'`);
  }

  if (anchor.kind === "gid" && event.type !== "TROPE_MARK") {
    fail(scope, `${path}.event.type`, "gid anchors require TROPE_MARK events");
  }
  if (anchor.kind === "gap" && event.type !== "BOUNDARY") {
    fail(scope, `${path}.event.type`, "gap anchors require BOUNDARY events");
  }
}

export function assertCantillationIRRecord(
  value: unknown,
  path = "$",
  scope = "CantillationIRRecord"
): asserts value is CantillationIRRecord {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["kind", "anchor", "ref_key", "event", "raw"], path, scope);

  const kind = assertHas(value, "kind", path, scope);
  if (kind !== "cant_event") {
    fail(scope, `${path}.kind`, `expected 'cant_event', got ${describe(kind)}`);
  }

  const anchor = assertHas(value, "anchor", path, scope);
  assertCantillationAnchor(anchor, `${path}.anchor`, scope);

  const ref_key = assertHas(value, "ref_key", path, scope);
  assertNonEmptyString(ref_key, `${path}.ref_key`, scope);

  const event = assertHas(value, "event", path, scope);
  assertCantillationEvent(event, `${path}.event`, scope);

  const raw = assertHas(value, "raw", path, scope);
  assertCantillationRaw(raw, event, `${path}.raw`, scope);

  assertAnchorMatchesRecord(anchor, ref_key, event, path, scope);
}

export function assertCantillationIRRecords(
  records: readonly CantillationIRRecord[],
  path = "$",
  scope = "CantillationIRRecords"
): void {
  const seen = new Set<string>();
  let prev: CantillationIRRecord | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    assertCantillationIRRecord(row, `${path}[${i}]`, scope);

    const duplicateKey = `${row.anchor.kind}\u0000${row.anchor.id}\u0000${cantillationEventSortKey(row.event)}`;
    if (seen.has(duplicateKey)) {
      fail(
        scope,
        `${path}[${i}]`,
        `duplicate event for anchor '${row.anchor.id}' with sort key '${cantillationEventSortKey(row.event)}'`
      );
    }
    seen.add(duplicateKey);

    if (prev && compareCantillationIRRecords(prev, row) > 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be sorted by (ref_key, anchor.kind, anchor.index, event.sortKey)"
      );
    }
    prev = row;
  }
}

function collectKnownSpineAnchors(spineRecords: readonly SpineRecord[]): {
  gids: Set<string>;
  gapids: Set<string>;
} {
  const gids = new Set<string>();
  const gapids = new Set<string>();

  for (const row of spineRecords) {
    if (row.kind === "g") {
      gids.add(row.gid);
      continue;
    }
    gapids.add(row.gapid);
  }

  return { gids, gapids };
}

export function assertCantillationIRRecordsAgainstSpine(
  records: readonly CantillationIRRecord[],
  spineRecords: readonly SpineRecord[],
  path = "$",
  scope = "CantillationIRRecords"
): void {
  assertCantillationIRRecords(records, path, scope);
  const known = collectKnownSpineAnchors(spineRecords);

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const exists =
      row.anchor.kind === "gid" ? known.gids.has(row.anchor.id) : known.gapids.has(row.anchor.id);
    if (!exists) {
      fail(scope, `${path}[${i}].anchor.id`, `unknown spine anchor '${row.anchor.id}'`);
    }
  }
}

export function normalizeCantillationIRRecord(record: CantillationIRRecord): CantillationIRRecord {
  if (record.anchor.kind !== "gid") {
    return {
      ...record,
      raw: { ...record.raw }
    };
  }

  return {
    ...record,
    raw: {
      ...record.raw,
      teamim: normalizeCantillationTeamim(record.raw.teamim ?? [])
    }
  };
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

export function serializeCantillationIRRecord(record: CantillationIRRecord): string {
  const normalized = normalizeCantillationIRRecord(record);
  assertCantillationIRRecord(normalized);
  return canonicalStringify(normalized);
}

export function parseCantillationIRJsonl(text: string): CantillationIRRecord[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid CantillationIRJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: CantillationIRRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid CantillationIRJsonl at line ${String(i + 1)}: ${message}`);
    }
    assertCantillationIRRecord(parsed, `$[${i}]`);
    out.push(parsed);
  }

  assertCantillationIRRecords(out);
  return out;
}

export function formatCantillationIRJsonl(records: readonly CantillationIRRecord[]): string {
  const normalized = records.map((record) => normalizeCantillationIRRecord(record));
  const sorted = [...normalized].sort(compareCantillationIRRecords);
  assertCantillationIRRecords(sorted);

  if (sorted.length === 0) {
    return "";
  }
  return `${sorted.map((record) => serializeCantillationIRRecord(record)).join("\n")}\n`;
}

export async function readCantillationIRJsonl(filePath: string): Promise<CantillationIRRecord[]> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseCantillationIRJsonl(raw);
}

export async function writeCantillationIRJsonl(
  filePath: string,
  records: readonly CantillationIRRecord[]
): Promise<void> {
  const text = formatCantillationIRJsonl(records);
  await fs.writeFile(filePath, text, "utf8");
}
