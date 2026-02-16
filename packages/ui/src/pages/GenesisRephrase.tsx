import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AnchorEvidencePanel,
  type AnchorEvidencePointer,
  type AnchorEvidenceSelection
} from '../components/AnchorEvidencePanel';
import { getParaphrase, getReferenceCatalog, loadBundle } from '../lib/data/api';
import type { RenderOutputRecord } from '../lib/contracts';
import type { ReferenceCatalog, VerseReferenceEntry } from '../lib/data/loader';

const ANCHOR_TOKEN_PATTERN = /\[\[([A-Za-z0-9._:-]+)\]\]/g;
const POINTER_PATTERN = /^(verse|word|trace):([^#]+)(?:#e(\d+)(?:-(\d+))?)?$/;

const FALLBACK_PARAPHRASE: RenderOutputRecord[] = [
  {
    ref_key: 'Genesis/1/1',
    style: 'strict',
    text: 'At the beginning, God called creation into form [[g1_1_opening]].',
    metadata: {
      anchor_map: {
        g1_1_opening: {
          ref_key: 'Genesis/1/1',
          evidence: ['verse:Genesis/1/1', 'word:Genesis/1/1/1', 'trace:Genesis/1/1/1#e0-3']
        }
      }
    }
  },
  {
    ref_key: 'Genesis/1/1',
    style: 'poetic',
    text: 'First dawn answered the voice [[g1_1_dawn]].',
    metadata: {
      anchor_map: {
        g1_1_dawn: {
          ref_key: 'Genesis/1/1',
          evidence: ['verse:Genesis/1/1', 'word:Genesis/1/1/2', 'trace:Genesis/1/1/2#e0-0']
        }
      }
    }
  },
  {
    ref_key: 'Genesis/1/2',
    style: 'strict',
    text: 'The earth lay unformed while breath moved above the deep [[g1_2_deep]].',
    metadata: {
      anchor_map: {
        g1_2_deep: {
          ref_key: 'Genesis/1/2',
          evidence: ['verse:Genesis/1/2', 'word:Genesis/1/2/5', 'trace:Genesis/1/2/5#e0-1']
        }
      }
    }
  },
  {
    ref_key: 'Genesis/1/2',
    style: 'poetic',
    text: 'A wind hovered over dark waters [[g1_2_wind]].',
    metadata: {
      anchor_map: {
        g1_2_wind: {
          ref_key: 'Genesis/1/2',
          evidence: ['verse:Genesis/1/2', 'word:Genesis/1/2/14', 'trace:Genesis/1/2/14#e0-0']
        }
      }
    }
  },
  {
    ref_key: 'Genesis/2/1',
    style: 'strict',
    text: 'Heavens and earth reached completion with all their hosts [[g2_1_complete]].',
    metadata: {
      anchor_map: {
        g2_1_complete: {
          ref_key: 'Genesis/2/1',
          evidence: ['verse:Genesis/2/1', 'word:Genesis/2/1/1', 'trace:Genesis/2/1/1#e0-0']
        }
      }
    }
  },
  {
    ref_key: 'Genesis/2/1',
    style: 'poetic',
    text: 'Sky and soil settled into finished ranks [[g2_1_hosts]].',
    metadata: {
      anchor_map: {
        g2_1_hosts: {
          ref_key: 'Genesis/2/1',
          evidence: ['verse:Genesis/2/1', 'word:Genesis/2/1/5', 'trace:Genesis/2/1/5#e0-2']
        }
      }
    }
  }
];

interface ParaphraseSegmentText {
  kind: 'text';
  value: string;
}

interface ParaphraseSegmentAnchor {
  kind: 'anchor';
  anchorId: string;
}

type ParaphraseSegment = ParaphraseSegmentText | ParaphraseSegmentAnchor;

export interface ParsedParaphraseLine {
  refKey: string;
  style: 'strict' | 'poetic';
  segments: ParaphraseSegment[];
  anchors: AnchorEvidenceSelection[];
}

export function GenesisRephrase(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [chapterRecords, setChapterRecords] = useState<RenderOutputRecord[]>([]);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [isChapterLoading, setIsChapterLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadBundle('latest')
      .then(() => {
        if (cancelled) {
          return;
        }
        const nextCatalog = getReferenceCatalog();
        setCatalog(nextCatalog);
        setBundleError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCatalog(null);
          setBundleError(error instanceof Error ? error.message : 'Unknown error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const genesisRefsByChapter = useMemo(() => {
    const byChapter = new Map<number, VerseReferenceEntry[]>();
    for (const reference of catalog?.refs ?? []) {
      if (reference.ref.book !== 'Genesis') {
        continue;
      }
      const chapterRefs = byChapter.get(reference.ref.chapter) ?? [];
      if (!byChapter.has(reference.ref.chapter)) {
        byChapter.set(reference.ref.chapter, chapterRefs);
      }
      chapterRefs.push(reference);
    }

    for (const chapterRefs of byChapter.values()) {
      chapterRefs.sort((left, right) => left.ref.verse - right.ref.verse);
    }

    return byChapter;
  }, [catalog?.refs]);

  const availableChapters = useMemo(
    () => Array.from(genesisRefsByChapter.keys()).sort((left, right) => left - right),
    [genesisRefsByChapter]
  );

  const requestedChapter = useMemo(() => {
    const raw = Number(searchParams.get('chapter'));
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }, [searchParams]);

  const activeChapter = useMemo(() => {
    if (availableChapters.length === 0) {
      return null;
    }
    if (requestedChapter !== null && availableChapters.includes(requestedChapter)) {
      return requestedChapter;
    }
    return availableChapters[0] ?? null;
  }, [availableChapters, requestedChapter]);

  useEffect(() => {
    if (activeChapter === null) {
      return;
    }
    if (String(activeChapter) === searchParams.get('chapter')) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('chapter', String(activeChapter));
    next.delete('anchor');
    setSearchParams(next, { replace: true });
  }, [activeChapter, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeChapter === null) {
      setChapterRecords([]);
      setRecordsError(null);
      setIsChapterLoading(false);
      return;
    }

    const chapterRefs = genesisRefsByChapter.get(activeChapter) ?? [];
    let cancelled = false;
    setIsChapterLoading(true);
    setRecordsError(null);

    void Promise.all(chapterRefs.map((reference) => getParaphrase(reference.ref_key)))
      .then((recordSets) => {
        if (cancelled) {
          return;
        }
        const merged = dedupeParaphraseRecords(recordSets.flat());
        const chapterPrefix = `Genesis/${activeChapter}/`;
        const chapterOnly = merged.filter((record) => record.ref_key.startsWith(chapterPrefix));
        const records =
          chapterOnly.length > 0
            ? chapterOnly.sort(compareParaphraseRecords)
            : fallbackForChapter(activeChapter);
        setChapterRecords(records);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRecordsError(error instanceof Error ? error.message : 'Unknown paraphrase loading error');
          setChapterRecords(fallbackForChapter(activeChapter));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChapterLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChapter, genesisRefsByChapter]);

  const parsedLines = useMemo(
    () => chapterRecords.map((record) => parseAnchoredParaphraseLine(record)),
    [chapterRecords]
  );

  const strictLines = useMemo(
    () => parsedLines.filter((line) => line.style === 'strict'),
    [parsedLines]
  );
  const poeticLines = useMemo(
    () => parsedLines.filter((line) => line.style === 'poetic'),
    [parsedLines]
  );

  const anchorLookup = useMemo(() => {
    const out = new Map<string, AnchorEvidenceSelection>();
    for (const line of parsedLines) {
      for (const anchor of line.anchors) {
        if (!out.has(anchor.anchorId)) {
          out.set(anchor.anchorId, anchor);
        }
      }
    }
    return out;
  }, [parsedLines]);

  const requestedAnchorId = searchParams.get('anchor');
  const selectedAnchor = useMemo(() => {
    if (!requestedAnchorId) {
      return null;
    }
    return anchorLookup.get(requestedAnchorId) ?? null;
  }, [anchorLookup, requestedAnchorId]);

  useEffect(() => {
    if (isChapterLoading || !requestedAnchorId) {
      return;
    }
    if (anchorLookup.has(requestedAnchorId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('anchor');
    setSearchParams(next, { replace: true });
  }, [anchorLookup, isChapterLoading, requestedAnchorId, searchParams, setSearchParams]);

  const onSelectChapter = useCallback(
    (nextChapter: number) => {
      const next = new URLSearchParams(searchParams);
      next.set('chapter', String(nextChapter));
      next.delete('anchor');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const onAnchorClick = useCallback(
    (anchor: AnchorEvidenceSelection) => {
      const next = new URLSearchParams(searchParams);
      if (activeChapter !== null) {
        next.set('chapter', String(activeChapter));
      }
      next.set('anchor', anchor.anchorId);
      setSearchParams(next);
    },
    [activeChapter, searchParams, setSearchParams]
  );

  const onCloseEvidence = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('anchor');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const unanchoredLineCount = useMemo(
    () => parsedLines.filter((line) => line.anchors.length === 0).length,
    [parsedLines]
  );

  if (bundleError) {
    return (
      <p className="status status-error">
        Genesis rephrase failed to load bundle: {bundleError}
      </p>
    );
  }

  if (!catalog || activeChapter === null) {
    return <p className="status">Loading Genesis rephrase…</p>;
  }

  return (
    <div className="genesis-rephrase-page" data-testid="genesis-rephrase-page">
      <header className="genesis-rephrase-header">
        <div>
          <h3>Genesis Rephrase</h3>
          <p className="status">
            Chapter <code>{activeChapter}</code> with inspectable anchor evidence.
          </p>
        </div>
        <label className="genesis-rephrase-chapter-picker">
          <span>Chapter</span>
          <select
            data-testid="genesis-rephrase-chapter-select"
            value={String(activeChapter)}
            onChange={(event) => onSelectChapter(Number(event.target.value))}
          >
            {availableChapters.map((chapter) => (
              <option key={chapter} value={String(chapter)}>
                Genesis {chapter}
              </option>
            ))}
          </select>
        </label>
      </header>

      {isChapterLoading ? <p className="status">Loading chapter paraphrase…</p> : null}
      {recordsError ? <p className="status status-warning">{recordsError}</p> : null}
      {unanchoredLineCount > 0 ? (
        <p className="status status-error">
          Detected {unanchoredLineCount} unanchored line(s). Anchors are required.
        </p>
      ) : (
        <p className="status">All rendered lines are anchored.</p>
      )}

      <div className="genesis-rephrase-layout">
        <section className="genesis-rephrase-column" data-testid="genesis-rephrase-strict">
          <h4>Strict Paraphrase</h4>
          {strictLines.length === 0 ? (
            <p className="status">No strict lines available for this chapter.</p>
          ) : (
            strictLines.map((line) => (
              <ParaphraseLine
                key={`strict:${line.refKey}`}
                line={line}
                onAnchorClick={onAnchorClick}
                selectedAnchorId={selectedAnchor?.anchorId ?? null}
              />
            ))
          )}
        </section>

        <section className="genesis-rephrase-column" data-testid="genesis-rephrase-poetic">
          <h4>Poetic Paraphrase</h4>
          {poeticLines.length === 0 ? (
            <p className="status">No poetic lines available for this chapter.</p>
          ) : (
            poeticLines.map((line) => (
              <ParaphraseLine
                key={`poetic:${line.refKey}`}
                line={line}
                onAnchorClick={onAnchorClick}
                selectedAnchorId={selectedAnchor?.anchorId ?? null}
              />
            ))
          )}
        </section>

        <AnchorEvidencePanel selection={selectedAnchor} onClose={onCloseEvidence} />
      </div>
    </div>
  );
}

interface ParaphraseLineProps {
  line: ParsedParaphraseLine;
  selectedAnchorId: string | null;
  onAnchorClick: (anchor: AnchorEvidenceSelection) => void;
}

function ParaphraseLine({
  line,
  selectedAnchorId,
  onAnchorClick
}: ParaphraseLineProps): JSX.Element {
  const anchorById = useMemo(() => {
    const out = new Map<string, AnchorEvidenceSelection>();
    for (const anchor of line.anchors) {
      out.set(anchor.anchorId, anchor);
    }
    return out;
  }, [line.anchors]);

  return (
    <article className="genesis-rephrase-line" data-testid={`genesis-rephrase-line-${line.style}`}>
      <p className="genesis-rephrase-line-ref">
        <code>{formatRefLabel(line.refKey)}</code>
      </p>
      <p className="genesis-rephrase-line-text">
        {line.segments.map((segment, index) => {
          if (segment.kind === 'text') {
            return (
              <span key={`${line.refKey}:${index}`} className="genesis-rephrase-text-segment">
                {segment.value}
              </span>
            );
          }

          const anchor = anchorById.get(segment.anchorId);
          if (!anchor) {
            return null;
          }
          const isActive = selectedAnchorId === anchor.anchorId;
          return (
            <button
              key={`${line.refKey}:${segment.anchorId}:${index}`}
              type="button"
              className={isActive ? 'genesis-anchor is-active' : 'genesis-anchor'}
              data-testid={`rephrase-anchor-${anchor.anchorId}`}
              onClick={() => onAnchorClick(anchor)}
            >
              {anchor.anchorId}
            </button>
          );
        })}
      </p>
    </article>
  );
}

export function parseAnchoredParaphraseLine(record: RenderOutputRecord): ParsedParaphraseLine {
  const segments: ParaphraseSegment[] = [];
  const anchorIds: string[] = [];
  const text = String(record.text ?? '');

  let cursor = 0;
  for (const match of text.matchAll(ANCHOR_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({
        kind: 'text',
        value: text.slice(cursor, index)
      });
    }

    const anchorId = String(match[1] ?? '').trim();
    if (anchorId.length > 0) {
      segments.push({
        kind: 'anchor',
        anchorId
      });
      anchorIds.push(anchorId);
    }

    cursor = index + String(match[0]).length;
  }

  if (cursor < text.length) {
    segments.push({
      kind: 'text',
      value: text.slice(cursor)
    });
  }

  if (segments.length === 0) {
    segments.push({
      kind: 'text',
      value: text
    });
  }

  if (anchorIds.length === 0) {
    const syntheticId = toSyntheticAnchorId(record.style, record.ref_key);
    segments.push({
      kind: 'anchor',
      anchorId: syntheticId
    });
    anchorIds.push(syntheticId);
  }

  const uniqueAnchorIds = Array.from(new Set(anchorIds));
  const mapping = parseAnchorMapping(record);
  const anchors = uniqueAnchorIds.map((anchorId) => {
    const existing = mapping.get(anchorId);
    if (existing) {
      return existing;
    }
    return fallbackAnchorSelection(anchorId, record.ref_key, record.style);
  });

  return {
    refKey: record.ref_key,
    style: record.style,
    segments,
    anchors
  };
}

export function parseAnchorEvidencePointer(value: unknown): AnchorEvidencePointer | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(POINTER_PATTERN);
    if (!match) {
      return null;
    }

    const kind = match[1] as AnchorEvidencePointer['kind'];
    const refKey = match[2]?.trim() ?? '';
    if (!refKey) {
      return null;
    }

    const startRaw = match[3];
    const endRaw = match[4];
    const [eventStart, eventEnd] = normalizeEventSpan(
      startRaw !== undefined ? Number(startRaw) : null,
      endRaw !== undefined ? Number(endRaw) : null
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

function parseAnchorMapping(record: RenderOutputRecord): Map<string, AnchorEvidenceSelection> {
  const mappingRaw = resolveAnchorMap(record.metadata);
  const out = new Map<string, AnchorEvidenceSelection>();

  if (!mappingRaw) {
    return out;
  }

  for (const [anchorId, rawEntry] of Object.entries(mappingRaw)) {
    if (!anchorId) {
      continue;
    }

    const selection = parseAnchorSelectionEntry(
      anchorId,
      rawEntry,
      record.ref_key,
      record.style
    );
    if (selection) {
      out.set(anchorId, selection);
    }
  }

  return out;
}

function parseAnchorSelectionEntry(
  anchorId: string,
  rawEntry: unknown,
  defaultRefKey: string,
  style: 'strict' | 'poetic'
): AnchorEvidenceSelection | null {
  if (!isRecord(rawEntry)) {
    return null;
  }

  const refKey = readString(rawEntry, ['ref_key', 'refKey']) ?? defaultRefKey;
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

  const dedupedPointers = dedupePointers(
    pointers.length > 0 ? pointers : [{ kind: 'verse', refKey: toVerseRefKey(refKey), eventStart: null, eventEnd: null }]
  );

  return {
    anchorId,
    refKey,
    style,
    pointers: dedupedPointers
  };
}

function parsePointerCollection(raw: unknown): AnchorEvidencePointer[] {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parsePointerCollection(item));
  }

  const parsed = parseAnchorEvidencePointer(raw);
  return parsed ? [parsed] : [];
}

function dedupePointers(pointers: AnchorEvidencePointer[]): AnchorEvidencePointer[] {
  const byKey = new Map<string, AnchorEvidencePointer>();
  for (const pointer of pointers) {
    const key = `${pointer.kind}|${pointer.refKey}|${String(pointer.eventStart)}|${String(pointer.eventEnd)}`;
    if (!byKey.has(key)) {
      byKey.set(key, pointer);
    }
  }
  return Array.from(byKey.values());
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

function fallbackAnchorSelection(
  anchorId: string,
  refKey: string,
  style: 'strict' | 'poetic'
): AnchorEvidenceSelection {
  return {
    anchorId,
    refKey,
    style,
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

function dedupeParaphraseRecords(records: RenderOutputRecord[]): RenderOutputRecord[] {
  const byKey = new Map<string, RenderOutputRecord>();
  for (const record of records) {
    const key = `${record.ref_key}|${record.style}`;
    if (!byKey.has(key)) {
      byKey.set(key, record);
    }
  }
  return Array.from(byKey.values());
}

function compareParaphraseRecords(left: RenderOutputRecord, right: RenderOutputRecord): number {
  const [leftBook, leftChapterRaw, leftVerseRaw] = left.ref_key.split('/');
  const [rightBook, rightChapterRaw, rightVerseRaw] = right.ref_key.split('/');
  if (leftBook !== rightBook) {
    return leftBook.localeCompare(rightBook);
  }

  const leftChapter = Number(leftChapterRaw);
  const rightChapter = Number(rightChapterRaw);
  if (leftChapter !== rightChapter) {
    return leftChapter - rightChapter;
  }

  const leftVerse = Number(leftVerseRaw);
  const rightVerse = Number(rightVerseRaw);
  if (leftVerse !== rightVerse) {
    return leftVerse - rightVerse;
  }

  return left.style.localeCompare(right.style);
}

function fallbackForChapter(chapter: number): RenderOutputRecord[] {
  return FALLBACK_PARAPHRASE.filter((record) => record.ref_key.startsWith(`Genesis/${chapter}/`));
}

function formatRefLabel(refKey: string): string {
  const [book, chapter, verse] = refKey.split('/');
  if (!book || !chapter || !verse) {
    return refKey;
  }
  return `${book} ${chapter}:${verse}`;
}

function toSyntheticAnchorId(style: 'strict' | 'poetic', refKey: string): string {
  return `auto-${style}-${refKey.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`;
}

function toVerseRefKey(refKey: string): string {
  const parts = String(refKey).split('/');
  if (parts.length < 3) {
    return refKey;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
