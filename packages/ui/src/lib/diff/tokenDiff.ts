import type { SideBySideTextDiff, TextDiffSegment } from './types';

const TOKEN_PATTERN = /\s+|[^\s]+/g;

type TokenOp =
  | { type: 'same'; token: string }
  | { type: 'added'; token: string }
  | { type: 'removed'; token: string };

export function computeSideBySideTextDiff(leftText: string, rightText: string): SideBySideTextDiff {
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);
  const ops = computeTokenOps(leftTokens, rightTokens);

  const leftSegments: TextDiffSegment[] = [];
  const rightSegments: TextDiffSegment[] = [];
  let changed = false;

  for (const op of ops) {
    if (op.type === 'same') {
      appendSegment(leftSegments, 'same', op.token);
      appendSegment(rightSegments, 'same', op.token);
      continue;
    }

    changed = true;
    if (op.type === 'removed') {
      appendSegment(leftSegments, 'removed', op.token);
      continue;
    }

    appendSegment(rightSegments, 'added', op.token);
  }

  return {
    changed,
    leftSegments,
    rightSegments
  };
}

function tokenize(text: string): string[] {
  return String(text).match(TOKEN_PATTERN) ?? [];
}

function computeTokenOps(leftTokens: string[], rightTokens: string[]): TokenOp[] {
  const leftLen = leftTokens.length;
  const rightLen = rightTokens.length;
  const table: number[][] = Array.from({ length: leftLen + 1 }, () =>
    Array<number>(rightLen + 1).fill(0)
  );

  for (let leftIndex = leftLen - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLen - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftTokens[leftIndex] === rightTokens[rightIndex]) {
        table[leftIndex][rightIndex] = table[leftIndex + 1][rightIndex + 1] + 1;
      } else {
        table[leftIndex][rightIndex] = Math.max(
          table[leftIndex + 1][rightIndex],
          table[leftIndex][rightIndex + 1]
        );
      }
    }
  }

  const ops: TokenOp[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLen && rightIndex < rightLen) {
    const leftToken = leftTokens[leftIndex];
    const rightToken = rightTokens[rightIndex];

    if (leftToken === rightToken) {
      ops.push({
        type: 'same',
        token: leftToken
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (table[leftIndex + 1][rightIndex] >= table[leftIndex][rightIndex + 1]) {
      ops.push({
        type: 'removed',
        token: leftToken
      });
      leftIndex += 1;
    } else {
      ops.push({
        type: 'added',
        token: rightToken
      });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLen) {
    ops.push({
      type: 'removed',
      token: leftTokens[leftIndex]
    });
    leftIndex += 1;
  }

  while (rightIndex < rightLen) {
    ops.push({
      type: 'added',
      token: rightTokens[rightIndex]
    });
    rightIndex += 1;
  }

  return ops;
}

function appendSegment(segments: TextDiffSegment[], type: TextDiffSegment['type'], token: string): void {
  const last = segments[segments.length - 1];
  if (last && last.type === type) {
    last.text += token;
    return;
  }

  segments.push({
    type,
    text: token
  });
}
