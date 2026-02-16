import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WordInspector } from '../components/WordInspector';
import { getReferenceCatalog, getVerse, loadBundle } from '../lib/data/api';
import type {
  ReferenceCatalog,
  VerseBundle,
  VerseReferenceEntry
} from '../lib/data/loader';
import { alignWordTracesToDisplayWords } from './VerseExplorer';

export function WordPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [verseBundle, setVerseBundle] = useState<VerseBundle | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [isVerseLoading, setIsVerseLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadBundle('latest')
      .then(() => {
        if (cancelled) {
          return;
        }
        const nextCatalog = getReferenceCatalog();
        if (nextCatalog.refs.length === 0) {
          throw new Error('No references were found in /data/latest/refs/index.json.');
        }
        setCatalog(nextCatalog);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBundleError(error instanceof Error ? error.message : 'Unknown error');
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
      out.set(
        toAddressKey(reference.ref.book, reference.ref.chapter, reference.ref.verse),
        reference.ref_key
      );
    }
    return out;
  }, [references]);
  const chapterVerseIndex = useMemo(() => {
    const mutable = new Map<string, Map<number, Set<number>>>();
    for (const reference of references) {
      const chapterMap = mutable.get(reference.ref.book) ?? new Map<number, Set<number>>();
      if (!mutable.has(reference.ref.book)) {
        mutable.set(reference.ref.book, chapterMap);
      }
      const verseSet = chapterMap.get(reference.ref.chapter) ?? new Set<number>();
      if (!chapterMap.has(reference.ref.chapter)) {
        chapterMap.set(reference.ref.chapter, verseSet);
      }
      verseSet.add(reference.ref.verse);
    }

    const out = new Map<string, Map<number, number[]>>();
    for (const [book, chapterMap] of mutable.entries()) {
      const nextChapterMap = new Map<number, number[]>();
      const sortedChapters = Array.from(chapterMap.keys()).sort((left, right) => left - right);
      for (const chapter of sortedChapters) {
        const verseSet = chapterMap.get(chapter);
        if (!verseSet) {
          continue;
        }
        nextChapterMap.set(chapter, Array.from(verseSet.values()).sort((left, right) => left - right));
      }
      out.set(book, nextChapterMap);
    }
    return out;
  }, [references]);
  const books = useMemo(() => {
    const available = new Set(references.map((reference) => reference.ref.book));
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const book of catalog?.navigation.books ?? []) {
      if (available.has(book.book) && !seen.has(book.book)) {
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
  }, [catalog?.navigation.books, references]);

  const requestedRefKey = searchParams.get('ref') ?? '';
  const activeRefKey = useMemo(() => {
    if (requestedRefKey && referenceByKey.get(requestedRefKey)) {
      return requestedRefKey;
    }
    return references[0]?.ref_key ?? null;
  }, [referenceByKey, references, requestedRefKey]);
  const activeReference = activeRefKey ? referenceByKey.get(activeRefKey) ?? null : null;
  const activeRefIndex = useMemo(() => {
    if (!activeRefKey) {
      return -1;
    }
    return references.findIndex((reference) => reference.ref_key === activeRefKey);
  }, [activeRefKey, references]);

  useEffect(() => {
    if (!activeRefKey) {
      return;
    }
    if (requestedRefKey === activeRefKey) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('ref', activeRefKey);
    setSearchParams(next, { replace: true });
  }, [activeRefKey, requestedRefKey, searchParams, setSearchParams]);

  const selectedBook = activeReference?.ref.book ?? books[0] ?? '';
  const chapters = useMemo(() => {
    return Array.from(chapterVerseIndex.get(selectedBook)?.keys() ?? []).sort((left, right) => left - right);
  }, [chapterVerseIndex, selectedBook]);
  const selectedChapter = activeReference?.ref.chapter ?? chapters[0] ?? 1;
  const verses = useMemo(() => {
    return chapterVerseIndex.get(selectedBook)?.get(selectedChapter) ?? [];
  }, [chapterVerseIndex, selectedBook, selectedChapter]);
  const selectedVerse = activeReference?.ref.verse ?? verses[0] ?? 1;

  const navigateToRef = useCallback((nextRefKey: string) => {
    if (!referenceByKey.get(nextRefKey)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('ref', nextRefKey);
    setSearchParams(next);
  }, [referenceByKey, searchParams, setSearchParams]);

  const onBookChange = useCallback((book: string) => {
    const chapterMap = chapterVerseIndex.get(book);
    const nextChapter = Array.from(chapterMap?.keys() ?? []).sort((left, right) => left - right)[0];
    if (!nextChapter) {
      return;
    }
    const nextVerse = chapterMap?.get(nextChapter)?.[0];
    if (!nextVerse) {
      return;
    }
    const nextRefKey = referenceByAddress.get(toAddressKey(book, nextChapter, nextVerse));
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [chapterVerseIndex, navigateToRef, referenceByAddress]);

  const onChapterChange = useCallback((chapter: number) => {
    const nextVerse = chapterVerseIndex.get(selectedBook)?.get(chapter)?.[0];
    if (!nextVerse) {
      return;
    }
    const nextRefKey = referenceByAddress.get(toAddressKey(selectedBook, chapter, nextVerse));
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [chapterVerseIndex, navigateToRef, referenceByAddress, selectedBook]);

  const onVerseChange = useCallback((verse: number) => {
    const nextRefKey = referenceByAddress.get(toAddressKey(selectedBook, selectedChapter, verse));
    if (nextRefKey) {
      navigateToRef(nextRefKey);
    }
  }, [navigateToRef, referenceByAddress, selectedBook, selectedChapter]);

  const onPrevRef = useCallback(() => {
    const previous = activeRefIndex - 1;
    if (previous < 0 || previous >= references.length) {
      return;
    }
    navigateToRef(references[previous].ref_key);
  }, [activeRefIndex, navigateToRef, references]);

  const onNextRef = useCallback(() => {
    const nextIndex = activeRefIndex + 1;
    if (nextIndex < 0 || nextIndex >= references.length) {
      return;
    }
    navigateToRef(references[nextIndex].ref_key);
  }, [activeRefIndex, navigateToRef, references]);

  useEffect(() => {
    if (!activeRefKey) {
      setVerseBundle(null);
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

  const verseText = useMemo(() => {
    if (!verseBundle) {
      return [];
    }
    const words = verseBundle.phrase_tree?.words ?? [];
    if (words.length > 0) {
      return words;
    }
    return verseBundle.word_traces.map((trace) => trace.surface);
  }, [verseBundle]);

  const roles = verseBundle?.word_phrase_roles ?? [];
  const traces = verseBundle?.word_traces ?? [];
  const alignedWordTraces = useMemo(
    () => alignWordTracesToDisplayWords(verseText, roles, traces),
    [roles, traces, verseText]
  );

  const selectedWordIndex = useMemo(() => {
    const parsed = Number(searchParams.get('word'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [searchParams]);
  const wordOptions = useMemo(
    () => verseText.map((surface, index) => ({ wordIndex: index + 1, surface })),
    [verseText]
  );

  useEffect(() => {
    if (!activeRefKey || wordOptions.length === 0) {
      return;
    }
    const maxWord = wordOptions.length;
    const normalizedWord = selectedWordIndex ? Math.min(Math.max(selectedWordIndex, 1), maxWord) : 1;
    if (normalizedWord === selectedWordIndex) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('ref', activeRefKey);
    next.set('word', String(normalizedWord));
    setSearchParams(next, { replace: true });
  }, [activeRefKey, searchParams, selectedWordIndex, setSearchParams, wordOptions.length]);

  const selectedWordTrace = useMemo(() => {
    if (!selectedWordIndex) {
      return null;
    }
    return alignedWordTraces[selectedWordIndex - 1] ?? null;
  }, [alignedWordTraces, selectedWordIndex]);

  const selectedWordPhraseRole = useMemo(() => {
    if (!selectedWordIndex) {
      return null;
    }
    return roles.find((role) => role.word_index === selectedWordIndex) ?? null;
  }, [roles, selectedWordIndex]);

  const selectedWordSurface = useMemo(() => {
    if (!selectedWordIndex) {
      return null;
    }
    return verseText[selectedWordIndex - 1] ?? selectedWordTrace?.surface ?? null;
  }, [selectedWordIndex, selectedWordTrace?.surface, verseText]);

  if (bundleError) {
    return <p className="status status-error">Word pane failed to load: {bundleError}</p>;
  }

  if (!catalog || !activeRefKey) {
    return <p className="status">Loading word pane…</p>;
  }

  const onWordChange = (wordIndex: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set('ref', activeRefKey);
    next.set('word', String(wordIndex));
    setSearchParams(next);
  };

  return (
    <div className="word-page" data-testid="word-page">
      <section className="ref-picker" aria-label="Word pane reference picker">
        <div className="ref-picker-controls">
          <label className="ref-picker-field">
            <span>Book</span>
            <select
              data-testid="word-ref-book-select"
              value={selectedBook}
              onChange={(event) => onBookChange(event.target.value)}
            >
              {books.map((book) => (
                <option key={book} value={book}>
                  {book}
                </option>
              ))}
            </select>
          </label>
          <label className="ref-picker-field">
            <span>Chapter</span>
            <select
              data-testid="word-ref-chapter-select"
              value={String(selectedChapter)}
              onChange={(event) => onChapterChange(Number(event.target.value))}
            >
              {chapters.map((chapter) => (
                <option key={chapter} value={String(chapter)}>
                  {chapter}
                </option>
              ))}
            </select>
          </label>
          <label className="ref-picker-field">
            <span>Verse</span>
            <select
              data-testid="word-ref-verse-select"
              value={String(selectedVerse)}
              onChange={(event) => onVerseChange(Number(event.target.value))}
            >
              {verses.map((verse) => (
                <option key={verse} value={String(verse)}>
                  {verse}
                </option>
              ))}
            </select>
          </label>
          <label className="ref-picker-field">
            <span>Word</span>
            <select
              data-testid="word-select"
              value={selectedWordIndex ? String(selectedWordIndex) : ''}
              onChange={(event) => onWordChange(Number(event.target.value))}
              disabled={wordOptions.length === 0}
            >
              {wordOptions.map((word) => (
                <option key={word.wordIndex} value={String(word.wordIndex)}>
                  {word.wordIndex}. {word.surface}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="nav-button"
            data-testid="word-prev-ref-button"
            onClick={onPrevRef}
            disabled={activeRefIndex <= 0}
          >
            Prev
          </button>
          <button
            type="button"
            className="nav-button"
            data-testid="word-next-ref-button"
            onClick={onNextRef}
            disabled={activeRefIndex < 0 || activeRefIndex >= references.length - 1}
          >
            Next
          </button>
        </div>
      </section>

      <p className="status">
        Ref <code>{activeRefKey}</code>
      </p>
      {isVerseLoading ? <p className="status">Loading word data…</p> : null}
      {verseError ? <p className="status status-error">{verseError}</p> : null}

      <WordInspector
        selectedWordIndex={selectedWordIndex}
        surface={selectedWordSurface}
        wordTrace={selectedWordTrace}
        wordPhraseRole={selectedWordPhraseRole}
      />
    </div>
  );
}

function toAddressKey(book: string, chapter: number, verse: number): string {
  return `${book}|${chapter}|${verse}`;
}
