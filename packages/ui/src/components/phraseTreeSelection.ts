import type { PhraseNode } from '../lib/contracts/versePhraseTrees';
import type { WordPhraseRoleRecord } from '../lib/contracts/wordPhraseRoles';

export interface PhraseSelectionState {
  highlightedWordIndices: number[];
  highlightedNodeIds: string[];
  activeSpan: { start: number; end: number } | null;
}

interface NodeEntry {
  id: string;
  span: { start: number; end: number };
  parentId: string | null;
}

export interface PhraseSelectionInput {
  tree: PhraseNode | null;
  wordCount: number;
  wordPhraseRoles: WordPhraseRoleRecord[];
  selectedNodeId: string | null;
  selectedWordIndex: number | null;
}

export function spanToWordIndices(
  span: { start: number; end: number },
  wordCount: number
): number[] {
  const start = Math.max(1, span.start);
  const end = Math.min(wordCount, span.end);
  const indices: number[] = [];
  for (let value = start; value <= end; value += 1) {
    indices.push(value);
  }
  return indices;
}

export function derivePhraseSelection(input: PhraseSelectionInput): PhraseSelectionState {
  const { tree, wordCount, wordPhraseRoles, selectedNodeId, selectedWordIndex } = input;
  if (!tree || wordCount < 1) {
    return emptySelection();
  }

  const nodesById = buildNodeMap(tree);

  if (selectedWordIndex !== null) {
    const path = resolveWordPath(selectedWordIndex, wordPhraseRoles, nodesById);
    if (path.length === 0) {
      return {
        highlightedWordIndices: [selectedWordIndex],
        highlightedNodeIds: [],
        activeSpan: null
      };
    }
    return {
      highlightedWordIndices: [selectedWordIndex],
      highlightedNodeIds: path,
      activeSpan: null
    };
  }

  if (selectedNodeId !== null) {
    const nodeEntry = nodesById.get(selectedNodeId);
    if (!nodeEntry) {
      return emptySelection();
    }
    return {
      highlightedWordIndices: spanToWordIndices(nodeEntry.span, wordCount),
      highlightedNodeIds: [selectedNodeId],
      activeSpan: nodeEntry.span
    };
  }

  return emptySelection();
}

function resolveWordPath(
  wordIndex: number,
  wordPhraseRoles: WordPhraseRoleRecord[],
  nodesById: Map<string, NodeEntry>
): string[] {
  const role = wordPhraseRoles.find((record) => record.word_index === wordIndex);
  if (role) {
    const fromRole = role.phrase_path.filter((id) => nodesById.has(id));
    if (fromRole.length > 0) {
      return fromRole;
    }
  }

  const leafId = `w_${wordIndex}`;
  const path: string[] = [];
  let cursor: string | null = leafId;
  while (cursor !== null) {
    const node = nodesById.get(cursor);
    if (!node) {
      break;
    }
    path.push(node.id);
    cursor = node.parentId;
  }
  return path;
}

function buildNodeMap(root: PhraseNode): Map<string, NodeEntry> {
  const out = new Map<string, NodeEntry>();

  const walk = (node: PhraseNode, parentId: string | null): void => {
    out.set(node.id, {
      id: node.id,
      span: node.span,
      parentId
    });
    if (node.node_type === 'LEAF') {
      return;
    }
    walk(node.left, node.id);
    walk(node.right, node.id);
  };

  walk(root, null);
  return out;
}

function emptySelection(): PhraseSelectionState {
  return {
    highlightedWordIndices: [],
    highlightedNodeIds: [],
    activeSpan: null
  };
}
