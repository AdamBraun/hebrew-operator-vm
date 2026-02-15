import { useMemo, useState } from 'react';
import type { WordPhraseRoleRecord, WordTraceRecord } from '../lib/contracts';

export interface WordInspectorProps {
  selectedWordIndex: number | null;
  surface: string | null;
  wordTrace: WordTraceRecord | null;
  wordPhraseRole: WordPhraseRoleRecord | null;
}

export function WordInspector({
  selectedWordIndex,
  surface,
  wordTrace,
  wordPhraseRole
}: WordInspectorProps): JSX.Element {
  const [copyState, setCopyState] = useState<{
    field: 'skeleton' | 'flow' | 'anchor' | null;
    message: string | null;
  }>({ field: null, message: null });

  const tokenIdsText = useMemo(
    () => (wordTrace && wordTrace.token_ids.length > 0 ? wordTrace.token_ids.join(', ') : '—'),
    [wordTrace]
  );

  const graphemeSignaturesText = useMemo(() => {
    if (!wordTrace) {
      return '—';
    }
    const signatures = extractGraphemeSignatures(wordTrace);
    if (signatures.length === 0) {
      return '—';
    }
    return signatures.join(', ');
  }, [wordTrace]);

  const skeletonKey = useMemo(() => {
    if (!wordTrace || !wordTrace.skeleton || wordTrace.skeleton.length === 0) {
      return '';
    }
    return wordTrace.skeleton.join(' -> ');
  }, [wordTrace]);

  const flowLine = wordTrace?.flow ?? '';
  const refAnchor =
    wordTrace?.ref_key ??
    (wordPhraseRole && selectedWordIndex
      ? `${wordPhraseRole.ref_key}/${selectedWordIndex}`
      : '');

  const phrasePathText =
    wordPhraseRole && wordPhraseRole.phrase_path.length > 0
      ? wordPhraseRole.phrase_path.join(' > ')
      : '—';

  if (!selectedWordIndex) {
    return <p className="status">Select a word to inspect trace evidence.</p>;
  }

  const onCopy = async (
    field: 'skeleton' | 'flow' | 'anchor',
    value: string
  ): Promise<void> => {
    if (!value) {
      setCopyState({ field, message: 'No value to copy' });
      return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setCopyState({ field, message: 'Clipboard API unavailable' });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyState({ field, message: 'Copied' });
    } catch {
      setCopyState({ field, message: 'Copy failed' });
    }
  };

  return (
    <div className="word-inspector" data-testid="word-inspector">
      <FieldRow label="surface form" value={surface ?? wordTrace?.surface ?? wordPhraseRole?.surface ?? '—'} />
      <FieldRow label="TokenIDs" value={tokenIdsText} />
      <FieldRow label="grapheme signatures" value={graphemeSignaturesText} />

      <FieldRow
        label="skeleton"
        value={skeletonKey || '—'}
        action={
          <button
            type="button"
            className="word-inspector-copy"
            onClick={() => void onCopy('skeleton', skeletonKey)}
          >
            Copy skeleton key
          </button>
        }
      />

      <FieldRow
        label="flow one-liner"
        value={flowLine || '—'}
        action={
          <button
            type="button"
            className="word-inspector-copy"
            onClick={() => void onCopy('flow', flowLine)}
          >
            Copy flow
          </button>
        }
      />

      <FieldRow label="phrase role" value={wordPhraseRole?.phrase_role ?? '—'} />
      <FieldRow label="phrase path" value={phrasePathText} />
      <FieldRow label="clause" value={wordPhraseRole?.clause_id ?? '—'} />
      <FieldRow label="subclause" value={wordPhraseRole?.subclause_id ?? '—'} />

      <FieldRow
        label="ref anchor"
        value={refAnchor || '—'}
        action={
          <button
            type="button"
            className="word-inspector-copy"
            onClick={() => void onCopy('anchor', refAnchor)}
          >
            Copy ref anchor
          </button>
        }
      />

      <FieldRow label="semantic_version" value={wordTrace?.semantics_version ?? '—'} />
      {copyState.message ? (
        <p className="status" data-testid="word-inspector-copy-status">
          {copyState.message}
        </p>
      ) : null}
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  action?: JSX.Element;
}

function FieldRow({ label, value, action }: FieldRowProps): JSX.Element {
  return (
    <div className="word-inspector-row">
      <p className="word-inspector-label">{label}</p>
      <p className="word-inspector-value">{value}</p>
      {action ? <div className="word-inspector-action">{action}</div> : null}
    </div>
  );
}

function extractGraphemeSignatures(trace: WordTraceRecord): string[] {
  const extensions = trace.extensions;
  if (!extensions || typeof extensions !== 'object') {
    return [];
  }

  const candidates = [
    (extensions as Record<string, unknown>).grapheme_signatures,
    (extensions as Record<string, unknown>).graphemeSignatures,
    (extensions as Record<string, unknown>).token_signatures,
    (extensions as Record<string, unknown>).tokenSignatures
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is string => typeof item === 'string');
    }
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}
