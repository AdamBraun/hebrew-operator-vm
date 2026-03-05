import {
  type FlowMode,
  type KnownTraceEventKind,
  type TraceEvent,
  type TraceRecord,
  TRACE_EVENT_SOURCES,
  compareTraceEvents,
  deriveSkeleton,
  isTraceEventKind,
  type VerseTraceRecord,
  type WordTraceRecord
} from "./types";
import { canonicalStringify, hashTraceRecord, sortObjectKeysDeep } from "./hash";

const TRACE_EVENT_SOURCE_RANK = new Map(
  TRACE_EVENT_SOURCES.map((source, index) => [source, index] as const)
);

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareRefKeyLike(left: string, right: string): number {
  const leftParts = String(left).split("/");
  const rightParts = String(right).split("/");
  const maxLen = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLen; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    if (leftPart === rightPart) {
      continue;
    }
    const leftIsInt = /^[0-9]+$/u.test(leftPart);
    const rightIsInt = /^[0-9]+$/u.test(rightPart);
    if (leftIsInt && rightIsInt) {
      const diff = Number(leftPart) - Number(rightPart);
      if (diff !== 0) {
        return diff;
      }
      continue;
    }
    return compareText(leftPart, rightPart);
  }
  return 0;
}

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function asMode(value: unknown): FlowMode | undefined {
  if (value === "WORD" || value === "VERSE" || value === "WINDOW") {
    return value;
  }
  return undefined;
}

function normalizeKnownSkeleton(value: readonly unknown[] | undefined): KnownTraceEventKind[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: KnownTraceEventKind[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    if (!isTraceEventKind(entry) || entry === "EXTENSION") {
      continue;
    }
    out.push(entry as KnownTraceEventKind);
  }
  return out;
}

function compareTraceEventStable(left: TraceEvent, right: TraceEvent): number {
  const base = compareTraceEvents(left, right);
  if (base !== 0) {
    return base;
  }
  const leftSourceRank = TRACE_EVENT_SOURCE_RANK.get(left.source) ?? Number.MAX_SAFE_INTEGER;
  const rightSourceRank = TRACE_EVENT_SOURCE_RANK.get(right.source) ?? Number.MAX_SAFE_INTEGER;
  if (leftSourceRank !== rightSourceRank) {
    return leftSourceRank - rightSourceRank;
  }
  const payloadCmp = compareText(
    canonicalStringify(left.payload),
    canonicalStringify(right.payload)
  );
  if (payloadCmp !== 0) {
    return payloadCmp;
  }
  return compareText(left.kind, right.kind);
}

function normalizeTraceEvents(events: readonly TraceEvent[]): TraceEvent[] {
  const normalized = events.map((event) => ({
    kind: event.kind,
    index: Number.isInteger(event.index) ? event.index : 0,
    tau: Number.isFinite(event.tau) ? event.tau : 0,
    source: event.source,
    payload: sortObjectKeysDeep(event.payload)
  })) as TraceEvent[];

  normalized.sort(compareTraceEventStable);

  return normalized.map((event, index) => ({
    ...event,
    index
  })) as TraceEvent[];
}

function normalizeRefWord(record: WordTraceRecord): WordTraceRecord["ref"] {
  return {
    book: String(record.ref.book),
    chapter: asPositiveInt(record.ref.chapter, 1),
    verse: asPositiveInt(record.ref.verse, 1),
    token_index: asPositiveInt(record.ref.token_index, 1)
  };
}

function normalizeRefVerse(record: VerseTraceRecord): VerseTraceRecord["ref"] {
  return {
    book: String(record.ref.book),
    chapter: asPositiveInt(record.ref.chapter, 1),
    verse: asPositiveInt(record.ref.verse, 1)
  };
}

function normalizeCountRecord(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(input).sort(compareText)) {
    out[key] = Number(input[key] ?? 0);
  }
  return out;
}

function normalizePhraseBreakEvents(
  events: VerseTraceRecord["boundary_events"]["phrase_breaks"] | undefined
): VerseTraceRecord["boundary_events"]["phrase_breaks"] {
  if (!Array.isArray(events)) {
    return [];
  }

  return [...events]
    .map((event) => ({
      kind: "PHRASE_BREAK" as const,
      phrase_node_id: String(event.phrase_node_id),
      split_word_index: asPositiveInt(event.split_word_index, 1),
      word_span: {
        start: asPositiveInt(event.word_span?.start, 1),
        end: asPositiveInt(event.word_span?.end, 1)
      },
      evidence: {
        verse_ref_key: String(event.evidence?.verse_ref_key ?? ""),
        phrase_version: String(event.evidence?.phrase_version ?? "")
      }
    }))
    .sort((left, right) => {
      if (left.split_word_index !== right.split_word_index) {
        return left.split_word_index - right.split_word_index;
      }
      if (left.word_span.start !== right.word_span.start) {
        return left.word_span.start - right.word_span.start;
      }
      if (left.word_span.end !== right.word_span.end) {
        return left.word_span.end - right.word_span.end;
      }
      const nodeCmp = compareText(left.phrase_node_id, right.phrase_node_id);
      if (nodeCmp !== 0) {
        return nodeCmp;
      }
      const refCmp = compareRefKeyLike(left.evidence.verse_ref_key, right.evidence.verse_ref_key);
      if (refCmp !== 0) {
        return refCmp;
      }
      return compareText(left.evidence.phrase_version, right.evidence.phrase_version);
    });
}

function normalizeCrossWordEvents(
  events: VerseTraceRecord["cross_word_events"]
): VerseTraceRecord["cross_word_events"] {
  return [...events]
    .map((event) => ({
      ref_key: String(event.ref_key),
      token_index: asPositiveInt(event.token_index, 1),
      baseline_skeleton: normalizeKnownSkeleton(event.baseline_skeleton),
      observed_skeleton: normalizeKnownSkeleton(event.observed_skeleton),
      explanation: String(event.explanation)
    }))
    .sort((left, right) => {
      const keyCmp = compareRefKeyLike(left.ref_key, right.ref_key);
      if (keyCmp !== 0) {
        return keyCmp;
      }
      if (left.token_index !== right.token_index) {
        return left.token_index - right.token_index;
      }
      const baseCmp = compareText(
        left.baseline_skeleton.join("|"),
        right.baseline_skeleton.join("|")
      );
      if (baseCmp !== 0) {
        return baseCmp;
      }
      const observedCmp = compareText(
        left.observed_skeleton.join("|"),
        right.observed_skeleton.join("|")
      );
      if (observedCmp !== 0) {
        return observedCmp;
      }
      return compareText(left.explanation, right.explanation);
    });
}

function normalizeNotableMotifs(
  motifs: VerseTraceRecord["notable_motifs"]
): VerseTraceRecord["notable_motifs"] {
  return [...motifs]
    .map((motif) => {
      const out: VerseTraceRecord["notable_motifs"][number] = {
        motif: String(motif.motif),
        count: Number(motif.count ?? 0)
      };
      if (motif.samples !== undefined) {
        out.samples = sortObjectKeysDeep(motif.samples);
      }
      if (motif.refs !== undefined) {
        out.refs = [...motif.refs].map(String).sort(compareRefKeyLike);
      }
      if (motif.ops !== undefined) {
        out.ops = [...motif.ops].map(String).sort(compareText);
      }
      if (motif.action !== undefined) {
        out.action = String(motif.action);
      }
      return out;
    })
    .sort(
      (left, right) =>
        compareText(left.motif, right.motif) ||
        right.count - left.count ||
        compareText(canonicalStringify(left), canonicalStringify(right))
    );
}

function normalizeSafetyRail(
  safetyRail: VerseTraceRecord["safety_rail"]
): VerseTraceRecord["safety_rail"] {
  if (!safetyRail) {
    return undefined;
  }
  return {
    active: Boolean(safetyRail.active),
    provisional_delta_count: Number(safetyRail.provisional_delta_count ?? 0),
    provisional_delta_rate: Number(safetyRail.provisional_delta_rate ?? 0),
    threshold: Number(safetyRail.threshold ?? 0)
  };
}

function normalizeExtensions(
  extensions: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) {
    return undefined;
  }
  const normalized = sortObjectKeysDeep(extensions);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return undefined;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function canonicalizeWordTraceRecord(input: WordTraceRecord): WordTraceRecord {
  const events = normalizeTraceEvents(input.events);
  const skeleton =
    normalizeKnownSkeleton(input.skeleton).length > 0
      ? normalizeKnownSkeleton(input.skeleton)
      : deriveSkeleton(events);
  const mode = asMode(input.mode);
  const windowStart =
    mode === "WINDOW" && input.window_start !== undefined
      ? asPositiveInt(input.window_start, 1)
      : undefined;
  const extensions = normalizeExtensions(input.extensions);

  const base: WordTraceRecord = {
    record_kind: "WORD_TRACE",
    trace_version: input.trace_version,
    semantics_version: input.semantics_version,
    render_version: input.render_version,
    ref: normalizeRefWord(input),
    ref_key: String(input.ref_key),
    surface: String(input.surface),
    token_ids: [...input.token_ids].map((tokenId) => Number(tokenId)),
    events,
    skeleton
  };

  if (typeof input.flow === "string" && input.flow.length > 0) {
    base.flow = input.flow;
  }
  if (mode !== undefined) {
    base.mode = mode;
  }
  if (windowStart !== undefined) {
    base.window_start = windowStart;
  }

  const canonical_hash = hashTraceRecord(base);
  const out: WordTraceRecord = {
    ...base,
    canonical_hash
  };
  if (extensions !== undefined) {
    out.extensions = extensions;
  }
  return out;
}

export function canonicalizeVerseTraceRecord(input: VerseTraceRecord): VerseTraceRecord {
  const boundaryEvents = {
    total: Number(input.boundary_events.total ?? 0),
    by_type: normalizeCountRecord(input.boundary_events.by_type ?? {}),
    verse_end: [...(input.boundary_events.verse_end ?? [])].map(String).sort(compareText),
    phrase_breaks: normalizePhraseBreakEvents(input.boundary_events.phrase_breaks ?? []),
    verse_boundary_operator: {
      op_family: "VERSE.BOUNDARY_RESOLUTION" as const,
      trigger: "explicit_verse_boundary" as const,
      support_opened: Number(input.boundary_events.verse_boundary_operator.support_opened ?? 0),
      support_discharged: Number(
        input.boundary_events.verse_boundary_operator.support_discharged ?? 0
      ),
      support_resolved_at_boundary: Number(
        input.boundary_events.verse_boundary_operator.support_resolved_at_boundary ?? 0
      ),
      mem_opened: Number(input.boundary_events.verse_boundary_operator.mem_opened ?? 0),
      mem_closed: Number(input.boundary_events.verse_boundary_operator.mem_closed ?? 0),
      mem_resolved_at_boundary: Number(
        input.boundary_events.verse_boundary_operator.mem_resolved_at_boundary ?? 0
      ),
      boundary_ops_seen: Number(
        input.boundary_events.verse_boundary_operator.boundary_ops_seen ?? 0
      ),
      finalize_refs: [...input.boundary_events.verse_boundary_operator.finalize_refs]
        .map(String)
        .sort(compareRefKeyLike),
      action: input.boundary_events.verse_boundary_operator.action
    }
  };

  const crossWordEvents = normalizeCrossWordEvents(input.cross_word_events);
  const notableMotifs = normalizeNotableMotifs(input.notable_motifs);
  const safetyRail = normalizeSafetyRail(input.safety_rail);
  const extensions = normalizeExtensions(input.extensions);

  const base: VerseTraceRecord = {
    record_kind: "VERSE_TRACE",
    trace_version: input.trace_version,
    semantics_version: input.semantics_version,
    render_version: input.render_version,
    ref: normalizeRefVerse(input),
    ref_key: String(input.ref_key),
    mode: String(input.mode),
    words_total: Number(input.words_total ?? 0),
    total_events: Number(input.total_events ?? 0),
    boundary_events: boundaryEvents,
    cross_word_events: crossWordEvents,
    notable_motifs: notableMotifs
  };

  if (input.window_size !== undefined) {
    base.window_size = asPositiveInt(input.window_size, 1);
  }
  if (safetyRail !== undefined) {
    base.safety_rail = safetyRail;
  }

  const canonical_hash = hashTraceRecord(base);
  const out: VerseTraceRecord = {
    ...base,
    canonical_hash
  };
  if (extensions !== undefined) {
    out.extensions = extensions;
  }
  return out;
}

export function compareWordTraceRecords(left: WordTraceRecord, right: WordTraceRecord): number {
  const bookCmp = compareText(left.ref.book, right.ref.book);
  if (bookCmp !== 0) {
    return bookCmp;
  }
  if (left.ref.chapter !== right.ref.chapter) {
    return left.ref.chapter - right.ref.chapter;
  }
  if (left.ref.verse !== right.ref.verse) {
    return left.ref.verse - right.ref.verse;
  }
  return left.ref.token_index - right.ref.token_index;
}

export function compareVerseTraceRecords(left: VerseTraceRecord, right: VerseTraceRecord): number {
  const bookCmp = compareText(left.ref.book, right.ref.book);
  if (bookCmp !== 0) {
    return bookCmp;
  }
  if (left.ref.chapter !== right.ref.chapter) {
    return left.ref.chapter - right.ref.chapter;
  }
  return left.ref.verse - right.ref.verse;
}

export function canonicalizeTraceRecord(record: TraceRecord): TraceRecord {
  return record.record_kind === "WORD_TRACE"
    ? canonicalizeWordTraceRecord(record)
    : canonicalizeVerseTraceRecord(record);
}

export function canonicalizeTraceRecords(records: readonly TraceRecord[]): TraceRecord[] {
  return records
    .map((record) => canonicalizeTraceRecord(record))
    .sort((left, right) => {
      if (left.record_kind === right.record_kind) {
        return left.record_kind === "WORD_TRACE"
          ? compareWordTraceRecords(left as WordTraceRecord, right as WordTraceRecord)
          : compareVerseTraceRecords(left as VerseTraceRecord, right as VerseTraceRecord);
      }
      return left.record_kind === "WORD_TRACE" ? -1 : 1;
    });
}
