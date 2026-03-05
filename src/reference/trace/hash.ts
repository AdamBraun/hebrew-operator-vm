import crypto from "node:crypto";
import type { TraceRecord, VerseTraceRecord, WordTraceRecord } from "./types";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
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

export function sortObjectKeysDeep<T>(value: T): T {
  const normalized = toCanonicalJsonValue(value);
  if (normalized === undefined) {
    return value;
  }
  return normalized as T;
}

export function canonicalStringify(value: unknown): string {
  const normalized = toCanonicalJsonValue(value);
  return JSON.stringify(normalized === undefined ? null : normalized);
}

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function semanticHashBasisWord(record: WordTraceRecord): Record<string, unknown> {
  return {
    record_kind: record.record_kind,
    trace_version: record.trace_version,
    semantics_version: record.semantics_version,
    ref: record.ref,
    ref_key: record.ref_key,
    token_ids: record.token_ids,
    events: record.events
  };
}

function semanticHashBasisVerse(record: VerseTraceRecord): Record<string, unknown> {
  const basis: Record<string, unknown> = {
    record_kind: record.record_kind,
    trace_version: record.trace_version,
    semantics_version: record.semantics_version,
    ref: record.ref,
    ref_key: record.ref_key,
    mode: record.mode,
    words_total: record.words_total,
    total_events: record.total_events,
    boundary_events: record.boundary_events,
    cross_word_events: record.cross_word_events,
    notable_motifs: record.notable_motifs
  };
  if (record.window_size !== undefined) {
    basis.window_size = record.window_size;
  }
  if (record.safety_rail !== undefined) {
    basis.safety_rail = record.safety_rail;
  }
  return basis;
}

export function semanticHashBasis(record: TraceRecord): Record<string, unknown> {
  return record.record_kind === "WORD_TRACE"
    ? semanticHashBasisWord(record)
    : semanticHashBasisVerse(record);
}

export function hashTraceRecord(record: TraceRecord): string {
  return sha256Hex(canonicalStringify(semanticHashBasis(record)));
}
