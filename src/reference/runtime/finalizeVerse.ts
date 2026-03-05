import { BOT_ID, OMEGA_ID, Handle, createHandle } from "../state/handles";
import { State, serializeState } from "../state/state";
import { applyBoundaryTransition } from "../vm/domainTransition";
import { validateBaseline } from "./validateBaseline";

export type FinalizeVerseOptions = {
  ref?: string;
  cleaned?: string;
  keepSystemHandles?: Set<string>;
  preserveCounters?: boolean;
  validateBaseline?: boolean;
};

export type VerseSnapshotMetrics = {
  handles: number;
  links: number;
  boundaries: number;
  rules: number;
  events: number;
};

export type VerseSnapshot = {
  ref: string;
  cleaned: string;
  tau_end: number;
  metrics: VerseSnapshotMetrics;
  state_dump: Record<string, any>;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function cloneHandle(handle: Handle): Handle {
  return {
    ...handle,
    envelope: {
      ...handle.envelope,
      ports: new Set(handle.envelope.ports)
    },
    meta: { ...(handle.meta ?? {}) }
  };
}

function sortLinks(links: Array<{ from: string; to: string; label: string }>): void {
  links.sort((left, right) => {
    const fromOrder = compareText(String(left.from), String(right.from));
    if (fromOrder !== 0) {
      return fromOrder;
    }
    const toOrder = compareText(String(left.to), String(right.to));
    if (toOrder !== 0) {
      return toOrder;
    }
    return compareText(String(left.label), String(right.label));
  });
}

function sortBoundaries(
  boundaries: Array<{ inside: string; outside: string; anchor: 0 | 1; id: string }>
): void {
  boundaries.sort((left, right) => {
    const idOrder = compareText(String(left.id), String(right.id));
    if (idOrder !== 0) {
      return idOrder;
    }
    const insideOrder = compareText(String(left.inside), String(right.inside));
    if (insideOrder !== 0) {
      return insideOrder;
    }
    const outsideOrder = compareText(String(left.outside), String(right.outside));
    if (outsideOrder !== 0) {
      return outsideOrder;
    }
    return Number(left.anchor) - Number(right.anchor);
  });
}

function sortRules(
  rules: Array<{ id: string; target: string; patch: any; priority: number }>
): void {
  rules.sort((left, right) => {
    const priorityOrder = Number(left.priority) - Number(right.priority);
    if (priorityOrder !== 0) {
      return priorityOrder;
    }
    const idOrder = compareText(String(left.id), String(right.id));
    if (idOrder !== 0) {
      return idOrder;
    }
    return compareText(String(left.target), String(right.target));
  });
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort(compareText)) {
    out[key] = sortKeysDeep(record[key]);
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    deepFreeze(item);
  }
  return value;
}

function rootNodeBaseline() {
  return {
    ROOT: {
      id: "ROOT",
      rank: Number.MAX_SAFE_INTEGER,
      parent_id: null,
      children: [],
      word_values: [],
      chunk_ids: [],
      tau_sealed: 0
    }
  };
}

function buildStateDump(state: State): Record<string, any> {
  const dump = serializeState(state);

  dump.handles.sort((left: { id: string }, right: { id: string }) =>
    compareText(String(left.id), String(right.id))
  );
  dump.cont.sort((left: string, right: string) => compareText(String(left), String(right)));
  sortLinks(dump.links);
  sortBoundaries(dump.boundaries);
  sortRules(dump.rules);

  return sortKeysDeep(dump) as Record<string, any>;
}

function resetHandles(state: State, keepSystemHandles: Set<string>): void {
  const keepIds = Array.from(keepSystemHandles).sort(compareText);
  const extra = new Map<string, Handle>();

  for (const handleId of keepIds) {
    if (handleId === OMEGA_ID || handleId === BOT_ID) {
      continue;
    }
    const handle = state.handles.get(handleId);
    if (handle) {
      extra.set(handleId, cloneHandle(handle));
    }
  }

  const next = new Map<string, Handle>();
  next.set(OMEGA_ID, createHandle(OMEGA_ID, "scope"));
  next.set(BOT_ID, createHandle(BOT_ID, "empty"));
  for (const handleId of keepIds) {
    const handle = extra.get(handleId);
    if (!handle) {
      continue;
    }
    next.set(handleId, handle);
  }
  state.handles = next;
}

function resetRuntimeState(state: State, opts: FinalizeVerseOptions): void {
  const keepSystemHandles = new Set(opts.keepSystemHandles ?? [OMEGA_ID, BOT_ID]);
  keepSystemHandles.add(OMEGA_ID);
  keepSystemHandles.add(BOT_ID);

  const preservedMetaCounter =
    opts.preserveCounters && state.vm.metaCounter ? { ...state.vm.metaCounter } : undefined;

  state.vm.tau = 0;
  applyBoundaryTransition(state, { exitKind: "runtime_reset" });
  state.vm.F = OMEGA_ID;
  state.vm.R = BOT_ID;
  state.vm.K = [OMEGA_ID, BOT_ID];
  state.vm.E = [];
  state.vm.W = [];
  const segmentOStack: State["vm"]["OStack_word"] = [];
  state.vm.segment = {
    segmentId: 0,
    OStack: segmentOStack
  };
  state.vm.OStack_word = segmentOStack;
  state.vm.H = [];
  state.vm.A = [];
  state.vm.aliasEdges = [];
  state.vm.activeConstruct = undefined;
  state.vm.wordHasContent = false;
  state.vm.wordLastSealedArtifact = undefined;
  state.vm.wordEntryFocus = OMEGA_ID;
  state.vm.H_phrase = [];
  state.vm.H_committed = [];
  state.vm.PendingJoin = undefined;
  state.vm.LeftContextBarrier = null;
  state.vm.CStack = [{ rank: Number.MAX_SAFE_INTEGER, node_id: "ROOT" }];
  state.vm.CNodes = rootNodeBaseline();
  state.vm.phraseWordValues = [];
  state.vm.phraseChunkIds = [];
  state.vm.lastBoundaryEventIndex = 0;
  state.vm.lastPendingJoinConsumedId = undefined;
  delete state.vm.route_mode;
  delete state.vm.route_arity;

  if (preservedMetaCounter) {
    state.vm.metaCounter = preservedMetaCounter;
  } else {
    delete state.vm.metaCounter;
  }

  state.links = [];
  state.boundaries = [];
  state.rules = [];
  state.cont = new Set();
  resetHandles(state, keepSystemHandles);
}

function collectSnapshotMetrics(state: State): VerseSnapshotMetrics {
  return {
    handles: state.handles.size,
    links: state.links.length,
    boundaries: state.boundaries.length,
    rules: state.rules.length,
    events: state.vm.H.length
  };
}

function shouldValidateBaseline(opts: FinalizeVerseOptions): boolean {
  if (typeof opts.validateBaseline === "boolean") {
    return opts.validateBaseline;
  }
  return process.env.NODE_ENV !== "production";
}

export function finalizeVerse(state: State, opts: FinalizeVerseOptions = {}): VerseSnapshot {
  const snapshot: VerseSnapshot = {
    ref: opts.ref ?? "",
    cleaned: opts.cleaned ?? "",
    tau_end: state.vm.tau,
    metrics: collectSnapshotMetrics(state),
    state_dump: buildStateDump(state)
  };
  deepFreeze(snapshot);
  resetRuntimeState(state, opts);
  if (shouldValidateBaseline(opts)) {
    validateBaseline(state, {
      keepSystemHandles: opts.keepSystemHandles,
      preserveCounters: opts.preserveCounters,
      context: snapshot.ref ? `finalizeVerse(${snapshot.ref})` : "finalizeVerse"
    });
  }
  return snapshot;
}
