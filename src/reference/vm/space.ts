import { SpaceBoundaryMode, Trope } from "../compile/types";
import { isCarryUnresolved } from "../state/eff";
import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary, addSupp, closeMemZoneSilently } from "../state/relations";
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

type MemZoneFlushRecord = {
  zoneId: string;
  anchor: string | null;
  handleIds: Set<string>;
};

type CarryEdge = {
  source: string;
  target: string;
};

function sortIdsStable(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

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

function asHandleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clearMemSpillFlags(meta: Record<string, any>): Record<string, any> {
  const next = { ...meta };
  delete next.unresolved;
  delete next.spilled;
  delete next.cut_rank;
  return next;
}

function collectMemZonesForSofPasuq(state: State): Map<string, MemZoneFlushRecord> {
  const records = new Map<string, MemZoneFlushRecord>();

  const note = (zoneIdRaw: unknown, anchorRaw: unknown, handleIdRaw?: unknown): void => {
    const zoneId = asHandleId(zoneIdRaw);
    if (!zoneId) {
      return;
    }
    const anchor = asHandleId(anchorRaw);
    const handleId = asHandleId(handleIdRaw);
    const existing = records.get(zoneId);
    if (existing) {
      if (!existing.anchor && anchor) {
        existing.anchor = anchor;
      }
      if (handleId) {
        existing.handleIds.add(handleId);
      }
      return;
    }
    const record: MemZoneFlushRecord = {
      zoneId,
      anchor: anchor ?? null,
      handleIds: new Set<string>()
    };
    if (handleId) {
      record.handleIds.add(handleId);
    }
    records.set(zoneId, record);
  };

  for (const obligation of state.vm.OStack_word) {
    if (obligation.kind !== "MEM_ZONE") {
      continue;
    }
    note(obligation.child, obligation.payload?.anchor ?? obligation.parent, obligation.child);
  }

  for (const handle of state.handles.values()) {
    const meta = handle.meta ?? {};
    const obligationKind = meta.obligation;
    if (obligationKind === "MEM_ZONE") {
      note(meta.zone ?? handle.id, meta.anchor ?? meta.parent, handle.id);
    }

    if (handle.kind !== "memZone") {
      continue;
    }
    const isOpen = meta.closed !== 1 || meta.unresolved === 1 || meta.spilled === 1;
    if (!isOpen && obligationKind !== "MEM_ZONE") {
      continue;
    }
    note(handle.id, meta.anchor, handle.id);
  }

  return records;
}

function scrubFlushedMemZoneRefs(state: State, removedHandles: Set<string>): void {
  if (removedHandles.size === 0) {
    return;
  }
  const isRemoved = (id: string | undefined): boolean =>
    typeof id === "string" && removedHandles.has(id);
  const remapToBot = (id: string): string => (removedHandles.has(id) ? BOT_ID : id);

  state.vm.OStack_word = state.vm.OStack_word.filter(
    (obligation) => !isRemoved(obligation.parent) && !isRemoved(obligation.child)
  );
  state.vm.segment.OStack = state.vm.OStack_word;

  if (isRemoved(state.vm.F)) {
    state.vm.F = state.vm.D;
  }
  if (isRemoved(state.vm.R)) {
    state.vm.R = BOT_ID;
  }

  state.vm.K = state.vm.K.map(remapToBot);
  if (!state.vm.K.includes(state.vm.F)) {
    state.vm.K.unshift(state.vm.F);
  }
  if (!state.vm.K.includes(state.vm.R)) {
    state.vm.K.push(state.vm.R);
  }

  state.vm.W = state.vm.W.map(remapToBot);
  state.vm.A = state.vm.A.map(remapToBot);
  state.vm.phraseWordValues = state.vm.phraseWordValues.map(remapToBot);

  state.vm.E = state.vm.E.map((frame) => ({
    ...frame,
    F: isRemoved(frame.F) ? state.vm.D : frame.F,
    D_frame: isRemoved(frame.D_frame) ? state.vm.D : frame.D_frame
  }));

  if (state.vm.wordLastSealedArtifact && isRemoved(state.vm.wordLastSealedArtifact)) {
    state.vm.wordLastSealedArtifact = undefined;
  }
  if (state.vm.activeConstruct && isRemoved(state.vm.activeConstruct)) {
    state.vm.activeConstruct = undefined;
  }
  if (state.vm.wordEntryFocus && isRemoved(state.vm.wordEntryFocus)) {
    state.vm.wordEntryFocus = state.vm.F;
  }

  if (state.vm.PendingJoin) {
    if (isRemoved(state.vm.PendingJoin.left_span_handle)) {
      state.vm.PendingJoin = undefined;
    } else {
      state.vm.PendingJoin.exported_pins = state.vm.PendingJoin.exported_pins.filter(
        (pin) => !isRemoved(pin)
      );
    }
  }

  for (const chunk of state.vm.H_phrase) {
    chunk.word_value = remapToBot(chunk.word_value);
  }
  for (const chunk of state.vm.H_committed) {
    chunk.word_value = remapToBot(chunk.word_value);
  }
  for (const node of Object.values(state.vm.CNodes)) {
    node.word_values = node.word_values.map(remapToBot);
  }

  state.cont = new Set(
    Array.from(state.cont).filter((edge) => {
      const [from, to] = edge.split("->");
      return !isRemoved(from) && !isRemoved(to);
    })
  );
  state.carry = new Set(
    Array.from(state.carry).filter((edge) => {
      const [from, to] = edge.split("->");
      return !isRemoved(from) && !isRemoved(to);
    })
  );
  state.supp = new Set(
    Array.from(state.supp).filter((edge) => {
      const [from, to] = edge.split("->");
      return !isRemoved(from) && !isRemoved(to);
    })
  );
  state.sub = new Set(
    Array.from(state.sub).filter((edge) => {
      const [from, to] = edge.split("->");
      return !isRemoved(from) && !isRemoved(to);
    })
  );
  state.links = state.links.filter((link) => !isRemoved(link.from) && !isRemoved(link.to));
  state.vm.aliasEdges = state.vm.aliasEdges.filter(
    (edge) => !isRemoved(edge.from) && !isRemoved(edge.to)
  );
  state.boundaries = state.boundaries.filter(
    (boundary) =>
      !isRemoved(boundary.id) && !isRemoved(boundary.inside) && !isRemoved(boundary.outside)
  );
  state.rules = state.rules.filter((rule) => !isRemoved(rule.target));
}

function flushMemZonesAtSofPasuq(state: State): void {
  const records = collectMemZonesForSofPasuq(state);
  if (records.size === 0) {
    return;
  }

  state.vm.OStack_word = state.vm.OStack_word.filter(
    (obligation) => obligation.kind !== "MEM_ZONE"
  );
  state.vm.segment.OStack = state.vm.OStack_word;

  const removedHandles = new Set<string>();
  const zoneIds = Array.from(records.keys()).sort(sortIdsStable);

  for (const zoneId of zoneIds) {
    const record = records.get(zoneId);
    if (!record) {
      continue;
    }

    const zoneHandle = state.handles.get(zoneId);
    if (zoneHandle) {
      const zoneMeta = clearMemSpillFlags(zoneHandle.meta ?? {});
      zoneHandle.meta = { ...zoneMeta, closed: 1, flushed_by: "sof_pasuk" };
      record.handleIds.add(zoneId);
      if (!record.anchor) {
        record.anchor = asHandleId(zoneMeta.anchor);
      }
    }

    for (const handleId of record.handleIds) {
      const handle = state.handles.get(handleId);
      if (!handle) {
        continue;
      }
      const metaBefore = handle.meta ?? {};
      handle.meta = clearMemSpillFlags(metaBefore);
      if (handle.kind === "memZone" || metaBefore.obligation === "MEM_ZONE") {
        removedHandles.add(handleId);
      }
    }

    state.vm.H.push({
      type: "mem_zone_flush",
      tau: state.vm.tau,
      data: { zoneId, anchor: record.anchor ?? null, reason: "sof_pasuk" }
    });
  }

  scrubFlushedMemZoneRefs(state, removedHandles);
  for (const handleId of Array.from(removedHandles).sort(sortIdsStable)) {
    state.handles.delete(handleId);
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
    if (obligation.kind === "MEM_ZONE") {
      closeMemZoneSilently(state, obligation.child);
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

  if (rank >= 3) {
    dropPendingJoinsAtSofPasuq(state);
    flushMemZonesAtSofPasuq(state);
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
