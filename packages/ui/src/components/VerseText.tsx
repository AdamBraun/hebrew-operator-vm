import { useMemo } from 'react';
import type { WordPhraseRoleRecord, WordTraceRecord } from '../lib/contracts';

export interface VerseTextProps {
  words: string[];
  wordPhraseRoles: WordPhraseRoleRecord[];
  wordTraces: WordTraceRecord[];
  highlightedWordIndices: Set<number>;
  activeWordIndex: number | null;
  onWordClick: (wordIndex: number) => void;
}

export function VerseText({
  words,
  wordPhraseRoles,
  wordTraces,
  highlightedWordIndices,
  activeWordIndex,
  onWordClick
}: VerseTextProps): JSX.Element {
  const rolesByWordIndex = useMemo(() => {
    const out = new Map<number, WordPhraseRoleRecord>();
    for (const role of wordPhraseRoles) {
      out.set(role.word_index, role);
    }
    return out;
  }, [wordPhraseRoles]);

  const tracesByTokenIndex = useMemo(() => {
    const out = new Map<number, WordTraceRecord>();
    for (const trace of wordTraces) {
      out.set(trace.ref.token_index, trace);
    }
    return out;
  }, [wordTraces]);

  return (
    <div data-testid="verse-text" className="verse-text-token-grid">
      {words.map((surface, index) => {
        const wordIndex = index + 1;
        const role = rolesByWordIndex.get(wordIndex);
        const trace = tracesByTokenIndex.get(wordIndex) ?? wordTraces[index];
        const isHighlighted = highlightedWordIndices.has(wordIndex);
        const isActive = activeWordIndex === wordIndex;
        return (
          <button
            type="button"
            key={`${wordIndex}:${surface}`}
            data-testid={`verse-word-${wordIndex}`}
            data-highlighted={isHighlighted ? 'true' : 'false'}
            className={[
              'verse-word-token',
              isHighlighted ? 'is-highlighted' : '',
              isActive ? 'is-active' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onWordClick(wordIndex)}
            title={buildWordTooltip(wordIndex, role, trace)}
          >
            <span className="verse-word-surface">{surface}</span>
            <span className="verse-word-role">{role?.phrase_role ?? 'UNKNOWN'}</span>
          </button>
        );
      })}
    </div>
  );
}

function buildWordTooltip(
  wordIndex: number,
  role: WordPhraseRoleRecord | undefined,
  trace: WordTraceRecord | undefined
): string {
  const lines = [`Word ${wordIndex}`];

  if (role) {
    lines.push(`Role: ${role.phrase_role}`);
    if (role.primary_accent.name) {
      lines.push(`Primary accent: ${role.primary_accent.name}`);
    } else if (role.primary_accent.codepoint) {
      lines.push(`Primary accent: ${role.primary_accent.codepoint}`);
    }
  }

  if (trace?.flow) {
    lines.push(`Trace: ${trace.flow}`);
  } else if (trace?.skeleton && trace.skeleton.length > 0) {
    lines.push(`Trace: ${trace.skeleton.join(' -> ')}`);
  } else if (trace) {
    lines.push('Trace: (no semantic events)');
  }

  return lines.join('\n');
}
