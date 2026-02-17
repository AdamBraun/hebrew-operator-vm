import type { RenderOutputRecord } from '../contracts';
import type { LedgerAnchor, LedgerPointer } from './types';

const ANCHOR_TOKEN_PATTERN = /\[\[([A-Za-z0-9._:-]+)\]\]/g;
const POINTER_PATTERN = /^(verse|word|trace):([^#]+)(?:#e(\d+)(?:-(\d+))?)?$/;

export function extractLedgerAnchorsFromRecord(record: RenderOutputRecord): LedgerAnchor[] {
  const anchorMap = parseAnchorMap(record);
  const anchorIds = collectAnchorIds(record.text, anchorMap);
  const anchors: LedgerAnchor[] = [];

  for (const anchorId of anchorIds) {
    const mapped = anchorMap.get(anchorId);
    if (mapped) {
      anchors.push(mapped);
      continue;
    }

    anchors.push(fallbackAnchor(anchorId, record.ref_key, record.style));
  }

  return anchors;
}

export function parseLedgerPointer(value: unknown): LedgerPointer | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(POINTER_PATTERN);
    if (!match) {
      return null;
    }

    const kind = match[1] as LedgerPointer['kind'];
    const refKey = match[2]?.trim() ?? '';
    if (!refKey) {
      return null;
    }

    const [eventStart, eventEnd] = normalizeEventSpan(
      match[3] !== undefined ? Number(match[3]) : null,
      match[4] !== undefined ? Number(match[4]) : null
    );

    return {
      kind,
      refKey,
      eventStart: kind === 'trace' ? eventStart : null,
      eventEnd: kind === 'trace' ? eventEnd : null
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const kind = readString(value, ['kind', 'type']);
  const refKey = readString(value, ['ref_key', 'refKey', 'ref']);
  if (!kind || !refKey) {
    return null;
  }
  if (kind !== 'verse' && kind !== 'word' && kind !== 'trace') {
    return null;
  }

  const [eventStart, eventEnd] = normalizeEventSpan(
    readNumber(value, ['event_start', 'eventStart']),
    readNumber(value, ['event_end', 'eventEnd']),
    value.event_span
  );

  return {
    kind,
    refKey,
    eventStart: kind === 'trace' ? eventStart : null,
    eventEnd: kind === 'trace' ? eventEnd : null
  };
}

export function ledgerPointerToString(pointer: LedgerPointer): string {
  if (pointer.kind !== 'trace') {
    return `${pointer.kind}:${pointer.refKey}`;
  }
  if (pointer.eventStart === null && pointer.eventEnd === null) {
    return `trace:${pointer.refKey}`;
  }
  if (pointer.eventStart === pointer.eventEnd) {
    return `trace:${pointer.refKey}#e${String(pointer.eventStart)}`;
  }
  return `trace:${pointer.refKey}#e${String(pointer.eventStart)}-${String(pointer.eventEnd)}`;
}

export function parseWordRefKey(refKey: string): { verseRefKey: string; wordIndex: number } | null {
  const parts = String(refKey).split('/');
  if (parts.length !== 4) {
    return null;
  }

  const wordIndex = Number(parts[3]);
  if (!Number.isInteger(wordIndex) || wordIndex < 1) {
    return null;
  }

  return {
    verseRefKey: `${parts[0]}/${parts[1]}/${parts[2]}`,
    wordIndex
  };
}

function parseAnchorMap(record: RenderOutputRecord): Map<string, LedgerAnchor> {
  const raw = resolveAnchorMap(record.metadata);
  const out = new Map<string, LedgerAnchor>();
  if (!raw) {
    return out;
  }

  for (const [anchorId, rawEntry] of Object.entries(raw)) {
    if (!anchorId) {
      continue;
    }
    const parsed = parseAnchorSelection(anchorId, rawEntry, record);
    if (parsed) {
      out.set(anchorId, parsed);
    }
  }

  return out;
}

function parseAnchorSelection(
  anchorId: string,
  rawEntry: unknown,
  record: RenderOutputRecord
): LedgerAnchor | null {
  if (!isRecord(rawEntry)) {
    return null;
  }

  const refKey = readString(rawEntry, ['ref_key', 'refKey']) ?? record.ref_key;
  const pointers = parsePointerCollection(rawEntry.evidence)
    .concat(parsePointerCollection(rawEntry.pointers))
    .concat(parsePointerCollection(rawEntry.pointer))
    .concat(parsePointerCollection(rawEntry))
    .concat(
      rawEntry.verse_ledger
        ? parsePointerCollection(`verse:${String(rawEntry.verse_ledger)}`)
        : []
    )
    .concat(rawEntry.word ? parsePointerCollection(`word:${String(rawEntry.word)}`) : [])
    .concat(rawEntry.word_trace ? parsePointerCollection(`trace:${String(rawEntry.word_trace)}`) : []);

  const normalizedPointers =
    pointers.length > 0
      ? dedupePointers(pointers)
      : [
          {
            kind: 'verse',
            refKey: toVerseRefKey(refKey),
            eventStart: null,
            eventEnd: null
          } satisfies LedgerPointer
        ];

  return {
    style: record.style,
    anchorId,
    refKey,
    pointers: normalizedPointers
  };
}

function collectAnchorIds(text: string, mapping: Map<string, LedgerAnchor>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  ANCHOR_TOKEN_PATTERN.lastIndex = 0;
  let match = ANCHOR_TOKEN_PATTERN.exec(text);
  while (match) {
    const anchorId = match[1] ?? '';
    if (anchorId && !seen.has(anchorId)) {
      seen.add(anchorId);
      ids.push(anchorId);
    }
    match = ANCHOR_TOKEN_PATTERN.exec(text);
  }

  for (const anchorId of mapping.keys()) {
    if (!seen.has(anchorId)) {
      seen.add(anchorId);
      ids.push(anchorId);
    }
  }

  return ids;
}

function parsePointerCollection(raw: unknown): LedgerPointer[] {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parsePointerCollection(item));
  }

  const parsed = parseLedgerPointer(raw);
  return parsed ? [parsed] : [];
}

function resolveAnchorMap(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }
  if (isRecord(metadata.anchor_map)) {
    return metadata.anchor_map;
  }
  if (isRecord(metadata.anchors)) {
    return metadata.anchors;
  }
  return null;
}

function fallbackAnchor(anchorId: string, refKey: string, style: 'strict' | 'poetic'): LedgerAnchor {
  return {
    style,
    anchorId,
    refKey,
    pointers: [
      {
        kind: 'verse',
        refKey: toVerseRefKey(refKey),
        eventStart: null,
        eventEnd: null
      }
    ]
  };
}

function dedupePointers(pointers: LedgerPointer[]): LedgerPointer[] {
  const uniqueByKey = new Map<string, LedgerPointer>();
  for (const pointer of pointers) {
    const key = ledgerPointerToString(pointer);
    if (!uniqueByKey.has(key)) {
      uniqueByKey.set(key, pointer);
    }
  }
  return Array.from(uniqueByKey.values());
}

function normalizeEventSpan(
  startValue: number | null,
  endValue: number | null,
  spanValue?: unknown
): [number | null, number | null] {
  let start = Number.isInteger(startValue) && (startValue ?? 0) >= 0 ? startValue : null;
  let end = Number.isInteger(endValue) && (endValue ?? 0) >= 0 ? endValue : null;

  if (Array.isArray(spanValue) && spanValue.length >= 1) {
    const spanStart = Number(spanValue[0]);
    const spanEnd = Number(spanValue[1] ?? spanValue[0]);
    if (Number.isInteger(spanStart) && spanStart >= 0) {
      start = spanStart;
    }
    if (Number.isInteger(spanEnd) && spanEnd >= 0) {
      end = spanEnd;
    }
  }

  if (start !== null && end === null) {
    end = start;
  }
  if (start === null && end !== null) {
    start = end;
  }
  if (start !== null && end !== null && start > end) {
    return [end, start];
  }
  return [start, end];
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      return value;
    }
  }
  return null;
}

function toVerseRefKey(refKey: string): string {
  const parts = String(refKey).split('/');
  if (parts.length < 3) {
    return refKey;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
