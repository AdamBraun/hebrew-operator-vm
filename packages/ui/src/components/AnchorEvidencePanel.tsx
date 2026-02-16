import { useEffect, useMemo, useState } from 'react';
import type { WordTraceEvent, WordTraceRecord } from '../lib/contracts';
import { getVerse, getWord } from '../lib/data/api';
import type { VerseBundle } from '../lib/data/loader';

export interface AnchorEvidencePointer {
  kind: 'verse' | 'word' | 'trace';
  refKey: string;
  eventStart: number | null;
  eventEnd: number | null;
}

export interface AnchorEvidenceSelection {
  anchorId: string;
  refKey: string;
  style: 'strict' | 'poetic';
  pointers: AnchorEvidencePointer[];
}

interface AnchorEvidencePanelProps {
  selection: AnchorEvidenceSelection | null;
  onClose: () => void;
}

interface WordEvidenceItem {
  pointer: AnchorEvidencePointer;
  trace: WordTraceRecord | null;
}

export function AnchorEvidencePanel({
  selection,
  onClose
}: AnchorEvidencePanelProps): JSX.Element {
  const [verseBundle, setVerseBundle] = useState<VerseBundle | null>(null);
  const [wordEvidence, setWordEvidence] = useState<WordEvidenceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verseRefKey = useMemo(() => {
    if (!selection) {
      return null;
    }
    return toVerseRefKey(selection.refKey);
  }, [selection]);

  useEffect(() => {
    if (!selection || !verseRefKey) {
      setVerseBundle(null);
      setWordEvidence([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const [bundle, traces] = await Promise.all([
          getVerse(verseRefKey),
          loadWordEvidence(selection.pointers)
        ]);
        if (cancelled) {
          return;
        }
        setVerseBundle(bundle);
        setWordEvidence(traces);
      } catch (error: unknown) {
        if (!cancelled) {
          setVerseBundle(null);
          setWordEvidence([]);
          setLoadError(error instanceof Error ? error.message : 'Unknown evidence loading error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selection, verseRefKey]);

  const verseText = useMemo(() => {
    if (!verseBundle) {
      return null;
    }
    const treeWords = verseBundle.phrase_tree?.words ?? [];
    if (treeWords.length > 0) {
      return treeWords.join(' ');
    }
    if (verseBundle.word_traces.length > 0) {
      return verseBundle.word_traces.map((trace) => trace.surface).join(' ');
    }
    return null;
  }, [verseBundle]);

  return (
    <aside className="anchor-evidence-panel" data-testid="anchor-evidence-panel">
      <div className="anchor-evidence-panel-header">
        <h3>Anchor Evidence</h3>
        {selection ? (
          <button type="button" className="word-inspector-copy" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      {!selection ? (
        <p className="status" data-testid="anchor-evidence-empty">
          Select an anchor to inspect verse, word, and trace evidence.
        </p>
      ) : (
        <div className="anchor-evidence-panel-body">
          <p className="status">
            Anchor <code data-testid="anchor-evidence-anchor-id">{selection.anchorId}</code> (
            {selection.style})
          </p>
          <p className="status">
            Target <code>{selection.refKey}</code>
          </p>

          {isLoading ? <p className="status">Loading evidence…</p> : null}
          {loadError ? <p className="status status-error">{loadError}</p> : null}

          <section className="anchor-evidence-block" data-testid="anchor-evidence-verse-ledger">
            <h4>Verse Ledger</h4>
            <p className="status">
              {verseRefKey ? (
                <>
                  Verse <code>{verseRefKey}</code>
                </>
              ) : (
                'No verse reference'
              )}
            </p>
            <p className="anchor-evidence-verse-text" data-testid="anchor-evidence-verse-text">
              {verseText ?? '(verse text unavailable)'}
            </p>
          </section>

          {renderPointers(selection.pointers, wordEvidence)}
        </div>
      )}
    </aside>
  );
}

async function loadWordEvidence(
  pointers: AnchorEvidencePointer[]
): Promise<WordEvidenceItem[]> {
  const relevantPointers = pointers.filter(
    (pointer) => pointer.kind === 'word' || pointer.kind === 'trace'
  );

  if (relevantPointers.length === 0) {
    return [];
  }

  const uniqueWordRefs = Array.from(new Set(relevantPointers.map((pointer) => pointer.refKey)));
  const traceByRef = new Map<string, WordTraceRecord | null>();

  await Promise.all(
    uniqueWordRefs.map(async (wordRefKey) => {
      const parsed = parseWordRefKey(wordRefKey);
      if (!parsed) {
        traceByRef.set(wordRefKey, null);
        return;
      }
      const trace = await getWord(parsed.verseRefKey, parsed.wordIndex);
      traceByRef.set(wordRefKey, trace);
    })
  );

  return relevantPointers.map((pointer) => ({
    pointer,
    trace: traceByRef.get(pointer.refKey) ?? null
  }));
}

function renderPointers(
  pointers: AnchorEvidencePointer[],
  wordEvidence: WordEvidenceItem[]
): JSX.Element | null {
  if (pointers.length === 0) {
    return (
      <p className="status status-warning">
        No explicit evidence pointers were provided for this anchor.
      </p>
    );
  }

  const wordEvidenceByRef = new Map<string, WordTraceRecord | null>();
  for (const item of wordEvidence) {
    if (!wordEvidenceByRef.has(item.pointer.refKey)) {
      wordEvidenceByRef.set(item.pointer.refKey, item.trace);
    }
  }

  return (
    <section className="anchor-evidence-block">
      <h4>Word / Trace Evidence</h4>
      <div className="anchor-evidence-pointer-list">
        {pointers.map((pointer, index) => {
          const safeRef = sanitizeRefKey(pointer.refKey);
          const trace = wordEvidenceByRef.get(pointer.refKey) ?? null;
          const traceEvents = selectTraceEvents(trace, pointer.eventStart, pointer.eventEnd);
          const skeleton = trace?.skeleton ?? [];

          return (
            <article
              key={`${pointer.kind}:${pointer.refKey}:${index}`}
              className="anchor-evidence-pointer"
              data-testid={`anchor-evidence-pointer-${index}`}
            >
              <p className="status">
                <strong>{pointer.kind}</strong> <code>{pointer.refKey}</code>
              </p>

              {pointer.kind === 'verse' ? (
                <p className="status">Verse pointer uses the verse ledger above.</p>
              ) : null}

              {trace ? (
                <>
                  <p
                    className="anchor-evidence-word-surface"
                    data-testid={`anchor-evidence-word-surface-${safeRef}-${index}`}
                  >
                    {trace.surface}
                  </p>
                  <p className="status">
                    Skeleton: {skeleton.length > 0 ? skeleton.join(' -> ') : '(no semantic events)'}
                  </p>
                </>
              ) : pointer.kind !== 'verse' ? (
                <p className="status status-warning">Word trace unavailable for this pointer.</p>
              ) : null}

              {pointer.kind === 'trace' ? (
                traceEvents.length > 0 ? (
                  <ul className="anchor-evidence-trace-events">
                    {traceEvents.map((event) => (
                      <li
                        key={`${pointer.refKey}:${event.index}`}
                        data-testid={`anchor-evidence-trace-event-${safeRef}-${index}-${event.index}`}
                      >
                        {event.kind} (e{event.index})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="status status-warning">No events in selected event span.</p>
                )
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function selectTraceEvents(
  trace: WordTraceRecord | null,
  eventStart: number | null,
  eventEnd: number | null
): WordTraceEvent[] {
  if (!trace) {
    return [];
  }

  if (eventStart === null && eventEnd === null) {
    return trace.events;
  }

  const start = eventStart ?? 0;
  const end = eventEnd ?? start;
  return trace.events.filter((event) => event.index >= start && event.index <= end);
}

function toVerseRefKey(refKey: string): string | null {
  const parts = String(refKey).split('/');
  if (parts.length < 3) {
    return null;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function parseWordRefKey(
  refKey: string
): {
  verseRefKey: string;
  wordIndex: number;
} | null {
  const parts = String(refKey).split('/');
  if (parts.length !== 4) {
    return null;
  }
  const wordIndex = Number(parts[3]);
  if (!Number.isInteger(wordIndex) || wordIndex <= 0) {
    return null;
  }
  return {
    verseRefKey: `${parts[0]}/${parts[1]}/${parts[2]}`,
    wordIndex
  };
}

function sanitizeRefKey(refKey: string): string {
  return refKey.replace(/[^a-zA-Z0-9]+/g, '-');
}
