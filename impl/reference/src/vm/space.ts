import { SpaceBoundaryMode } from "../compile/types";
import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary, closeMemZoneSilently } from "../state/relations";
import { PhraseChunk, State } from "../state/state";
import { collectGarbage } from "./gc";
import { RuntimeError } from "./errors";
import { nextId } from "./ids";

type ApplySpaceOptions = {
  mode?: SpaceBoundaryMode;
  rank?: number | null;
};

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
  state.vm.F = state.vm.Omega;
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
    if (obligation.kind === "MEM_ZONE") {
      closeMemZoneSilently(state, obligation.child);
      continue;
    }
    if (obligation.kind === "SUPPORT") {
      state.vm.H.push({
        type: "fall",
        tau: state.vm.tau,
        data: { child: obligation.child, parent: obligation.parent }
      });
      state.vm.R = obligation.child;
      state.vm.F = obligation.parent;
      continue;
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
    if (obligation.kind === "MEM_ZONE") {
      const zone = state.handles.get(obligation.child);
      if (zone) {
        zone.meta = { ...zone.meta, spilled: 1, unresolved: 1, cut_rank: rank };
      }
      const spillNode = nextId(state, "mem_spill");
      state.handles.set(
        spillNode,
        createHandle(spillNode, "structured", {
          meta: {
            obligation: "MEM_ZONE",
            mode: "spill",
            zone: obligation.child,
            parent: obligation.parent,
            rank
          }
        })
      );
      state.vm.H.push({
        type: "mem_spill",
        tau: state.vm.tau,
        data: { node: spillNode, zone: obligation.child, parent: obligation.parent, rank }
      });
      continue;
    }

    if (obligation.kind === "SUPPORT") {
      const debtNode = nextId(state, "support_debt");
      state.handles.set(
        debtNode,
        createHandle(debtNode, "structured", {
          meta: {
            obligation: "SUPPORT",
            mode: "debt",
            child: obligation.child,
            parent: obligation.parent,
            rank
          }
        })
      );
      state.vm.H.push({
        type: "support_debt",
        tau: state.vm.tau,
        data: { node: debtNode, child: obligation.child, parent: obligation.parent, rank }
      });
      continue;
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
  delete state.vm.route_mode;
  delete state.vm.route_arity;
}

function applyHard(state: State): void {
  state.vm.tau += 1;

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

  settleWordBoundaryState(state);
  baselineReset(state);
  state.vm.OStack_word = [];
  collectGarbage(state);
}

function applyGlue(state: State, mode: "glue" | "glue_maqqef"): void {
  state.vm.tau += 1;

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
  settleWordBoundaryState(state);
}

function applyCut(state: State, rankRaw: number | null | undefined): void {
  const rank = Math.max(1, Math.trunc(Number(rankRaw ?? 1)));
  state.vm.tau += rank;

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
  settleWordBoundaryState(state);

  if (rank >= 2) {
    baselineReset(state);
    if (state.vm.E.length > 0) {
      state.vm.E.pop();
    }
  }

  if (rank >= 3) {
    baselineReset(state);
    state.vm.E = [];
    flushPhraseToCommitted(state);
    state.vm.CStack = [{ rank: Number.MAX_SAFE_INTEGER, node_id: "ROOT" }];
  }

  collectGarbage(state);
}

export function applySpace(state: State, options: ApplySpaceOptions = {}): void {
  const mode = options.mode ?? "hard";
  if (mode === "glue" || mode === "glue_maqqef") {
    applyGlue(state, mode);
    return;
  }
  if (mode === "cut") {
    applyCut(state, options.rank);
    return;
  }
  applyHard(state);
}
