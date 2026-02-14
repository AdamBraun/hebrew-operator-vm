import { BOT_ID, Handle, OMEGA_ID, createHandle } from "./handles";
import type { Envelope } from "./policies";

export type ObligationKind = "MEM_ZONE" | "SUPPORT" | "BOUNDARY";

export type Obligation = {
  kind: ObligationKind;
  parent: string;
  child: string;
  payload: Record<string, any>;
  tau_created: number;
};

export type VMEvent = { type: string; tau: number; data: any };

export type PhraseChunk = {
  id: string;
  start_event_index: number;
  end_event_index: number;
  tau: number;
  boundary_mode: "hard" | "glue" | "cut" | "glue_maqqef";
  rank: number | null;
  continuation: boolean;
  word_value: string;
  pending_join_created?: string;
  pending_join_consumed?: string;
  barrier: number | null;
};

export type PendingJoin = {
  id: string;
  left_span_handle: string;
  join_strength: "conj" | "maqqef";
  exported_pins: string[];
};

export type ConstituentNode = {
  id: string;
  rank: number;
  parent_id: string | null;
  children: string[];
  word_values: string[];
  chunk_ids: string[];
  tau_sealed: number;
};

export type VM = {
  tau: number;
  Omega: string;
  F: string;
  R: string;
  K: string[];
  E: Array<{ F: string; lambda: "student" | "group" | "class"; Omega_frame: string }>;
  W: string[];
  OStack_word: Obligation[];
  H: VMEvent[];
  A: string[];
  wordHasContent: boolean;
  wordLastSealedArtifact?: string;
  wordEntryFocus?: string;
  metaCounter?: Record<string, number>;
  route_mode?: "fork";
  route_arity?: number;
  H_phrase: PhraseChunk[];
  H_committed: PhraseChunk[];
  PendingJoin?: PendingJoin;
  LeftContextBarrier: number | null;
  CStack: Array<{ rank: number; node_id: string }>;
  CNodes: Record<string, ConstituentNode>;
  phraseWordValues: string[];
  phraseChunkIds: string[];
  lastBoundaryEventIndex: number;
  lastPendingJoinConsumedId?: string;
};

export type State = {
  vm: VM;
  handles: Map<string, Handle>;
  cont: Set<string>;
  links: Array<{ from: string; to: string; label: string }>;
  boundaries: Array<{ inside: string; outside: string; anchor: 0 | 1; id: string }>;
  rules: Array<{ id: string; target: string; patch: any; priority: number }>;
};

export function createInitialState(): State {
  const handles = new Map<string, Handle>();
  handles.set(OMEGA_ID, createHandle(OMEGA_ID, "scope"));
  handles.set(BOT_ID, createHandle(BOT_ID, "empty"));

  const vm: VM = {
    tau: 0,
    Omega: OMEGA_ID,
    F: OMEGA_ID,
    R: BOT_ID,
    K: [OMEGA_ID, BOT_ID],
    E: [],
    W: [],
    OStack_word: [],
    H: [],
    A: [],
    wordHasContent: false,
    wordLastSealedArtifact: undefined,
    wordEntryFocus: OMEGA_ID,
    H_phrase: [],
    H_committed: [],
    PendingJoin: undefined,
    LeftContextBarrier: null,
    CStack: [{ rank: Number.MAX_SAFE_INTEGER, node_id: "ROOT" }],
    CNodes: {
      ROOT: {
        id: "ROOT",
        rank: Number.MAX_SAFE_INTEGER,
        parent_id: null,
        children: [],
        word_values: [],
        chunk_ids: [],
        tau_sealed: 0
      }
    },
    phraseWordValues: [],
    phraseChunkIds: [],
    lastBoundaryEventIndex: 0,
    lastPendingJoinConsumedId: undefined
  };

  return {
    vm,
    handles,
    cont: new Set(),
    links: [],
    boundaries: [],
    rules: []
  };
}

export function serializeState(state: State): Record<string, any> {
  const serializeEnvelope = (envelope: Envelope): Record<string, any> => ({
    ...envelope,
    ports: Array.from(envelope.ports).sort()
  });
  const {
    wordLastSealedArtifact,
    wordEntryFocus: _wordEntryFocus,
    metaCounter,
    route_mode,
    route_arity,
    H_phrase: _H_phrase,
    H_committed: _H_committed,
    PendingJoin: _PendingJoin,
    LeftContextBarrier: _LeftContextBarrier,
    CStack: _CStack,
    CNodes: _CNodes,
    phraseWordValues: _phraseWordValues,
    phraseChunkIds: _phraseChunkIds,
    lastBoundaryEventIndex: _lastBoundaryEventIndex,
    lastPendingJoinConsumedId: _lastPendingJoinConsumedId,
    ...vmRest
  } = state.vm;
  const vm: Record<string, any> = { ...vmRest };
  if (wordLastSealedArtifact !== undefined) {
    vm.wordLastSealedArtifact = wordLastSealedArtifact;
  }
  if (metaCounter) {
    vm.metaCounter = { ...metaCounter };
  }
  if (route_mode !== undefined) {
    vm.route_mode = route_mode;
  }
  if (route_arity !== undefined) {
    vm.route_arity = route_arity;
  }
  return {
    vm,
    handles: Array.from(state.handles.entries())
      .map(([, handle]) => ({
        ...handle,
        envelope: serializeEnvelope(handle.envelope)
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    cont: Array.from(state.cont).sort(),
    links: [...state.links],
    boundaries: [...state.boundaries],
    rules: [...state.rules]
  };
}
