import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SearchForm,
  type PatternQueryMode,
  type SearchMotifOption
} from '../components/SearchForm';

const OPTIONAL_INDEX_ROOT = '/data/latest/optional/index';
const SKELETON_COUNTS_PATH = `${OPTIONAL_INDEX_ROOT}/skeleton_counts.json`;
const MOTIF_INDEX_PATH = `${OPTIONAL_INDEX_ROOT}/motif_index.json`;
const SKELETON_OCCURRENCE_PATHS = [
  `${OPTIONAL_INDEX_ROOT}/skeleton_to_occurrences.bin`,
  `${OPTIONAL_INDEX_ROOT}/skeleton_to_occurrences.json`
];

const KEY_DELIMITER = '|';
const KEY_ESCAPE = '\\';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 5000;
const BOOK_SLUG_OVERRIDES: Record<string, string> = {
  Genesis: 'Gen',
  Exodus: 'Exod',
  Leviticus: 'Lev',
  Numbers: 'Num',
  Deuteronomy: 'Deut'
};

interface SkeletonOccurrence {
  ref: string;
  word_index: number;
  surface: string;
  ref_key: string;
}

interface PatternMotifEntry {
  name: string;
  description: string;
  type: string;
  pattern_events: string[];
  skeleton_count: number;
  occurrence_count: number;
  matching_skeleton_keys: string[];
}

interface PatternIndexData {
  countsBySkeleton: Record<string, number>;
  occurrencesBySkeleton: Record<string, SkeletonOccurrence[]>;
  eventsBySkeleton: Record<string, string[]>;
  motifsByName: Record<string, PatternMotifEntry>;
  semanticVersions: string[];
}

interface PatternQueryResultRow extends SkeletonOccurrence {
  skeleton_key: string;
  flow: string;
  verse_ref_key: string;
}

interface PatternQueryResult {
  mode: PatternQueryMode;
  value: string;
  matchedSkeletons: number;
  totalOccurrences: number;
  returned: number;
  limit: number;
  rows: PatternQueryResultRow[];
}

interface ParsedWordRef {
  book: string;
  chapter: number;
  verse: number;
  wordIndex: number;
}

interface ParsedVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

let patternIndexPromise: Promise<PatternIndexData> | null = null;

export function PatternSearch(): JSX.Element {
  const [indexData, setIndexData] = useState<PatternIndexData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<PatternQueryMode>('skeleton');
  const [queryValue, setQueryValue] = useState('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const [isSearching, setIsSearching] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<PatternQueryResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadPatternIndexData()
      .then((loaded) => {
        if (!cancelled) {
          setIndexData(loaded);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unknown error');
          setIndexData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const motifOptions = useMemo<SearchMotifOption[]>(() => {
    if (!indexData) {
      return [];
    }
    return Object.values(indexData.motifsByName)
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))
      .map((motif) => ({
        name: motif.name,
        description: motif.description
      }));
  }, [indexData]);

  useEffect(() => {
    if (mode !== 'motif') {
      return;
    }
    if (motifOptions.length === 0) {
      if (queryValue !== '') {
        setQueryValue('');
      }
      return;
    }
    if (!motifOptions.some((motif) => motif.name === queryValue)) {
      setQueryValue(motifOptions[0].name);
    }
  }, [mode, motifOptions, queryValue]);

  const selectedMotifDescription = useMemo(() => {
    if (!indexData || mode !== 'motif' || !queryValue) {
      return null;
    }
    return indexData.motifsByName[queryValue]?.description ?? null;
  }, [indexData, mode, queryValue]);

  const onModeChange = useCallback(
    (nextMode: PatternQueryMode) => {
      setMode(nextMode);
      setQueryError(null);
      setQueryResult(null);

      if (nextMode === 'motif') {
        setQueryValue((current) => {
          if (motifOptions.some((motif) => motif.name === current)) {
            return current;
          }
          return motifOptions[0]?.name ?? '';
        });
        return;
      }

      setQueryValue('');
    },
    [motifOptions]
  );

  const onSubmit = useCallback(() => {
    if (!indexData) {
      return;
    }

    const normalizedLimit = clampLimit(limit);
    if (normalizedLimit !== limit) {
      setLimit(normalizedLimit);
    }

    const trimmedValue = queryValue.trim();
    if (mode === 'motif') {
      if (!trimmedValue || !indexData.motifsByName[trimmedValue]) {
        setQueryError(`Unknown motif: ${trimmedValue || '(empty)'}`);
        setQueryResult(null);
        return;
      }
    } else if (canonicalEventsFromInput(trimmedValue).length === 0) {
      setQueryError('Enter at least one event for skeleton/subsequence queries.');
      setQueryResult(null);
      return;
    }

    setIsSearching(true);
    try {
      const result = runPatternQuery(indexData, {
        mode,
        value: trimmedValue,
        limit: normalizedLimit
      });
      setQueryResult(result);
      setQueryError(null);
    } catch (error: unknown) {
      setQueryError(error instanceof Error ? error.message : 'Unknown query error');
      setQueryResult(null);
    } finally {
      setIsSearching(false);
    }
  }, [indexData, limit, mode, queryValue]);

  if (loadError) {
    return (
      <p className="status status-error">
        Pattern search failed to load index artifacts: {loadError}
      </p>
    );
  }

  if (!indexData) {
    return <p className="status">Loading pattern indexes...</p>;
  }

  return (
    <div className="pattern-search" data-testid="pattern-search-page">
      <SearchForm
        mode={mode}
        value={queryValue}
        limit={limit}
        motifOptions={motifOptions}
        isSearching={isSearching}
        onModeChange={onModeChange}
        onValueChange={setQueryValue}
        onLimitChange={setLimit}
        onSubmit={onSubmit}
      />

      <p className="status pattern-search-meta">
        Loaded {Object.keys(indexData.countsBySkeleton).length} skeleton keys and{' '}
        {Object.keys(indexData.motifsByName).length} motifs (semantics:{' '}
        {indexData.semanticVersions.join(', ') || 'unknown'}).
      </p>

      {selectedMotifDescription ? (
        <p className="status pattern-search-meta">{selectedMotifDescription}</p>
      ) : null}
      {queryError ? <p className="status status-error">{queryError}</p> : null}

      {queryResult ? (
        <section className="pattern-results" data-testid="pattern-results">
          <p data-testid="pattern-summary" className="pattern-search-summary">
            {queryResult.mode} query matched {queryResult.matchedSkeletons} skeletons and{' '}
            {queryResult.totalOccurrences} occurrences; showing {queryResult.returned} (limit{' '}
            {queryResult.limit}).
          </p>

          {queryResult.rows.length === 0 ? (
            <p className="status">No occurrences matched this query.</p>
          ) : (
            <ol className="pattern-result-list" data-testid="pattern-result-list">
              {queryResult.rows.map((row, index) => {
                const href = buildVerseTargetHref(row.verse_ref_key, row.word_index);
                return (
                  <li key={`${row.ref_key}:${row.skeleton_key}:${index}`} className="pattern-result-item">
                    <Link
                      data-testid={`pattern-result-link-${index}`}
                      data-target-ref={row.verse_ref_key}
                      data-target-word={String(row.word_index)}
                      className="pattern-result-link"
                      to={href}
                    >
                      {row.ref} word {row.word_index}
                    </Link>
                    <p className="pattern-result-word">
                      <strong>{row.surface || '(empty)'}</strong> <code>{row.ref_key}</code>
                    </p>
                    <p className="status pattern-result-flow">{shortFlow(row.flow)}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : (
        <p className="status">Run a query to view matching occurrences.</p>
      )}
    </div>
  );
}

interface RunPatternQueryInput {
  mode: PatternQueryMode;
  value: string;
  limit: number;
}

function runPatternQuery(indexData: PatternIndexData, input: RunPatternQueryInput): PatternQueryResult {
  const allSkeletonKeys = Object.keys(indexData.occurrencesBySkeleton).sort(compareSkeletonKeys);
  const matchingSkeletonKeys: string[] = [];

  if (input.mode === 'skeleton') {
    const queryEvents = canonicalEventsFromInput(input.value);
    const queryKey = skeletonKeyFromEvents(queryEvents);
    if (indexData.occurrencesBySkeleton[queryKey]) {
      matchingSkeletonKeys.push(queryKey);
    }
  } else if (input.mode === 'subsequence') {
    const patternEvents = canonicalEventsFromInput(input.value);
    for (const skeletonKey of allSkeletonKeys) {
      const events = resolveSkeletonEvents(skeletonKey, indexData.eventsBySkeleton);
      if (matchesSubsequence(events, patternEvents)) {
        matchingSkeletonKeys.push(skeletonKey);
      }
    }
  } else if (input.mode === 'motif') {
    const motif = indexData.motifsByName[input.value];
    if (!motif) {
      throw new Error(`Unknown motif '${input.value}'`);
    }
    for (const skeletonKey of motif.matching_skeleton_keys) {
      if (indexData.occurrencesBySkeleton[skeletonKey]) {
        matchingSkeletonKeys.push(skeletonKey);
      }
    }
  }

  const dedupedSkeletonKeys = Array.from(new Set(matchingSkeletonKeys));
  const sortedSkeletonKeys = sortSkeletonsByCountDesc(dedupedSkeletonKeys, indexData.countsBySkeleton);
  const totalOccurrences = sortedSkeletonKeys.reduce(
    (sum, key) => sum + Number(indexData.countsBySkeleton[key] ?? 0),
    0
  );

  const rows: PatternQueryResultRow[] = [];
  for (const skeletonKey of sortedSkeletonKeys) {
    const occurrences = indexData.occurrencesBySkeleton[skeletonKey] ?? [];
    const flow = resolveSkeletonEvents(skeletonKey, indexData.eventsBySkeleton).join(' -> ');
    for (const occurrence of occurrences) {
      const verseRefKey = toVerseRefKey(occurrence.ref_key);
      if (!verseRefKey) {
        continue;
      }
      rows.push({
        ...occurrence,
        skeleton_key: skeletonKey,
        flow,
        verse_ref_key: verseRefKey
      });
      if (rows.length >= input.limit) {
        return {
          mode: input.mode,
          value: input.value,
          matchedSkeletons: dedupedSkeletonKeys.length,
          totalOccurrences,
          returned: rows.length,
          limit: input.limit,
          rows
        };
      }
    }
  }

  return {
    mode: input.mode,
    value: input.value,
    matchedSkeletons: dedupedSkeletonKeys.length,
    totalOccurrences,
    returned: rows.length,
    limit: input.limit,
    rows
  };
}

function sortSkeletonsByCountDesc(
  keys: string[],
  countsBySkeleton: Record<string, number>
): string[] {
  return keys.slice().sort((left, right) => {
    const countDelta = (countsBySkeleton[right] ?? 0) - (countsBySkeleton[left] ?? 0);
    if (countDelta !== 0) {
      return countDelta;
    }
    return compareSkeletonKeys(left, right);
  });
}

function compareSkeletonKeys(left: string, right: string): number {
  return String(left).localeCompare(String(right), 'en', { numeric: true });
}

function canonicalEventsFromInput(raw: string): string[] {
  return splitEscaped(raw)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitEscaped(
  input: string,
  delimiter = KEY_DELIMITER,
  escapeChar = KEY_ESCAPE
): string[] {
  const out: string[] = [];
  let current = '';
  let escaping = false;

  for (const char of String(input ?? '')) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === escapeChar) {
      escaping = true;
      continue;
    }
    if (char === delimiter) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (escaping) {
    current += escapeChar;
  }
  out.push(current);
  return out;
}

function escapeSegment(segment: string, delimiter = KEY_DELIMITER, escapeChar = KEY_ESCAPE): string {
  let out = '';
  for (const char of String(segment ?? '')) {
    if (char === escapeChar || char === delimiter) {
      out += escapeChar;
    }
    out += char;
  }
  return out;
}

function skeletonKeyFromEvents(events: string[]): string {
  return events.map((event) => escapeSegment(event)).join(KEY_DELIMITER);
}

function eventsFromSkeletonKey(key: string): string[] {
  return splitEscaped(key)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveSkeletonEvents(
  skeletonKey: string,
  eventsBySkeleton: Record<string, string[]>
): string[] {
  return eventsBySkeleton[skeletonKey] ?? eventsFromSkeletonKey(skeletonKey);
}

function createWildcardRegex(pattern: string): RegExp {
  const escaped = String(pattern)
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'u');
}

function eventMatchesPattern(eventName: string, pattern: string): boolean {
  const eventValue = String(eventName ?? '')
    .trim()
    .toUpperCase();
  const patternValue = String(pattern ?? '')
    .trim()
    .toUpperCase();
  if (!eventValue || !patternValue) {
    return false;
  }

  if (patternValue.includes('*')) {
    return createWildcardRegex(patternValue).test(eventValue);
  }
  if (eventValue === patternValue) {
    return true;
  }
  return eventValue.endsWith(`.${patternValue}`);
}

function matchesSubsequence(events: string[], patternEvents: string[]): boolean {
  if (patternEvents.length === 0) {
    return true;
  }
  let position = 0;
  for (const patternEvent of patternEvents) {
    let found = false;
    for (; position < events.length; position += 1) {
      if (eventMatchesPattern(events[position], patternEvent)) {
        found = true;
        position += 1;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

function shortFlow(flow: string, maxLength = 128): string {
  const value = flow.trim();
  if (value.length <= maxLength) {
    return value || '(empty flow)';
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function parseWordRefKey(refKey: string): ParsedWordRef | null {
  const parts = String(refKey ?? '').split('/');
  if (parts.length < 4) {
    return null;
  }
  const wordRaw = parts.pop();
  const verseRaw = parts.pop();
  const chapterRaw = parts.pop();
  const book = parts.join('/');

  const wordIndex = Number(wordRaw);
  const verse = Number(verseRaw);
  const chapter = Number(chapterRaw);
  if (
    !book ||
    !Number.isInteger(wordIndex) ||
    wordIndex < 1 ||
    !Number.isInteger(verse) ||
    verse < 1 ||
    !Number.isInteger(chapter) ||
    chapter < 1
  ) {
    return null;
  }

  return {
    book,
    chapter,
    verse,
    wordIndex
  };
}

function toVerseRefKey(wordRefKey: string): string | null {
  const parsed = parseWordRefKey(wordRefKey);
  if (!parsed) {
    return null;
  }
  return `${parsed.book}/${parsed.chapter}/${parsed.verse}`;
}

function parseVerseRefKey(refKey: string): ParsedVerseRef | null {
  const parts = String(refKey ?? '').split('/');
  if (parts.length < 3) {
    return null;
  }
  const verseRaw = parts.pop();
  const chapterRaw = parts.pop();
  const book = parts.join('/');

  const verse = Number(verseRaw);
  const chapter = Number(chapterRaw);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    return null;
  }
  return {
    book,
    chapter,
    verse
  };
}

function toBookRouteSlug(book: string): string {
  const override = BOOK_SLUG_OVERRIDES[book];
  if (override) {
    return override;
  }
  const condensed = book.replace(/[^a-z0-9]+/gi, '');
  if (condensed.length === 0) {
    return 'Book';
  }
  return condensed.length <= 4 ? condensed : condensed.slice(0, 4);
}

function buildVerseTargetHref(verseRefKey: string, wordIndex: number): string {
  const parsed = parseVerseRefKey(verseRefKey);
  if (!parsed) {
    return '/verse';
  }
  const slug = `${toBookRouteSlug(parsed.book)}-${parsed.chapter}-${parsed.verse}`;
  const params = new URLSearchParams();
  params.set('ref', verseRefKey);
  params.set('word', String(wordIndex));
  return `/verse/${slug}?${params.toString()}`;
}

async function loadPatternIndexData(fetcher: typeof fetch = fetch): Promise<PatternIndexData> {
  if (!patternIndexPromise) {
    patternIndexPromise = (async () => {
      const [countsRaw, motifRaw, occurrencesRaw] = await Promise.all([
        fetchJsonArtifact(SKELETON_COUNTS_PATH, fetcher),
        fetchJsonArtifact(MOTIF_INDEX_PATH, fetcher),
        fetchJsonArtifactWithFallback(SKELETON_OCCURRENCE_PATHS, fetcher)
      ]);

      const countsPayload = parseCountsPayload(countsRaw);
      const motifPayload = parseMotifPayload(motifRaw);
      const occurrencesPayload = parseOccurrencesPayload(occurrencesRaw);

      return {
        countsBySkeleton: countsPayload.countsBySkeleton,
        occurrencesBySkeleton: occurrencesPayload.occurrencesBySkeleton,
        eventsBySkeleton: occurrencesPayload.eventsBySkeleton,
        motifsByName: motifPayload.motifsByName,
        semanticVersions: countsPayload.semanticVersions
      };
    })();
  }
  return patternIndexPromise;
}

async function fetchJsonArtifact(pathName: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(pathName);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pathName} (${response.status})`);
  }
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Invalid JSON at ${pathName} (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

async function fetchJsonArtifactWithFallback(
  pathCandidates: string[],
  fetcher: typeof fetch
): Promise<unknown> {
  const errors: string[] = [];
  for (const candidate of pathCandidates) {
    try {
      return await fetchJsonArtifact(candidate, fetcher);
    } catch (error: unknown) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Failed to load postings artifact. ${errors.join(' | ')}`);
}

function parseCountsPayload(raw: unknown): {
  countsBySkeleton: Record<string, number>;
  semanticVersions: string[];
} {
  if (!isRecord(raw) || !isRecord(raw.skeleton_counts)) {
    throw new Error('Invalid skeleton_counts payload (missing skeleton_counts).');
  }

  const countsBySkeleton: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.skeleton_counts)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      countsBySkeleton[key] = Math.floor(numeric);
    }
  }

  const semanticVersions = Array.isArray(raw.semantic_versions)
    ? raw.semantic_versions.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return {
    countsBySkeleton,
    semanticVersions
  };
}

function parseOccurrencesPayload(raw: unknown): {
  occurrencesBySkeleton: Record<string, SkeletonOccurrence[]>;
  eventsBySkeleton: Record<string, string[]>;
} {
  if (!isRecord(raw) || !isRecord(raw.skeleton_to_occurrences)) {
    throw new Error('Invalid skeleton_to_occurrences payload (missing postings map).');
  }

  const occurrencesBySkeleton: Record<string, SkeletonOccurrence[]> = {};
  for (const [skeletonKey, listRaw] of Object.entries(raw.skeleton_to_occurrences)) {
    if (!Array.isArray(listRaw)) {
      continue;
    }
    const parsedRows: SkeletonOccurrence[] = [];
    for (const rowRaw of listRaw) {
      const parsed = parseOccurrence(rowRaw);
      if (parsed) {
        parsedRows.push(parsed);
      }
    }
    occurrencesBySkeleton[skeletonKey] = parsedRows;
  }

  const eventsBySkeleton: Record<string, string[]> = {};
  if (isRecord(raw.skeleton_events)) {
    for (const [skeletonKey, eventsRaw] of Object.entries(raw.skeleton_events)) {
      if (!Array.isArray(eventsRaw)) {
        continue;
      }
      eventsBySkeleton[skeletonKey] = eventsRaw
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return {
    occurrencesBySkeleton,
    eventsBySkeleton
  };
}

function parseOccurrence(raw: unknown): SkeletonOccurrence | null {
  if (!isRecord(raw)) {
    return null;
  }
  const refKey = typeof raw.ref_key === 'string' ? raw.ref_key : '';
  if (!refKey) {
    return null;
  }

  const parsedRef = parseWordRefKey(refKey);
  const numericWordIndex = Number(raw.word_index);
  const wordIndex =
    Number.isInteger(numericWordIndex) && numericWordIndex > 0
      ? numericWordIndex
      : parsedRef?.wordIndex ?? null;
  if (!wordIndex) {
    return null;
  }

  const ref =
    typeof raw.ref === 'string' && raw.ref.trim().length > 0
      ? raw.ref
      : parsedRef
      ? `${parsedRef.book} ${parsedRef.chapter}:${parsedRef.verse}`
      : 'unknown';

  const surface = typeof raw.surface === 'string' ? raw.surface : '';
  return {
    ref,
    word_index: wordIndex,
    surface,
    ref_key: refKey
  };
}

function parseMotifPayload(raw: unknown): { motifsByName: Record<string, PatternMotifEntry> } {
  if (!isRecord(raw) || !isRecord(raw.motifs)) {
    throw new Error('Invalid motif_index payload (missing motifs object).');
  }

  const motifsByName: Record<string, PatternMotifEntry> = {};
  for (const [motifName, motifRaw] of Object.entries(raw.motifs)) {
    if (!isRecord(motifRaw)) {
      continue;
    }

    const name = typeof motifRaw.name === 'string' && motifRaw.name ? motifRaw.name : motifName;
    const description = typeof motifRaw.description === 'string' ? motifRaw.description : '';
    const type = typeof motifRaw.type === 'string' ? motifRaw.type : '';
    const patternEvents = Array.isArray(motifRaw.pattern_events)
      ? motifRaw.pattern_events.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const matchingSkeletonKeys = Array.isArray(motifRaw.matching_skeleton_keys)
      ? motifRaw.matching_skeleton_keys.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const skeletonCount = Number(motifRaw.skeleton_count);
    const occurrenceCount = Number(motifRaw.occurrence_count);

    motifsByName[name] = {
      name,
      description,
      type,
      pattern_events: patternEvents,
      skeleton_count: Number.isFinite(skeletonCount) ? skeletonCount : matchingSkeletonKeys.length,
      occurrence_count: Number.isFinite(occurrenceCount) ? occurrenceCount : 0,
      matching_skeleton_keys: matchingSkeletonKeys
    };
  }

  return {
    motifsByName
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
