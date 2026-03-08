import { SpaceBoundaryMode, Trope } from "../compile/types";
import { isCarryUnresolved } from "../state/eff";
import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary, addSupp, closeBoundaryRecord, isBoundaryOpen } from "../state/relations";
import { PhraseChunk, State } from "../state/state";
import { collectGarbage } from "./gc";
import { BoundaryTransitionArgs, applyBoundaryTransition } from "./domainTransition";
import { RuntimeError } from "./errors";
import { nextId } from "./ids";

type ApplySpaceOptions = {
  mode?: SpaceBoundaryMode;
  rank?: number | null;
  leftTrope?: Trope | null;
};

type CarryEdge = {
  source: string;
  target: string;
};

function edgeKeyParts(edge: string): [string, string] | null {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    return null;
  }
  const source = edge.slice(0, pivot);
  const target = edge.slice(pivot + 2);
  if (!source || !target) {
    return null;
  }
  return [source, target];
}

function buildContPredecessorIndex(state: State): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const edge of state.cont) {
    const parsed = edgeKeyParts(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const predecessors = out.get(target) ?? [];
    predecessors.push(source);
    out.set(target, predecessors);
  }
  return out;
}

function buildIncomingCarryIndex(state: State): Map<string, CarryEdge[]> {
  const out = new Map<string, CarryEdge[]>();
  for (const edge of state.carry) {
    const parsed = edgeKeyParts(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const incoming = out.get(target) ?? [];
    incoming.push({ source, target });
    out.set(target, incoming);
  }
  return out;
}

function isChunkCommitBoundaryNode(state: State, nodeId: string): boolean {
  const meta = state.handles.get(nodeId)?.meta ?? {};
  return (
    meta.chunk_commit_boundary === 1 ||
    meta.chunk_commit_boundary === true ||
    meta.chunkCommitBoundary === 1 ||
    meta.chunkCommitBoundary === true
  );
}

function collectCurrentChunkLineage(state: State, terminalNodeId: string): string[] {
  const predecessors = buildContPredecessorIndex(state);
  const visited = new Set<string>([terminalNodeId]);
  const queue: string[] = [terminalNodeId];
  const lineage: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    const isBoundary = isChunkCommitBoundaryNode(state, current);
    if (current !== terminalNodeId && isBoundary) {
      continue;
    }

    lineage.push(current);
    if (isBoundary) {
      continue;
    }

    for (const previous of predecessors.get(current) ?? []) {
      if (visited.has(previous)) {
        continue;
      }
      visited.add(previous);
      queue.push(previous);
    }
  }

  return lineage;
}

function closeOpenCarriesAtHardBoundary(state: State, terminalNodeId: string): void {
  const lineage = collectCurrentChunkLineage(state, terminalNodeId);
  if (lineage.length === 0) {
    return;
  }

  const lineageSet = new Set<string>(lineage);
  const incomingCarryByTarget = buildIncomingCarryIndex(state);
  const sourcesToClose = new Set<string>();

  for (const target of lineage) {
    const incoming = incomingCarryByTarget.get(target) ?? [];
    for (const carry of incoming) {
      if (!lineageSet.has(carry.source)) {
        continue;
      }
      if (carry.source === terminalNodeId) {
        continue;
      }
      if (
        isCarryUnresolved(state, carry.source, carry.target, {
          focusNodeId: terminalNodeId
        })
      ) {
        sourcesToClose.add(carry.source);
      }
    }
  }

  for (const source of sourcesToClose) {
    addSupp(state, terminalNodeId, source);
  }
}

function markChunkCommitBoundary(state: State, terminalNodeId: string): void {
  const terminal = state.handles.get(terminalNodeId);
  if (!terminal) {
    return;
  }
  terminal.meta = { ...(terminal.meta ?? {}), chunk_commit_boundary: 1 };
}

function closeOpenMemBoundariesAtWordBoundary(
  state: State,
  reason: "hard" | "glue" | "glue_maqqef" | "cut" | "sof_pasuk"
): void {
  for (let index = state.boundaries.length - 1; index >= 0; index -= 1) {
    const boundary = state.boundaries[index];
    if (boundary.kind !== "mem_enclosure" || !isBoundaryOpen(boundary)) {
      continue;
    }
    closeBoundaryRecord(state, boundary.id, {
      close_mode: "word_boundary",
      closed_by: reason
    });
    state.vm.H.push({
      type: "mem_auto_close",
      tau: state.vm.tau,
      data: {
        id: boundary.id,
        inside: boundary.inside,
        outside: boundary.outside,
        reason
      }
    });
  }
}

function dropPendingJoinsAtSofPasuq(state: State): void {
  const pendingJoin = state.vm.PendingJoin;
  if (!pendingJoin) {
    return;
  }

  state.vm.PendingJoin = undefined;
  state.vm.H.push({
    type: "join_drop",
    tau: state.vm.tau,
    data: {
      joinId: pendingJoin.id,
      joinIds: [pendingJoin.id],
      reason: "sof_pasuk"
    }
  });
}

function nextChunkId(state: State): string {
  const seq = state.vm.H_phrase.length + state.vm.H_committed.length + 1;
  return `chunk:${state.vm.tau}:${seq}`;
}

function nextJoinId(state: State): string {
  return `join:${state.vm.tau}:${state.vm.A.length + 1}`;
}

function nextConstituentNodeId(state: State, rank: number): string {
  return `cut${rank}:${state.vm.tau}:${Object.keys(state.vm.CNodes).length}`;
}

function sealWord(state: State): string {
  if (!state.vm.wordHasContent) {
    return BOT_ID;
  }
  if (state.vm.wordLastSealedArtifact) {
    return state.vm.wordLastSealedArtifact;
  }
  return state.vm.F;
}

function baselineReset(state: State): void {
  state.vm.F = state.vm.D;
  state.vm.R = BOT_ID;
  state.vm.K = [state.vm.F, state.vm.R];
  state.vm.wordEntryFocus = state.vm.F;
}

function resolveObligationsByDefault(state: State): void {
  while (state.vm.OStack_word.length > 0) {
    const obligation = state.vm.OStack_word.pop();
    if (!obligation) {
      break;
    }
    if (obligation.kind === "BOUNDARY") {
      const boundaryId = nextId(state, "□");
      state.handles.set(
        boundaryId,
        createHandle(boundaryId, "boundary", {
          anchor: 1,
          meta: { inside: obligation.child, outside: obligation.parent, closedBy: "space" }
        })
      );
      addBoundary(state, boundaryId, obligation.child, obligation.parent, 1);
      state.vm.H.push({
        type: "boundary_auto_close",
        tau: state.vm.tau,
        data: { id: boundaryId, inside: obligation.child, outside: obligation.parent }
      });
      state.vm.R = obligation.child;
      state.vm.F = obligation.parent;
      continue;
    }
    throw new RuntimeError(`Unknown obligation kind '${obligation.kind}'`);
  }
}

function resolveObligationsStrict(state: State, rank: number): void {
  while (state.vm.OStack_word.length > 0) {
    const obligation = state.vm.OStack_word.pop();
    if (!obligation) {
      break;
    }
    if (obligation.kind === "BOUNDARY") {
      const boundaryId = nextId(state, "□");
      state.handles.set(
        boundaryId,
        createHandle(boundaryId, "boundary", {
          anchor: 1,
          meta: {
            inside: obligation.child,
            outside: obligation.parent,
            closedBy: "cut",
            rank
          }
        })
      );
      addBoundary(state, boundaryId, obligation.child, obligation.parent, 1);
      state.vm.H.push({
        type: "boundary_cut_close",
        tau: state.vm.tau,
        data: { id: boundaryId, inside: obligation.child, outside: obligation.parent, rank }
      });
      continue;
    }

    throw new RuntimeError(`Unknown obligation kind '${obligation.kind}'`);
  }
}

function appendChunk(
  state: State,
  args: {
    mode: "hard" | "glue" | "cut" | "glue_maqqef";
    rank: number | null;
    continuation: boolean;
    wordValue: string;
    pendingJoinCreated?: string;
  }
): PhraseChunk {
  const chunk: PhraseChunk = {
    id: nextChunkId(state),
    start_event_index: state.vm.lastBoundaryEventIndex,
    end_event_index: state.vm.H.length,
    tau: state.vm.tau,
    boundary_mode: args.mode,
    rank: args.rank,
    continuation: args.continuation,
    word_value: args.wordValue,
    pending_join_created: args.pendingJoinCreated,
    pending_join_consumed: state.vm.lastPendingJoinConsumedId,
    barrier: state.vm.LeftContextBarrier
  };
  state.vm.lastBoundaryEventIndex = state.vm.H.length;
  state.vm.lastPendingJoinConsumedId = undefined;
  return chunk;
}

function flushPhraseToCommitted(state: State): void {
  if (state.vm.H_phrase.length === 0) {
    return;
  }
  state.vm.H_committed.push(...state.vm.H_phrase);
  state.vm.H_phrase = [];
}

function emitConstituentNode(state: State, rank: number): void {
  while (state.vm.CStack.length > 1) {
    const top = state.vm.CStack[state.vm.CStack.length - 1];
    if (top.rank > rank) {
      break;
    }
    state.vm.CStack.pop();
  }

  const parent = state.vm.CStack[state.vm.CStack.length - 1] ?? { node_id: "ROOT", rank: Infinity };
  const nodeId = nextConstituentNodeId(state, rank);
  state.vm.CNodes[nodeId] = {
    id: nodeId,
    rank,
    parent_id: parent.node_id,
    children: [],
    word_values: [...state.vm.phraseWordValues],
    chunk_ids: [...state.vm.phraseChunkIds],
    tau_sealed: state.vm.tau
  };

  const parentNode = state.vm.CNodes[parent.node_id];
  if (parentNode) {
    parentNode.children.push(nodeId);
  }

  state.vm.CStack.push({ rank, node_id: nodeId });
  state.vm.phraseWordValues = [];
  state.vm.phraseChunkIds = [];
}

function settleWordBoundaryState(state: State): void {
  state.vm.wordHasContent = false;
  state.vm.wordLastSealedArtifact = undefined;
  state.vm.activeConstruct = undefined;
  delete state.vm.route_mode;
  delete state.vm.route_arity;
}

function applyHard(state: State, transition: BoundaryTransitionArgs): void {
  const terminalFocus = state.vm.F;
  state.vm.tau += 1;
  closeOpenCarriesAtHardBoundary(state, terminalFocus);
  markChunkCommitBoundary(state, terminalFocus);
  closeOpenMemBoundariesAtWordBoundary(state, "hard");

  resolveObligationsByDefault(state);
  const wordValue = sealWord(state);
  state.vm.A.push(wordValue);

  const chunk = appendChunk(state, {
    mode: "hard",
    rank: null,
    continuation: false,
    wordValue
  });

  flushPhraseToCommitted(state);
  state.vm.H_committed.push(chunk);
  state.vm.phraseWordValues = [];
  state.vm.phraseChunkIds = [];
  state.vm.PendingJoin = undefined;
  state.vm.LeftContextBarrier = null;

  applyBoundaryTransition(state, transition);
  settleWordBoundaryState(state);
  baselineReset(state);
  state.vm.OStack_word = [];
  state.vm.segment.OStack = state.vm.OStack_word;
  collectGarbage(state);
}

function applyGlue(
  state: State,
  mode: "glue" | "glue_maqqef",
  transition: BoundaryTransitionArgs
): void {
  // Glue boundaries are pure continuation: no carry closure and no chunk-boundary marking.
  state.vm.tau += 1;
  closeOpenMemBoundariesAtWordBoundary(state, mode);

  const wordValue = sealWord(state);
  state.vm.A.push(wordValue);

  const joinId = nextJoinId(state);
  state.vm.PendingJoin = {
    id: joinId,
    left_span_handle: wordValue,
    join_strength: mode === "glue_maqqef" ? "maqqef" : "conj",
    exported_pins: []
  };

  const chunk = appendChunk(state, {
    mode,
    rank: null,
    continuation: true,
    wordValue,
    pendingJoinCreated: joinId
  });

  state.vm.H_phrase.push(chunk);
  state.vm.phraseWordValues.push(wordValue);
  state.vm.phraseChunkIds.push(chunk.id);
  applyBoundaryTransition(state, transition);
  settleWordBoundaryState(state);
}

function applyCut(
  state: State,
  rankRaw: number | null | undefined,
  transition: Omit<BoundaryTransitionArgs, "rank">
): void {
  const terminalFocus = state.vm.F;
  const rank = Math.max(1, Math.trunc(Number(rankRaw ?? 1)));
  state.vm.tau += rank;
  closeOpenCarriesAtHardBoundary(state, terminalFocus);
  markChunkCommitBoundary(state, terminalFocus);
  closeOpenMemBoundariesAtWordBoundary(state, rank >= 3 ? "sof_pasuk" : "cut");

  if (rank >= 3) {
    dropPendingJoinsAtSofPasuq(state);
  }

  resolveObligationsStrict(state, rank);
  const wordValue = sealWord(state);
  state.vm.A.push(wordValue);

  const chunk = appendChunk(state, {
    mode: "cut",
    rank,
    continuation: false,
    wordValue
  });
  state.vm.H_phrase.push(chunk);
  state.vm.phraseWordValues.push(wordValue);
  state.vm.phraseChunkIds.push(chunk.id);

  emitConstituentNode(state, rank);
  state.vm.PendingJoin = undefined;
  state.vm.LeftContextBarrier = rank;
  applyBoundaryTransition(state, { ...transition, rank });
  settleWordBoundaryState(state);
  baselineReset(state);
  state.vm.OStack_word = [];
  state.vm.segment.OStack = state.vm.OStack_word;

  if (rank >= 2) {
    if (state.vm.E.length > 0) {
      state.vm.E.pop();
    }
  }

  if (rank >= 3) {
    state.vm.E = [];
    flushPhraseToCommitted(state);
    state.vm.CStack = [{ rank: Number.MAX_SAFE_INTEGER, node_id: "ROOT" }];
  }

  collectGarbage(state);
}

// Wrapper hygiene/flush behavior that consumes LayoutIR must follow
// spec/LAYOUT_OBLIGATIONS.md (determinism, anchoring, no semantic overreach).
export function applySpace(state: State, options: ApplySpaceOptions = {}): void {
  const mode = options.mode ?? "hard";
  const beforeFocus = state.vm.F;
  const segmentIdBefore = state.vm.segment.segmentId;
  const transition = {
    tropeInfo: options.leftTrope ?? null
  };
  if (mode === "glue" || mode === "glue_maqqef") {
    applyGlue(state, mode, { ...transition, exitKind: mode });
  } else if (mode === "cut") {
    applyCut(state, options.rank, { ...transition, exitKind: mode });
  } else {
    applyHard(state, { ...transition, exitKind: mode });
  }
  state.vm.H.push({
    type: "BOUNDARY",
    tau: state.vm.tau,
    data: {
      mode,
      beforeFocus,
      afterFocus: state.vm.F,
      segmentIdBefore
    }
  });
}
