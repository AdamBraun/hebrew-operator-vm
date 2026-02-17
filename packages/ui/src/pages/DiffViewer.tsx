import { useEffect, useMemo, useState } from 'react';
import { createLayeredTextCache } from '../lib/data/cache';
import { BundleLoader } from '../lib/data/loader';
import {
  computeBundleDiffIndex,
  computeVerseDiff,
  type BundleDiffIndexResult,
  type DiffBundleSnapshot,
  type TextDiffSegment,
  type VerseDiffResult
} from '../lib/diff';

const DEFAULT_BUNDLE_OPTIONS = ['latest', 'diff-a', 'diff-b'];

export function DiffViewer(): JSX.Element {
  const [bundleOptions, setBundleOptions] = useState<string[]>(DEFAULT_BUNDLE_OPTIONS);
  const [leftBundleTag, setLeftBundleTag] = useState<string>('latest');
  const [rightBundleTag, setRightBundleTag] = useState<string>('latest');

  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [bundleDiff, setBundleDiff] = useState<BundleDiffIndexResult | null>(null);
  const [selectedRefKey, setSelectedRefKey] = useState<string | null>(null);

  const [isVerseLoading, setIsVerseLoading] = useState(false);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [verseDiff, setVerseDiff] = useState<VerseDiffResult | null>(null);

  const leftLoader = useMemo(
    () =>
      new BundleLoader({
        cache: createLayeredTextCache({
          namespace: 'letters-ui-diff-left',
          useIndexedDb: false
        })
      }),
    []
  );
  const rightLoader = useMemo(
    () =>
      new BundleLoader({
        cache: createLayeredTextCache({
          namespace: 'letters-ui-diff-right',
          useIndexedDb: false
        })
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    void loadBundleOptions().then((options) => {
      if (cancelled) {
        return;
      }

      setBundleOptions(options);

      const nextLeft = pickBundle('latest', options, options[0] ?? 'latest');
      const nextRightCandidate = pickBundle('diff-a', options, options[1] ?? nextLeft);
      const nextRight =
        nextRightCandidate === nextLeft
          ? options.find((candidate) => candidate !== nextLeft) ?? nextRightCandidate
          : nextRightCandidate;

      setLeftBundleTag(nextLeft);
      setRightBundleTag(nextRight);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!leftBundleTag || !rightBundleTag) {
      return () => {
        cancelled = true;
      };
    }

    setIsIndexLoading(true);
    setIndexError(null);
    setBundleDiff(null);
    setSelectedRefKey(null);
    setVerseDiff(null);
    setVerseError(null);

    void Promise.all([leftLoader.loadBundle(leftBundleTag), rightLoader.loadBundle(rightBundleTag)])
      .then(() => {
        if (cancelled) {
          return;
        }

        const leftSnapshot = leftLoader.getBundleSnapshot();
        const rightSnapshot = rightLoader.getBundleSnapshot();
        const nextIndex = computeBundleDiffIndex(
          toDiffBundleSnapshot(leftBundleTag, leftSnapshot),
          toDiffBundleSnapshot(rightBundleTag, rightSnapshot)
        );

        setBundleDiff(nextIndex);
        setSelectedRefKey(nextIndex.changedVerses[0]?.refKey ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setIndexError(error instanceof Error ? error.message : 'Unknown diff index error');
      })
      .finally(() => {
        if (!cancelled) {
          setIsIndexLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [leftBundleTag, rightBundleTag, leftLoader, rightLoader]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedRefKey) {
      setVerseDiff(null);
      setVerseError(null);
      return () => {
        cancelled = true;
      };
    }

    setIsVerseLoading(true);
    setVerseError(null);
    setVerseDiff(null);

    void Promise.all([
      leftLoader.getVerse(selectedRefKey),
      rightLoader.getVerse(selectedRefKey),
      leftLoader.getParaphraseChunk(selectedRefKey),
      rightLoader.getParaphraseChunk(selectedRefKey)
    ])
      .then(([leftVerse, rightVerse, leftParaphrase, rightParaphrase]) => {
        if (cancelled) {
          return;
        }

        const nextVerseDiff = computeVerseDiff(
          {
            verseBundle: leftVerse,
            paraphraseRecords: leftParaphrase?.records ?? []
          },
          {
            verseBundle: rightVerse,
            paraphraseRecords: rightParaphrase?.records ?? []
          }
        );

        setVerseDiff(nextVerseDiff);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setVerseError(error instanceof Error ? error.message : 'Unknown verse diff error');
      })
      .finally(() => {
        if (!cancelled) {
          setIsVerseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRefKey, leftLoader, rightLoader]);

  const changedVerses = bundleDiff?.changedVerses ?? [];

  return (
    <div className="diff-viewer-page" data-testid="diff-viewer-page">
      <section className="diff-viewer-toolbar">
        <label className="diff-viewer-picker">
          <span>Run A</span>
          <select
            value={leftBundleTag}
            onChange={(event) => setLeftBundleTag(event.target.value)}
            data-testid="diff-bundle-a-select"
          >
            {bundleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="diff-viewer-picker">
          <span>Run B</span>
          <select
            value={rightBundleTag}
            onChange={(event) => setRightBundleTag(event.target.value)}
            data-testid="diff-bundle-b-select"
          >
            {bundleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <p className="status diff-viewer-summary" data-testid="diff-blast-radius">
          {bundleDiff
            ? `Changed ${changedVerses.length} of ${bundleDiff.totalVerses} verses between ${leftBundleTag} and ${rightBundleTag}.`
            : 'Select bundles to inspect semantic blast radius.'}
        </p>
      </section>

      {indexError ? <p className="status status-error">{indexError}</p> : null}
      {isIndexLoading ? <p className="status">Computing changed verses...</p> : null}

      {!isIndexLoading && !indexError ? (
        <div className="diff-viewer-layout">
          <aside className="diff-changed-verses">
            <h3>Top Changed Verses</h3>
            {changedVerses.length === 0 ? (
              <p className="status">No changed verses were detected for the selected bundles.</p>
            ) : (
              <ol className="diff-changed-list" data-testid="diff-changed-list">
                {changedVerses.map((entry) => (
                  <li key={entry.refKey}>
                    <button
                      type="button"
                      className={
                        selectedRefKey === entry.refKey
                          ? 'diff-changed-button is-active'
                          : 'diff-changed-button'
                      }
                      onClick={() => setSelectedRefKey(entry.refKey)}
                      data-testid={`diff-changed-verse-${toTestId(entry.refKey)}`}
                    >
                      <span className="diff-changed-ref">{formatRefLabel(entry.refKey)}</span>
                      <span className="diff-changed-meta">Impact score {entry.score}</span>
                      <span className="diff-changed-meta">{entry.reasons.join(' | ')}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </aside>

          <section className="diff-verse-detail" data-testid="diff-verse-detail">
            {!selectedRefKey ? <p className="status">Select a changed verse to inspect details.</p> : null}
            {selectedRefKey ? (
              <p className="diff-selected-ref" data-testid="diff-selected-verse">
                {formatRefLabel(selectedRefKey)}
              </p>
            ) : null}

            {isVerseLoading ? <p className="status">Loading per-verse diff...</p> : null}
            {verseError ? <p className="status status-error">{verseError}</p> : null}

            {!isVerseLoading && !verseError && verseDiff ? (
              <div className="diff-verse-sections">
                <section className="diff-panel">
                  <h3>Paraphrase Diff</h3>
                  <div className="diff-paraphrase-cards">
                    {verseDiff.paraphraseDiffs.map((entry) => (
                      <article
                        key={entry.style}
                        className="diff-paraphrase-card"
                        data-testid={`diff-paraphrase-${entry.style}`}
                      >
                        <h4>{entry.style === 'strict' ? 'Strict' : 'Poetic'}</h4>
                        <div className="diff-paraphrase-columns">
                          <div>
                            <p className="diff-side-label">Run A ({leftBundleTag})</p>
                            <p className="diff-side-text">{renderSegments(entry.textDiff.leftSegments)}</p>
                          </div>
                          <div>
                            <p className="diff-side-label">Run B ({rightBundleTag})</p>
                            <p className="diff-side-text">{renderSegments(entry.textDiff.rightSegments)}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="diff-panel" data-testid="diff-ledger-impact">
                  <h3>Ledger Impact</h3>
                  {verseDiff.ledgerAnchorDiffs.length === 0 ? (
                    <p className="status">No ledger pointer changes were detected for this verse.</p>
                  ) : (
                    <ul className="diff-ledger-list">
                      {verseDiff.ledgerAnchorDiffs.map((entry) => (
                        <li key={`${entry.style}-${entry.anchorId}`} className="diff-ledger-item">
                          <p className="diff-ledger-title">
                            {entry.style} [[{entry.anchorId}]]
                            {entry.linkedWordIndex !== null
                              ? ` -> word ${entry.linkedWordIndex}`
                              : ''}
                            {entry.linkedSkeletonChanged ? ' (skeleton changed)' : ''}
                          </p>
                          {entry.removedPointers.length > 0 ? (
                            <p className="diff-ledger-detail">
                              Removed: {entry.removedPointers.join(', ')}
                            </p>
                          ) : null}
                          {entry.addedPointers.length > 0 ? (
                            <p className="diff-ledger-detail">Added: {entry.addedPointers.join(', ')}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="diff-panel" data-testid="diff-skeleton-impact">
                  <h3>Skeleton Impact</h3>
                  <p className="status">
                    Phrase tree changed: {verseDiff.phraseTreeDiff.changed ? 'yes' : 'no'}
                  </p>
                  {verseDiff.wordSkeletonDiffs.length === 0 ? (
                    <p className="status">No skeleton changes were detected for this verse.</p>
                  ) : (
                    <ul className="diff-skeleton-list">
                      {verseDiff.wordSkeletonDiffs.map((entry) => (
                        <li
                          key={entry.wordIndex}
                          className="diff-skeleton-item"
                          data-testid={`diff-skeleton-word-${entry.wordIndex}`}
                        >
                          <p className="diff-skeleton-title">
                            Word {entry.wordIndex}: {entry.leftSurface ?? '(missing)'}{' -> '}
                            {entry.rightSurface ?? '(missing)'}
                          </p>
                          <p className="diff-skeleton-detail">
                            A: {entry.leftSkeleton.length > 0 ? entry.leftSkeleton.join(' -> ') : '(none)'}
                          </p>
                          <p className="diff-skeleton-detail">
                            B: {entry.rightSkeleton.length > 0 ? entry.rightSkeleton.join(' -> ') : '(none)'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function toDiffBundleSnapshot(
  tag: string,
  snapshot: {
    manifest: DiffBundleSnapshot['manifest'];
    refsIndex: DiffBundleSnapshot['refsIndex'];
  }
): DiffBundleSnapshot {
  return {
    tag,
    manifest: snapshot.manifest,
    refsIndex: snapshot.refsIndex
  };
}

function renderSegments(segments: TextDiffSegment[]): JSX.Element {
  if (segments.length === 0) {
    return <span className="diff-token diff-token-empty">(missing)</span>;
  }

  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.type}-${String(index)}`}
          className={`diff-token diff-token-${segment.type}`}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

function toTestId(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatRefLabel(refKey: string): string {
  const [book, chapter, verse] = refKey.split('/');
  if (!book || !chapter || !verse) {
    return refKey;
  }
  return `${book} ${chapter}:${verse}`;
}

function pickBundle(current: string, options: string[], fallback: string): string {
  if (current && options.includes(current)) {
    return current;
  }
  if (options.includes(fallback)) {
    return fallback;
  }
  return options[0] ?? fallback;
}

async function loadBundleOptions(): Promise<string[]> {
  const defaults = [...DEFAULT_BUNDLE_OPTIONS];

  try {
    const response = await fetch('/data/bundles.json');
    if (!response.ok) {
      return defaults;
    }

    const raw = (await response.json()) as unknown;
    if (!isRecord(raw) || !Array.isArray(raw.versions)) {
      return defaults;
    }

    const merged = new Set<string>(defaults);
    for (const value of raw.versions) {
      if (typeof value !== 'string') {
        continue;
      }
      const normalized = value.trim();
      if (normalized.length > 0) {
        merged.add(normalized);
      }
    }

    return Array.from(merged.values()).sort((left, right) => {
      if (left === 'latest') {
        return -1;
      }
      if (right === 'latest') {
        return 1;
      }
      return left.localeCompare(right);
    });
  } catch {
    return defaults;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
