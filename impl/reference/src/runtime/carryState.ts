import { BOT_ID, OMEGA_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { addLink } from "../state/relations";

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

type StateWithOmega = State & {
  Omega?: string;
};

function getStateOmegaId(state: State): string {
  const pointer = normalizeHandleId((state as StateWithOmega).Omega);
  return pointer ?? OMEGA_ID;
}

function setStateOmegaId(state: State, omegaHandleId: string): void {
  (state as StateWithOmega).Omega = omegaHandleId;
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
  return Array.from(state.handles.keys())
    .filter(
      (handleId) => handleId !== BOT_ID && handleId !== OMEGA_ID && handleId !== omegaHandleId
    )
    .sort(compareText);
}

function ensureHandleExists(state: State, handleId: string): void {
  if (state.handles.has(handleId)) {
    return;
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
    ensureHandleExists(state, domainHandleId);
    state.vm.D = domainHandleId;
  }

  if (focusHandleId) {
    ensureHandleExists(state, focusHandleId);
    state.vm.F = focusHandleId;
  }

  // Reserved for later tasks where pinned handles become carry-participating.
  if (pinnedHandleIds && pinnedHandleIds.length > 0) {
    void pinnedHandleIds;
  }
}

export function onVerseEnd(ref: string, state: State, mode: VerseBoundaryMode): CarryState {
  finalizeVerseScope(state, ref);
  return extractCarryState(state, mode);
}

export function onVerseStart(
  ref: string,
  state: State,
  mode: VerseBoundaryMode,
  carryState: CarryState
): void {
  void ref;
  if (mode === "reset") {
    return;
  }
  applyCarryState(state, carryState);
}
