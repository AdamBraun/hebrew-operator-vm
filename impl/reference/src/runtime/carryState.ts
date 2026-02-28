import { BOT_ID, OMEGA_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { addLink } from "../state/relations";
import { listPinned, pinHandle } from "../state/pinning";

export const SUPPORTED_VERSE_BOUNDARY_MODES = [
  "reset",
  "carry_omega",
  "carry_omega_focus",
  "carry_omega_focus_domain"
] as const;

export type VerseBoundaryMode = (typeof SUPPORTED_VERSE_BOUNDARY_MODES)[number];

export const DEFAULT_VERSE_BOUNDARY_MODE: VerseBoundaryMode = "reset";

export type CarryState = {
  omegaHandleId?: string;
  focusHandleId?: string;
  domainHandleId?: string;
  pinnedHandleIds?: string[];
};

export type BoundaryCleanupRoots = {
  omegaHandleId?: string;
  focusHandleId?: string;
  domainHandleId?: string;
  pinnedHandleIds?: string[];
};

export type BoundaryCleanupResult = {
  keptCount: number;
  droppedCount: number;
};

export const SEMANTIC_EDGE_LABELS = ["*"] as const;

type StateWithOmega = State & {
  Omega?: string;
  __verseStartHandleIds?: Set<string>;
};

function getStateOmegaId(state: State): string {
  const pointer = normalizeHandleId((state as StateWithOmega).Omega);
  return pointer ?? OMEGA_ID;
}

function setStateOmegaId(state: State, omegaHandleId: string): void {
  (state as StateWithOmega).Omega = omegaHandleId;
}

function markVerseStartHandles(state: State): void {
  (state as StateWithOmega).__verseStartHandleIds = new Set(state.handles.keys());
}

function readVerseStartHandles(state: State): Set<string> | undefined {
  return (state as StateWithOmega).__verseStartHandleIds;
}

function clearVerseStartHandles(state: State): void {
  delete (state as StateWithOmega).__verseStartHandleIds;
}

function normalizeHandleId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePinnedHandleIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = normalizeHandleId(item);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function parseContEdge(edge: string): [string, string] | null {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    return null;
  }
  const from = edge.slice(0, pivot);
  const to = edge.slice(pivot + 2);
  if (!from || !to) {
    return null;
  }
  return [from, to];
}

function connect(adjacency: Map<string, Set<string>>, from: string, to: string): void {
  if (!adjacency.has(from) || !adjacency.has(to) || from === to) {
    return;
  }
  adjacency.get(from)?.add(to);
  adjacency.get(to)?.add(from);
}

function isSemanticEdgeLabel(label: string): boolean {
  const labels = SEMANTIC_EDGE_LABELS as readonly string[];
  return labels.includes("*") || labels.includes(label);
}

function remapOrBot(id: string, removed: Set<string>): string {
  return removed.has(id) ? BOT_ID : id;
}

function sanitizeRef(ref: string): string {
  return String(ref ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildVerseScopeHandleId(state: State, ref: string): string {
  const refSlug = sanitizeRef(ref);
  const baseId =
    refSlug.length > 0
      ? `Ωv:${refSlug}`
      : `Ωv:tau:${Math.max(0, Math.trunc(Number(state.vm.tau ?? 0)))}`;
  let candidate = baseId;
  let suffix = 1;

  while (state.handles.has(candidate)) {
    const existing = state.handles.get(candidate);
    if (existing?.meta?.verse_scope === 1) {
      return candidate;
    }
    candidate = `${baseId}:${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function collectProducedHandleIds(state: State, omegaHandleId: string): string[] {
  const verseStartHandles = readVerseStartHandles(state);
  return Array.from(state.handles.keys())
    .filter(
      (handleId) => handleId !== BOT_ID && handleId !== OMEGA_ID && handleId !== omegaHandleId
    )
    .filter((handleId) => !verseStartHandles || !verseStartHandles.has(handleId))
    .sort(compareText);
}

function ensureHandleExists(state: State, handleId: string): boolean {
  if (state.handles.has(handleId)) {
    return false;
  }
  state.handles.set(
    handleId,
    createHandle(handleId, "scope", {
      anchor: 1,
      meta: {
        carry_placeholder: 1
      }
    })
  );
  return true;
}

export function finalizeVerseScope(
  state: State,
  ref: string = ""
): {
  omegaHandleId: string;
} {
  const omegaHandleId = buildVerseScopeHandleId(state, ref);
  if (!state.handles.has(omegaHandleId)) {
    state.handles.set(
      omegaHandleId,
      createHandle(omegaHandleId, "boundary", {
        anchor: 1,
        meta: {
          verse_scope: 1,
          ref: ref || undefined
        }
      })
    );
  }

  const producedHandleIds = collectProducedHandleIds(state, omegaHandleId);
  for (const handleId of producedHandleIds) {
    addLink(state, handleId, omegaHandleId, "member_of");
  }

  setStateOmegaId(state, omegaHandleId);
  state.vm.wordEntryFocus = omegaHandleId;

  return { omegaHandleId };
}

function cleanupRootIds(roots: BoundaryCleanupRoots): string[] {
  const out = new Set<string>([OMEGA_ID, BOT_ID]);
  const omegaHandleId = normalizeHandleId(roots.omegaHandleId);
  const focusHandleId = normalizeHandleId(roots.focusHandleId);
  const domainHandleId = normalizeHandleId(roots.domainHandleId);
  const pinnedHandleIds = normalizePinnedHandleIds(roots.pinnedHandleIds) ?? [];

  if (omegaHandleId) {
    out.add(omegaHandleId);
  }
  if (focusHandleId) {
    out.add(focusHandleId);
  }
  if (domainHandleId) {
    out.add(domainHandleId);
  }
  for (const pinnedHandleId of pinnedHandleIds) {
    out.add(pinnedHandleId);
  }

  return Array.from(out);
}

function collectReachableHandles(
  adjacency: Map<string, Set<string>>,
  roots: readonly string[]
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const rootId of roots) {
    if (!adjacency.has(rootId) || reachable.has(rootId)) {
      continue;
    }
    reachable.add(rootId);
    queue.push(rootId);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (reachable.has(neighbor)) {
        continue;
      }
      reachable.add(neighbor);
      queue.push(neighbor);
    }
  }

  return reachable;
}

export function cleanupAtVerseBoundary(
  state: State,
  roots: BoundaryCleanupRoots
): BoundaryCleanupResult {
  if (state.handles.size === 0) {
    return { keptCount: 0, droppedCount: 0 };
  }

  const rootIds = cleanupRootIds(roots);
  const adjacency = new Map<string, Set<string>>();
  for (const handleId of state.handles.keys()) {
    adjacency.set(handleId, new Set<string>());
  }

  for (const link of state.links) {
    if (!isSemanticEdgeLabel(link.label)) {
      continue;
    }
    connect(adjacency, link.from, link.to);
  }
  for (const boundary of state.boundaries) {
    connect(adjacency, boundary.id, boundary.inside);
    connect(adjacency, boundary.id, boundary.outside);
    connect(adjacency, boundary.inside, boundary.outside);
  }
  for (const edge of state.cont) {
    const parsed = parseContEdge(edge);
    if (!parsed) {
      continue;
    }
    connect(adjacency, parsed[0], parsed[1]);
  }
  for (const edge of state.vm.aliasEdges) {
    connect(adjacency, edge.from, edge.to);
  }
  for (const rule of state.rules) {
    connect(adjacency, rule.id, rule.target);
  }

  const reachable = collectReachableHandles(adjacency, rootIds);
  const removed = new Set<string>();

  for (const [handleId, handle] of state.handles.entries()) {
    if (handle.kind === "memZone") {
      removed.add(handleId);
      continue;
    }
    if (!reachable.has(handleId)) {
      removed.add(handleId);
    }
  }

  if (removed.size === 0) {
    return {
      keptCount: state.handles.size,
      droppedCount: 0
    };
  }

  for (const handleId of removed) {
    state.handles.delete(handleId);
  }

  state.links = state.links.filter((link) => !removed.has(link.from) && !removed.has(link.to));
  state.boundaries = state.boundaries.filter(
    (boundary) =>
      !removed.has(boundary.id) && !removed.has(boundary.inside) && !removed.has(boundary.outside)
  );
  state.rules = state.rules.filter((rule) => !removed.has(rule.id) && !removed.has(rule.target));
  state.vm.aliasEdges = state.vm.aliasEdges.filter(
    (edge) => !removed.has(edge.from) && !removed.has(edge.to)
  );
  state.cont = new Set(
    Array.from(state.cont).filter((edge) => {
      const parsed = parseContEdge(edge);
      if (!parsed) {
        return true;
      }
      return !removed.has(parsed[0]) && !removed.has(parsed[1]);
    })
  );

  let fallbackDomain =
    normalizeHandleId(roots.domainHandleId) ?? normalizeHandleId(roots.omegaHandleId);
  if (!fallbackDomain || !state.handles.has(fallbackDomain)) {
    fallbackDomain = OMEGA_ID;
  }
  let fallbackFocus = normalizeHandleId(roots.focusHandleId) ?? fallbackDomain;
  if (!fallbackFocus || !state.handles.has(fallbackFocus)) {
    fallbackFocus = fallbackDomain;
  }
  const fallbackOmega = normalizeHandleId(roots.omegaHandleId) ?? OMEGA_ID;

  if (!state.handles.has(state.vm.D)) {
    state.vm.D = fallbackDomain;
  }
  if (!state.handles.has(state.vm.F)) {
    state.vm.F = fallbackFocus;
  }
  if (!state.handles.has(state.vm.R)) {
    state.vm.R = BOT_ID;
  }
  if (state.vm.wordEntryFocus && !state.handles.has(state.vm.wordEntryFocus)) {
    state.vm.wordEntryFocus = state.handles.has(fallbackOmega) ? fallbackOmega : fallbackDomain;
  }
  if (state.vm.wordLastSealedArtifact && !state.handles.has(state.vm.wordLastSealedArtifact)) {
    state.vm.wordLastSealedArtifact = undefined;
  }
  if (state.vm.activeConstruct && !state.handles.has(state.vm.activeConstruct)) {
    state.vm.activeConstruct = undefined;
  }

  state.vm.K = state.vm.K.map((handleId) => remapOrBot(handleId, removed));
  state.vm.W = state.vm.W.map((handleId) => remapOrBot(handleId, removed));
  state.vm.A = state.vm.A.map((handleId) => remapOrBot(handleId, removed));
  state.vm.phraseWordValues = state.vm.phraseWordValues.map((handleId) =>
    remapOrBot(handleId, removed)
  );

  if (state.vm.PendingJoin) {
    if (removed.has(state.vm.PendingJoin.left_span_handle)) {
      state.vm.PendingJoin = undefined;
    } else {
      state.vm.PendingJoin.exported_pins = state.vm.PendingJoin.exported_pins.filter(
        (handleId) => !removed.has(handleId)
      );
    }
  }

  state.vm.E = state.vm.E.map((frame) => ({
    ...frame,
    F: removed.has(frame.F) ? fallbackFocus : frame.F,
    D_frame: removed.has(frame.D_frame) ? fallbackDomain : frame.D_frame
  }));

  state.vm.OStack_word = state.vm.OStack_word.filter(
    (obligation) => !removed.has(obligation.parent) && !removed.has(obligation.child)
  );
  state.vm.segment.OStack = state.vm.OStack_word;
  for (const chunk of state.vm.H_phrase) {
    chunk.word_value = remapOrBot(chunk.word_value, removed);
  }
  for (const chunk of state.vm.H_committed) {
    chunk.word_value = remapOrBot(chunk.word_value, removed);
  }
  for (const node of Object.values(state.vm.CNodes)) {
    node.word_values = node.word_values.map((handleId) => remapOrBot(handleId, removed));
  }

  return {
    keptCount: state.handles.size,
    droppedCount: removed.size
  };
}

export function extractCarryState(state: State, mode: VerseBoundaryMode): CarryState {
  if (mode === "reset") {
    return {};
  }

  const carry: CarryState = {
    omegaHandleId: getStateOmegaId(state)
  };

  if (mode === "carry_omega_focus" || mode === "carry_omega_focus_domain") {
    carry.focusHandleId = state.vm.F;
  }
  if (mode === "carry_omega_focus_domain") {
    carry.domainHandleId = state.vm.D;
  }
  const pinnedHandleIds = listPinned(state);
  if (pinnedHandleIds.length > 0) {
    carry.pinnedHandleIds = pinnedHandleIds;
  }

  return carry;
}

export function applyCarryState(state: State, carry: CarryState): void {
  const omegaHandleId = normalizeHandleId(carry.omegaHandleId);
  const focusHandleId = normalizeHandleId(carry.focusHandleId);
  const domainHandleId = normalizeHandleId(carry.domainHandleId);
  const pinnedHandleIds = normalizePinnedHandleIds(carry.pinnedHandleIds);

  if (omegaHandleId) {
    ensureHandleExists(state, omegaHandleId);
    setStateOmegaId(state, omegaHandleId);
    state.vm.wordEntryFocus = omegaHandleId;
  }

  if (domainHandleId) {
    const domainFallbackApplied = ensureHandleExists(state, domainHandleId);
    if (domainFallbackApplied) {
      const domainHandle = state.handles.get(domainHandleId);
      if (domainHandle) {
        domainHandle.meta = { ...domainHandle.meta, carry_domain_fallback: 1 };
      }
    }
    if (!state.handles.has(domainHandleId)) {
      throw new Error(`Unable to restore domain handle from carry state: ${domainHandleId}`);
    }
    state.vm.D = domainHandleId;
  }

  if (focusHandleId) {
    const focusFallbackApplied = ensureHandleExists(state, focusHandleId);
    if (focusFallbackApplied) {
      const focusHandle = state.handles.get(focusHandleId);
      if (focusHandle) {
        focusHandle.meta = { ...focusHandle.meta, carry_focus_fallback: 1 };
      }
    }
    if (!state.handles.has(focusHandleId)) {
      throw new Error(`Unable to restore focus handle from carry state: ${focusHandleId}`);
    }
    state.vm.F = focusHandleId;
  }

  if (pinnedHandleIds && pinnedHandleIds.length > 0) {
    for (const pinnedHandleId of pinnedHandleIds) {
      ensureHandleExists(state, pinnedHandleId);
      pinHandle(state, pinnedHandleId);
    }
  }
}

function projectCarryStateForMode(mode: VerseBoundaryMode, carryState: CarryState): CarryState {
  const projected: CarryState = {
    omegaHandleId: carryState.omegaHandleId,
    pinnedHandleIds: carryState.pinnedHandleIds
  };
  if (mode === "carry_omega_focus" || mode === "carry_omega_focus_domain") {
    projected.focusHandleId = carryState.focusHandleId;
  }
  if (mode === "carry_omega_focus_domain") {
    projected.domainHandleId = carryState.domainHandleId;
  }
  return projected;
}

export function onVerseEnd(ref: string, state: State, mode: VerseBoundaryMode): CarryState {
  finalizeVerseScope(state, ref);
  const carryState = extractCarryState(state, mode);
  if (mode !== "reset") {
    cleanupAtVerseBoundary(state, carryState);
  }
  clearVerseStartHandles(state);
  return carryState;
}

export function onVerseStart(
  ref: string,
  state: State,
  mode: VerseBoundaryMode,
  carryState: CarryState
): void {
  void ref;
  if (mode === "reset") {
    markVerseStartHandles(state);
    return;
  }
  applyCarryState(state, projectCarryStateForMode(mode, carryState));
  markVerseStartHandles(state);
}
