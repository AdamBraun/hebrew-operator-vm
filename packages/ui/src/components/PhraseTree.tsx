import type { PhraseNode } from '../lib/contracts/versePhraseTrees';

export interface PhraseTreeProps {
  tree: PhraseNode;
  highlightedNodeIds: Set<string>;
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

export function PhraseTree({
  tree,
  highlightedNodeIds,
  activeNodeId,
  onNodeClick
}: PhraseTreeProps): JSX.Element {
  return (
    <div className="phrase-tree" data-testid="phrase-tree">
      <PhraseTreeNode
        node={tree}
        highlightedNodeIds={highlightedNodeIds}
        activeNodeId={activeNodeId}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}

interface PhraseTreeNodeProps {
  node: PhraseNode;
  highlightedNodeIds: Set<string>;
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

function PhraseTreeNode({
  node,
  highlightedNodeIds,
  activeNodeId,
  onNodeClick
}: PhraseTreeNodeProps): JSX.Element {
  const isHighlighted = highlightedNodeIds.has(node.id);
  const isActive = activeNodeId === node.id;
  return (
    <div className="phrase-tree-node" data-node-type={node.node_type}>
      <button
        type="button"
        data-testid={`phrase-node-${node.id}`}
        data-highlighted={isHighlighted ? 'true' : 'false'}
        className={[
          'phrase-tree-node-button',
          isHighlighted ? 'is-highlighted' : '',
          isActive ? 'is-active' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onNodeClick(node.id)}
        title={node.id}
      >
        {formatNodeLabel(node)}
      </button>
      {node.node_type === 'LEAF' ? null : (
        <div className="phrase-tree-children">
          <PhraseTreeNode
            node={node.left}
            highlightedNodeIds={highlightedNodeIds}
            activeNodeId={activeNodeId}
            onNodeClick={onNodeClick}
          />
          <PhraseTreeNode
            node={node.right}
            highlightedNodeIds={highlightedNodeIds}
            activeNodeId={activeNodeId}
            onNodeClick={onNodeClick}
          />
        </div>
      )}
    </div>
  );
}

function formatNodeLabel(node: PhraseNode): string {
  const spanLabel = `[${node.span.start}-${node.span.end}]`;
  if (node.node_type === 'SPLIT') {
    const mark = node.split_accent.name ?? node.split_accent.codepoint;
    return mark ? `${mark} ${spanLabel}` : spanLabel;
  }
  return spanLabel;
}
