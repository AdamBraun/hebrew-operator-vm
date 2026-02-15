import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WordInspector } from '../components/WordInspector';
import { getReferenceCatalog, getVerse, loadBundle } from '../lib/data/api';
import type { ReferenceCatalog, VerseBundle } from '../lib/data/loader';
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
    const out = new Map<string, boolean>();
    for (const reference of references) {
      out.set(reference.ref_key, true);
    }
    return out;
  }, [references]);

  const requestedRefKey = searchParams.get('ref') ?? '';
  const activeRefKey = useMemo(() => {
    if (requestedRefKey && referenceByKey.has(requestedRefKey)) {
      return requestedRefKey;
    }
    return references[0]?.ref_key ?? null;
  }, [referenceByKey, references, requestedRefKey]);

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

  return (
    <div className="word-page" data-testid="word-page">
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
