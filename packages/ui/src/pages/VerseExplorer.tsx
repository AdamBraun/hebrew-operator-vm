import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PhraseTree } from '../components/PhraseTree';
import { RefPicker } from '../components/RefPicker';
import { VerseText } from '../components/VerseText';
import { derivePhraseSelection } from '../components/phraseTreeSelection';
import {
  getReferenceCatalog,
  getVerse,
  loadBundle
} from '../lib/data/api';
import type {
  WordTraceRecord,
  WordPhraseRoleRecord
} from '../lib/contracts';
import type {
  ReferenceCatalog,
  VerseBundle,
  VerseReferenceEntry
} from '../lib/data/loader';

const BOOK_SLUG_OVERRIDES: Record<string, string> = {
  Genesis: 'Gen',
  Exodus: 'Exod',
  Leviticus: 'Lev',
  Numbers: 'Num',
  Deuteronomy: 'Deut'
};

export function VerseExplorer(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { refSlug } = useParams<{ refSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [verseBundle, setVerseBundle] = useState<VerseBundle | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [isVerseLoading, setIsVerseLoading] = useState(false);
  const [refInputValue, setRefInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadBundle('latest')
      .then(() => {
        const nextCatalog = getReferenceCatalog();
        if (nextCatalog.refs.length === 0) {
          throw new Error('No references were found in /data/latest/refs/index.json.');
        }
        if (!cancelled) {
          setCatalog(nextCatalog);
          setBundleError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBundleError(error instanceof Error ? error.message : 'Unknown error');
          setCatalog(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const references = catalog?.refs ?? [];

  const referenceByKey = useMemo(() => {
    const out = new Map<string, VerseReferenceEntry>();
    for (const reference of references) {
      out.set(reference.ref_key, reference);
    }
    return out;
  }, [references]);

  const referenceByAddress = useMemo(() => {
    const out = new Map<string, string>();
    for (const reference of references) {
      out.set(toAddressKey(reference.ref.book, reference.ref.chapter, reference.ref.verse), reference.ref_key);
    }
    return out;
  }, [references]);

  const books = useMemo(() => {
    const availableBooks = new Set(references.map((reference) => reference.ref.book));
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const book of catalog?.navigation.books ?? []) {
      if (availableBooks.has(book.book) && !seen.has(book.book)) {
        ordered.push(book.book);
        seen.add(book.book);
      }
    }

    for (const reference of references) {
      if (!seen.has(reference.ref.book)) {
        ordered.push(reference.ref.book);
        seen.add(reference.ref.book);
      }
    }

    return ordered;
  }, [catalog, references]);

  const chapterVerseIndex = useMemo(() => {
    const mutable = new Map<string, Map<number, Set<number>>>();

    for (const reference of references) {
      const bookMap = mutable.get(reference.ref.book) ?? new Map<number, Set<number>>();
      if (!mutable.has(reference.ref.book)) {
        mutable.set(reference.ref.book, bookMap);
      }
      const chapterSet = bookMap.get(reference.ref.chapter) ?? new Set<number>();
      if (!bookMap.has(reference.ref.chapter)) {
        bookMap.set(reference.ref.chapter, chapterSet);
      }
      chapterSet.add(reference.ref.verse);
    }

    const finalized = new Map<string, Map<number, number[]>>();
    for (const [book, chapterMap] of mutable.entries()) {
      const nextChapterMap = new Map<number, number[]>();
      const sortedChapters = Array.from(chapterMap.keys()).sort((left, right) => left - right);
      for (const chapter of sortedChapters) {
        const verseSet = chapterMap.get(chapter);
        if (!verseSet) {
          continue;
        }
        nextChapterMap.set(
          chapter,
          Array.from(verseSet.values()).sort((left, right) => left - right)
        );
      }
      finalized.set(book, nextChapterMap);
    }

    return finalized;
  }, [references]);

  const aliasLookup = useMemo(() => buildBookAliasLookup(books), [books]);

  const defaultRefKey = useMemo(() => {
    const genesisRef = references.find(
      (reference) =>
        reference.ref.book === 'Genesis' &&
        reference.ref.chapter === 1 &&
        reference.ref.verse === 1
    );
    return genesisRef?.ref_key ?? references[0]?.ref_key ?? null;
  }, [references]);

  const requestedRefKey = useMemo(
    () => parseRouteRefSlug(refSlug, aliasLookup),
    [refSlug, aliasLookup]
  );

  const activeRefKey = useMemo(() => {
    if (requestedRefKey && referenceByKey.has(requestedRefKey)) {
      return requestedRefKey;
    }
    return defaultRefKey;
  }, [requestedRefKey, referenceByKey, defaultRefKey]);

  const activeReference = activeRefKey ? referenceByKey.get(activeRefKey) ?? null : null;

  const toRoutePath = useCallback((refKey: string): string | null => {
    const reference = referenceByKey.get(refKey);
    if (!reference) {
      return null;
    }
    const bookSlug = toBookRouteSlug(reference.ref.book);
    return `/verse/${bookSlug}-${reference.ref.chapter}-${reference.ref.verse}`;
  }, [referenceByKey]);

  useEffect(() => {
    if (!activeRefKey) {
      return;
    }

    const expectedPath = toRoutePath(activeRefKey);
    if (!expectedPath) {
      return;
    }

    if (location.pathname !== expectedPath) {
      navigate(expectedPath, {
        replace: true
      });
    }
  }, [activeRefKey, location.pathname, navigate, toRoutePath]);

  const navigateToRef = useCallback((refKey: string) => {
    const nextPath = toRoutePath(refKey);
    if (!nextPath) {
      return;
    }
    setInputError(null);
    navigate(nextPath);
  }, [navigate, toRoutePath]);

  useEffect(() => {
    if (activeRefKey) {
      setRefInputValue(activeRefKey);
      setInputError(null);
    }
  }, [activeRefKey]);

  const activeRefIndex = useMemo(() => {
    if (!activeRefKey) {
      return -1;
    }
    return references.findIndex((reference) => reference.ref_key === activeRefKey);
  }, [references, activeRefKey]);

  const jumpRelative = useCallback((delta: number) => {
    if (activeRefIndex < 0) {
      return;
    }
    const nextIndex = activeRefIndex + delta;
    if (nextIndex < 0 || nextIndex >= references.length) {
      return;
    }
    navigateToRef(references[nextIndex].ref_key);
  }, [activeRefIndex, navigateToRef, references]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'j') {
        event.preventDefault();
        jumpRelative(1);
      } else if (key === 'k') {
        event.preventDefault();
        jumpRelative(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [jumpRelative]);

  useEffect(() => {
    if (!activeRefKey) {
      setVerseBundle(null);
      setVerseError(null);
      setSelectedNodeId(null);
      return;
    }

    let cancelled = false;
    setIsVerseLoading(true);
    setVerseError(null);

    void getVerse(activeRefKey)
      .then((nextVerse) => {
        if (!cancelled) {
          setVerseBundle(nextVerse);
          if (!nextVerse) {
            setVerseError(`No verse payload found for ${activeRefKey}.`);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setVerseBundle(null);
          setVerseError(error instanceof Error ? error.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsVerseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeRefKey]);

  useEffect(() => {
    if (!activeRefKey) {
      return;
    }
    const currentRef = searchParams.get('ref');
    if (currentRef === activeRefKey) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('ref', activeRefKey);
    setSearchParams(next, { replace: true });
  }, [activeRefKey, searchParams, setSearchParams]);

  const selectedWordIndex = useMemo(() => {
    const parsed = Number(searchParams.get('word'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [searchParams]);

  const selectedBook = activeReference?.ref.book ?? books[0] ?? '';
  const chapters = useMemo(() => {
    const chapterMap = chapterVerseIndex.get(selectedBook);
    if (!chapterMap) {
      return [];
    }
    return Array.from(chapterMap.keys());
  }, [chapterVerseIndex, selectedBook]);
  const selectedChapter = activeReference?.ref.chapter ?? chapters[0] ?? 1;
  const verses = useMemo(() => {
    const chapterMap = chapterVerseIndex.get(selectedBook);
    if (!chapterMap) {
      return [];
    }
    return chapterMap.get(selectedChapter) ?? [];
  }, [chapterVerseIndex, selectedBook, selectedChapter]);
  const selectedVerse = activeReference?.ref.verse ?? verses[0] ?? 1;

  const onBookChange = useCallback((book: string) => {
    const chapterMap = chapterVerseIndex.get(book);
    if (!chapterMap) {
      return;
    }
    const nextChapter = Array.from(chapterMap.keys())[0];
    const nextVerse = chapterMap.get(nextChapter)?.[0];
    if (nextChapter === undefined || nextVerse === undefined) {
      return;
    }
    const nextRefKey = referenceByAddress.get(toAddressKey(book, nextChapter, nextVerse));
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [chapterVerseIndex, navigateToRef, referenceByAddress]);

  const onChapterChange = useCallback((chapter: number) => {
    const chapterMap = chapterVerseIndex.get(selectedBook);
    if (!chapterMap) {
      return;
    }
    const nextVerse = chapterMap.get(chapter)?.[0];
    if (nextVerse === undefined) {
      return;
    }
    const nextRefKey = referenceByAddress.get(toAddressKey(selectedBook, chapter, nextVerse));
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [chapterVerseIndex, navigateToRef, referenceByAddress, selectedBook]);

  const onVerseChange = useCallback((verse: number) => {
    const nextRefKey = referenceByAddress.get(
      toAddressKey(selectedBook, selectedChapter, verse)
    );
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [navigateToRef, referenceByAddress, selectedBook, selectedChapter]);

  const onSubmitRefInput = useCallback(() => {
    const nextRefKey = parseReferenceInput(refInputValue, aliasLookup);
    if (!nextRefKey || !referenceByKey.has(nextRefKey)) {
      setInputError(`Reference not found: ${refInputValue.trim()}`);
      return;
    }
    navigateToRef(nextRefKey);
  }, [aliasLookup, navigateToRef, refInputValue, referenceByKey]);

  const verseText = useMemo(() => {
    if (!verseBundle) {
      return [];
    }
    const words = verseBundle.phrase_tree?.words ?? [];
    if (words.length > 0) {
      return words;
    }
    if (verseBundle.word_traces.length > 0) {
      return verseBundle.word_traces.map((trace) => trace.surface);
    }
    return [];
  }, [verseBundle]);

  const phraseTree = verseBundle?.phrase_tree?.tree ?? null;
  const wordPhraseRoles = verseBundle?.word_phrase_roles ?? [];
  const wordTraces = verseBundle?.word_traces ?? [];
  const alignedWordTraces = useMemo(
    () => alignWordTracesToDisplayWords(verseText, wordPhraseRoles, wordTraces),
    [verseText, wordPhraseRoles, wordTraces]
  );

  const phraseSelection = useMemo(() => {
    return derivePhraseSelection({
      tree: phraseTree,
      wordCount: verseText.length,
      wordPhraseRoles,
      selectedNodeId,
      selectedWordIndex
    });
  }, [phraseTree, verseText.length, wordPhraseRoles, selectedNodeId, selectedWordIndex]);

  const highlightedWordIndexSet = useMemo(
    () => new Set(phraseSelection.highlightedWordIndices),
    [phraseSelection.highlightedWordIndices]
  );
  const highlightedNodeIdSet = useMemo(
    () => new Set(phraseSelection.highlightedNodeIds),
    [phraseSelection.highlightedNodeIds]
  );

  const onWordClick = useCallback((wordIndex: number) => {
    setSelectedNodeId(null);
    const next = new URLSearchParams(searchParams);
    if (activeRefKey) {
      next.set('ref', activeRefKey);
    }
    if (selectedWordIndex === wordIndex) {
      next.delete('word');
    } else {
      next.set('word', String(wordIndex));
    }
    setSearchParams(next);
  }, [activeRefKey, searchParams, selectedWordIndex, setSearchParams]);

  const onNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
    const next = new URLSearchParams(searchParams);
    next.delete('word');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (bundleError) {
    return (
      <div>
        <p className="status status-error">Verse explorer failed to load: {bundleError}</p>
        <p className="status">
          Expected bundle files at <code>/public/data/latest</code>.
        </p>
      </div>
    );
  }

  if (!catalog || !activeReference) {
    return <p className="status">Loading reference index...</p>;
  }

  const canPrev = activeRefIndex > 0;
  const canNext = activeRefIndex >= 0 && activeRefIndex < references.length - 1;

  return (
    <div className="verse-explorer">
      <RefPicker
        books={books}
        chapters={chapters}
        verses={verses}
        selectedBook={selectedBook}
        selectedChapter={selectedChapter}
        selectedVerse={selectedVerse}
        refInputValue={refInputValue}
        inputError={inputError}
        canPrev={canPrev}
        canNext={canNext}
        onBookChange={onBookChange}
        onChapterChange={onChapterChange}
        onVerseChange={onVerseChange}
        onRefInputChange={setRefInputValue}
        onRefInputSubmit={onSubmitRefInput}
        onPrev={() => jumpRelative(-1)}
        onNext={() => jumpRelative(1)}
        searchInputRef={searchInputRef}
      />

      <div className="verse-meta">
        <p data-testid="active-ref" className="verse-reference">
          {activeReference.ref.book} {activeReference.ref.chapter}:{activeReference.ref.verse}
        </p>
        <p className="status">Loaded {references.length} references from bundle index.</p>
      </div>

      <div className="verse-content-grid">
        <div className="verse-content-main">
          <section className="verse-panel">
            <h3>Verse Text</h3>
            {isVerseLoading ? (
              <p className="status">Loading verse text...</p>
            ) : verseError ? (
              <p className="status status-error">{verseError}</p>
            ) : verseText.length === 0 ? (
              <p className="status">No verse text available for this reference.</p>
            ) : (
              <VerseText
                words={verseText}
                wordPhraseRoles={wordPhraseRoles}
                wordTraces={alignedWordTraces}
                highlightedWordIndices={highlightedWordIndexSet}
                activeWordIndex={selectedWordIndex}
                onWordClick={onWordClick}
              />
            )}
          </section>

          <section className="verse-panel">
            <h3>Phrase Tree</h3>
            {isVerseLoading ? (
              <p className="status">Loading phrase tree...</p>
            ) : verseError ? (
              <p className="status status-error">{verseError}</p>
            ) : phraseTree ? (
              <PhraseTree
                tree={phraseTree}
                highlightedNodeIds={highlightedNodeIdSet}
                activeNodeId={selectedNodeId}
                onNodeClick={onNodeClick}
              />
            ) : (
              <p className="status">No phrase tree available for this reference.</p>
            )}
          </section>
        </div>

        <section className="verse-panel verse-panel-inspector">
          <h3>Inspect Selected Word</h3>
          {selectedWordIndex ? (
            <p className="status">
              Selected word <code>#{selectedWordIndex}</code> in <code>{activeRefKey}</code>.
              Switch to the Word or Trace tab to inspect it.
            </p>
          ) : (
            <p className="status">Select a word to sync Word and Trace panes.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function normalizeBookToken(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '').toLowerCase();
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

function buildBookAliasLookup(books: string[]): Map<string, string> {
  const aliasLookup = new Map<string, string>();

  for (const book of books) {
    const normalizedBook = normalizeBookToken(book);
    if (normalizedBook) {
      aliasLookup.set(normalizedBook, book);
    }

    const slug = normalizeBookToken(toBookRouteSlug(book));
    if (slug) {
      aliasLookup.set(slug, book);
    }

    const threeLetter = normalizeBookToken(book.slice(0, 3));
    if (threeLetter) {
      aliasLookup.set(threeLetter, book);
    }
  }

  return aliasLookup;
}

function toAddressKey(book: string, chapter: number, verse: number): string {
  return `${book}|${chapter}|${verse}`;
}

export function alignWordTracesToDisplayWords(
  displayWords: string[],
  roles: WordPhraseRoleRecord[],
  traces: WordTraceRecord[]
): WordTraceRecord[] {
  if (displayWords.length === 0 || traces.length === 0) {
    return traces;
  }

  const roleByWordIndex = new Map<number, WordPhraseRoleRecord>();
  for (const role of roles) {
    roleByWordIndex.set(role.word_index, role);
  }

  const aligned: WordTraceRecord[] = [];
  let traceCursor = 0;

  for (let index = 0; index < displayWords.length; index += 1) {
    const wordIndex = index + 1;
    const roleSurface = roleByWordIndex.get(wordIndex)?.surface;
    const target = normalizeForAlignment(roleSurface ?? displayWords[index]);
    if (!target) {
      aligned.push(traces[traceCursor] ?? traces[index] ?? traces[traces.length - 1]);
      traceCursor = Math.min(traceCursor + 1, traces.length);
      continue;
    }

    const fromCursor = matchTraceWindow(traces, traceCursor, target);
    if (fromCursor) {
      aligned.push(fromCursor.match);
      traceCursor = fromCursor.nextCursor;
      continue;
    }

    const fromAnywhere = matchTraceWindow(traces, 0, target);
    if (fromAnywhere) {
      aligned.push(fromAnywhere.match);
      continue;
    }

    aligned.push(traces[traceCursor] ?? traces[index] ?? traces[traces.length - 1]);
    traceCursor = Math.min(traceCursor + 1, traces.length);
  }

  return aligned;
}

function matchTraceWindow(
  traces: WordTraceRecord[],
  startIndex: number,
  normalizedTarget: string
): { match: WordTraceRecord; nextCursor: number } | null {
  if (startIndex >= traces.length) {
    return null;
  }

  for (let windowStart = startIndex; windowStart < traces.length; windowStart += 1) {
    let combined = '';
    let candidate: WordTraceRecord | null = null;

    for (
      let windowEnd = windowStart;
      windowEnd < traces.length && windowEnd <= windowStart + 3;
      windowEnd += 1
    ) {
      const trace = traces[windowEnd];
      combined += normalizeForAlignment(trace.surface);

      if (combined === normalizedTarget) {
        candidate = chooseTraceCandidate(candidate, trace);
        return {
          match: candidate,
          nextCursor: windowEnd + 1
        };
      }

      if (normalizedTarget.startsWith(combined)) {
        candidate = chooseTraceCandidate(candidate, trace);
        continue;
      }

      break;
    }
  }

  return null;
}

function chooseTraceCandidate(
  current: WordTraceRecord | null,
  incoming: WordTraceRecord
): WordTraceRecord {
  if (!current) {
    return incoming;
  }
  const currentScore = traceSignalScore(current);
  const incomingScore = traceSignalScore(incoming);
  return incomingScore >= currentScore ? incoming : current;
}

function traceSignalScore(trace: WordTraceRecord): number {
  const hasFlow = trace.flow ? 1 : 0;
  const skeletonLength = trace.skeleton?.length ?? 0;
  const eventsLength = trace.events.length;
  return hasFlow * 1000 + skeletonLength * 10 + eventsLength;
}

function normalizeForAlignment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0591-\u05C7]/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

function parseRouteRefSlug(
  refSlug: string | undefined,
  aliasLookup: Map<string, string>
): string | null {
  if (!refSlug) {
    return null;
  }
  const parts = refSlug.split('-').filter((part) => part.length > 0);
  if (parts.length < 3) {
    return null;
  }

  const chapterRaw = parts[parts.length - 2];
  const verseRaw = parts[parts.length - 1];
  const bookRaw = parts.slice(0, -2).join('-');
  return parseBookChapterVerse(bookRaw, chapterRaw, verseRaw, aliasLookup);
}

function parseReferenceInput(
  rawInput: string,
  aliasLookup: Map<string, string>
): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('/')) {
    const [bookRaw, chapterRaw, verseRaw] = trimmed.split('/');
    if (!bookRaw || !chapterRaw || !verseRaw) {
      return null;
    }
    return parseBookChapterVerse(bookRaw, chapterRaw, verseRaw, aliasLookup);
  }

  const chapterVersePattern = /^(.+?)\s+(\d+)\s*:\s*(\d+)$/u;
  const chapterVerseMatch = trimmed.match(chapterVersePattern);
  if (chapterVerseMatch) {
    return parseBookChapterVerse(
      chapterVerseMatch[1],
      chapterVerseMatch[2],
      chapterVerseMatch[3],
      aliasLookup
    );
  }

  return parseRouteRefSlug(trimmed, aliasLookup);
}

function parseBookChapterVerse(
  rawBook: string,
  rawChapter: string,
  rawVerse: string,
  aliasLookup: Map<string, string>
): string | null {
  const chapter = Number(rawChapter);
  const verse = Number(rawVerse);
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    return null;
  }

  const bookKey = normalizeBookToken(rawBook);
  const book = aliasLookup.get(bookKey);
  if (!book) {
    return null;
  }

  return `${book}/${chapter}/${verse}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  return target.isContentEditable;
}
