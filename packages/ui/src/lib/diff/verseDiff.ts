import type {
  LedgerPointer,
  LedgerAnchor,
  LedgerAnchorDiff,
  ParaphraseRecordDiff,
  ParaphraseStyle,
  PhraseTreeSummary,
  PhraseTreeSummaryDiff,
  VerseDiffInputSide,
  VerseDiffResult,
  WordSkeletonDiff
} from './types';
import { computeSideBySideTextDiff } from './tokenDiff';
import {
  extractLedgerAnchorsFromRecord,
  ledgerPointerToString,
  parseWordRefKey
} from './ledger';

const STYLE_ORDER: Record<ParaphraseStyle, number> = {
  strict: 0,
  poetic: 1
};
type WordTrace = NonNullable<VerseDiffInputSide['verseBundle']>['word_traces'][number];

export function computeVerseDiff(left: VerseDiffInputSide, right: VerseDiffInputSide): VerseDiffResult {
  const refKey = left.verseBundle?.ref_key ?? right.verseBundle?.ref_key ?? null;
  const paraphraseDiffs = computeParaphraseDiffs(left, right);
  const wordSkeletonDiffs = computeWordSkeletonDiffs(left, right);
  const phraseTreeDiff = computePhraseTreeSummaryDiff(left, right);
  const ledgerAnchorDiffs = computeLedgerAnchorDiffs(
    left,
    right,
    refKey,
    new Set(wordSkeletonDiffs.map((entry) => entry.wordIndex))
  );

  return {
    refKey,
    paraphraseDiffs,
    ledgerAnchorDiffs,
    wordSkeletonDiffs,
    phraseTreeDiff,
    hasChanges:
      paraphraseDiffs.some((entry) => entry.changed) ||
      ledgerAnchorDiffs.length > 0 ||
      wordSkeletonDiffs.length > 0 ||
      phraseTreeDiff.changed
  };
}

function computeParaphraseDiffs(left: VerseDiffInputSide, right: VerseDiffInputSide): ParaphraseRecordDiff[] {
  const leftByStyle = indexParaphraseByStyle(left);
  const rightByStyle = indexParaphraseByStyle(right);
  const styles = collectStyles(leftByStyle, rightByStyle);

  return styles.map((style) => {
    const leftRecord = leftByStyle.get(style);
    const rightRecord = rightByStyle.get(style);
    const leftText = leftRecord?.text ?? null;
    const rightText = rightRecord?.text ?? null;
    const textDiff = computeSideBySideTextDiff(leftText ?? '', rightText ?? '');

    return {
      style,
      leftText,
      rightText,
      textDiff,
      changed: leftText !== rightText
    };
  });
}

function indexParaphraseByStyle(side: VerseDiffInputSide): Map<ParaphraseStyle, { text: string }> {
  const byStyle = new Map<ParaphraseStyle, { text: string }>();
  for (const record of side.paraphraseRecords) {
    if (record.style !== 'strict' && record.style !== 'poetic') {
      continue;
    }
    if (!byStyle.has(record.style)) {
      byStyle.set(record.style, {
        text: record.text
      });
    }
  }
  return byStyle;
}

function collectStyles(
  leftByStyle: Map<ParaphraseStyle, { text: string }>,
  rightByStyle: Map<ParaphraseStyle, { text: string }>
): ParaphraseStyle[] {
  const styles = new Set<ParaphraseStyle>();
  for (const style of leftByStyle.keys()) {
    styles.add(style);
  }
  for (const style of rightByStyle.keys()) {
    styles.add(style);
  }

  const ordered = Array.from(styles.values());
  ordered.sort((left, right) => STYLE_ORDER[left] - STYLE_ORDER[right]);
  return ordered;
}

function computeWordSkeletonDiffs(left: VerseDiffInputSide, right: VerseDiffInputSide): WordSkeletonDiff[] {
  const leftByWord = new Map<number, WordTrace>();
  for (const trace of left.verseBundle?.word_traces ?? []) {
    leftByWord.set(trace.ref.token_index, trace);
  }

  const rightByWord = new Map<number, WordTrace>();
  for (const trace of right.verseBundle?.word_traces ?? []) {
    rightByWord.set(trace.ref.token_index, trace);
  }

  const wordIndices = new Set<number>();
  for (const index of leftByWord.keys()) {
    wordIndices.add(index);
  }
  for (const index of rightByWord.keys()) {
    wordIndices.add(index);
  }

  const diffs: WordSkeletonDiff[] = [];
  for (const wordIndex of Array.from(wordIndices.values()).sort((leftValue, rightValue) => leftValue - rightValue)) {
    const leftTrace = leftByWord.get(wordIndex);
    const rightTrace = rightByWord.get(wordIndex);
    const leftSkeleton = toSkeleton(leftTrace);
    const rightSkeleton = toSkeleton(rightTrace);

    if (
      arraysEqual(leftSkeleton, rightSkeleton) &&
      (leftTrace?.canonical_hash ?? null) === (rightTrace?.canonical_hash ?? null) &&
      (leftTrace?.surface ?? null) === (rightTrace?.surface ?? null)
    ) {
      continue;
    }

    diffs.push({
      wordIndex,
      leftSurface: leftTrace?.surface ?? null,
      rightSurface: rightTrace?.surface ?? null,
      leftSkeleton,
      rightSkeleton,
      leftCanonicalHash: leftTrace?.canonical_hash ?? null,
      rightCanonicalHash: rightTrace?.canonical_hash ?? null
    });
  }

  return diffs;
}

function toSkeleton(
  trace: { skeleton?: string[]; events: Array<{ kind: string }> } | undefined
): string[] {
  if (!trace) {
    return [];
  }
  return trace.skeleton ? [...trace.skeleton] : trace.events.map((event) => event.kind);
}

function computePhraseTreeSummaryDiff(
  left: VerseDiffInputSide,
  right: VerseDiffInputSide
): PhraseTreeSummaryDiff {
  const leftSummary = summarizePhraseTree(left.verseBundle?.phrase_tree ?? null);
  const rightSummary = summarizePhraseTree(right.verseBundle?.phrase_tree ?? null);

  return {
    left: leftSummary,
    right: rightSummary,
    changed: !phraseTreeSummaryEquals(leftSummary, rightSummary)
  };
}

function summarizePhraseTree(
  treeRecord: { phrase_version: string; tree: { id: string; node_type: string; left?: unknown; right?: unknown }; words: string[] } | null
): PhraseTreeSummary | null {
  if (!treeRecord) {
    return null;
  }

  const counts = countPhraseTreeNodes(treeRecord.tree);
  return {
    phraseVersion: treeRecord.phrase_version,
    rootId: treeRecord.tree.id,
    wordCount: treeRecord.words.length,
    nodeCount: counts.nodeCount,
    splitCount: counts.splitCount,
    joinCount: counts.joinCount,
    leafCount: counts.leafCount
  };
}

function countPhraseTreeNodes(root: {
  node_type: string;
  left?: unknown;
  right?: unknown;
}): {
  nodeCount: number;
  splitCount: number;
  joinCount: number;
  leafCount: number;
} {
  const stack = [root];
  let nodeCount = 0;
  let splitCount = 0;
  let joinCount = 0;
  let leafCount = 0;

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    nodeCount += 1;
    if (node.node_type === 'SPLIT') {
      splitCount += 1;
    } else if (node.node_type === 'JOIN') {
      joinCount += 1;
    } else if (node.node_type === 'LEAF') {
      leafCount += 1;
    }

    if (isTreeNode(node.left)) {
      stack.push(node.left);
    }
    if (isTreeNode(node.right)) {
      stack.push(node.right);
    }
  }

  return {
    nodeCount,
    splitCount,
    joinCount,
    leafCount
  };
}

function computeLedgerAnchorDiffs(
  left: VerseDiffInputSide,
  right: VerseDiffInputSide,
  selectedRefKey: string | null,
  changedSkeletonWordIndexes: Set<number>
): LedgerAnchorDiff[] {
  const leftAnchors = indexAnchors(left);
  const rightAnchors = indexAnchors(right);
  const keys = new Set<string>();

  for (const key of leftAnchors.keys()) {
    keys.add(key);
  }
  for (const key of rightAnchors.keys()) {
    keys.add(key);
  }

  const anchorDiffs: LedgerAnchorDiff[] = [];
  for (const key of Array.from(keys.values()).sort(compareAnchorKeys)) {
    const leftAnchor = leftAnchors.get(key) ?? null;
    const rightAnchor = rightAnchors.get(key) ?? null;
    const style = leftAnchor?.style ?? rightAnchor?.style;
    const anchorId = leftAnchor?.anchorId ?? rightAnchor?.anchorId;
    if (!style || !anchorId) {
      continue;
    }

    const leftPointers = toSortedPointerStrings(leftAnchor?.pointers ?? []);
    const rightPointers = toSortedPointerStrings(rightAnchor?.pointers ?? []);
    const addedPointers = rightPointers.filter((pointer) => !leftPointers.includes(pointer));
    const removedPointers = leftPointers.filter((pointer) => !rightPointers.includes(pointer));

    if (addedPointers.length === 0 && removedPointers.length === 0) {
      continue;
    }

    const linkedWordIndex = findLinkedWordIndex(leftAnchor, rightAnchor, selectedRefKey);
    anchorDiffs.push({
      style,
      anchorId,
      leftPointers,
      rightPointers,
      addedPointers,
      removedPointers,
      linkedWordIndex,
      linkedSkeletonChanged:
        linkedWordIndex !== null && changedSkeletonWordIndexes.has(linkedWordIndex)
    });
  }

  return anchorDiffs;
}

function indexAnchors(side: VerseDiffInputSide): Map<string, LedgerAnchor> {
  const byKey = new Map<string, LedgerAnchor>();
  for (const record of side.paraphraseRecords) {
    for (const anchor of extractLedgerAnchorsFromRecord(record)) {
      const key = `${anchor.style}|${anchor.anchorId}`;
      if (!byKey.has(key)) {
        byKey.set(key, anchor);
      }
    }
  }
  return byKey;
}

function toSortedPointerStrings(pointers: LedgerPointer[]): string[] {
  const unique = new Set<string>();
  for (const pointer of pointers) {
    unique.add(ledgerPointerToString(pointer));
  }
  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
}

function findLinkedWordIndex(
  leftAnchor: LedgerAnchor | null,
  rightAnchor: LedgerAnchor | null,
  selectedRefKey: string | null
): number | null {
  if (!selectedRefKey) {
    return null;
  }

  const indices = new Set<number>();
  for (const pointer of [...(leftAnchor?.pointers ?? []), ...(rightAnchor?.pointers ?? [])]) {
    if (pointer.kind !== 'word' && pointer.kind !== 'trace') {
      continue;
    }
    const parsed = parseWordRefKey(pointer.refKey);
    if (!parsed || parsed.verseRefKey !== selectedRefKey) {
      continue;
    }
    indices.add(parsed.wordIndex);
  }

  if (indices.size !== 1) {
    return null;
  }

  return Array.from(indices.values())[0] ?? null;
}

function phraseTreeSummaryEquals(left: PhraseTreeSummary | null, right: PhraseTreeSummary | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.phraseVersion === right.phraseVersion &&
    left.rootId === right.rootId &&
    left.wordCount === right.wordCount &&
    left.nodeCount === right.nodeCount &&
    left.splitCount === right.splitCount &&
    left.joinCount === right.joinCount &&
    left.leafCount === right.leafCount
  );
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function compareAnchorKeys(left: string, right: string): number {
  const [leftStyle = '', leftAnchorId = ''] = left.split('|');
  const [rightStyle = '', rightAnchorId = ''] = right.split('|');

  if (leftStyle !== rightStyle) {
    if (leftStyle === 'strict') {
      return -1;
    }
    if (rightStyle === 'strict') {
      return 1;
    }
    return leftStyle.localeCompare(rightStyle);
  }

  return leftAnchorId.localeCompare(rightAnchorId);
}

function isTreeNode(value: unknown): value is { node_type: string; left?: unknown; right?: unknown } {
  return typeof value === 'object' && value !== null && 'node_type' in value;
}
