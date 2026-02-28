import { OMEGA_ID } from "../state/handles";
import { State } from "../state/state";

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

export function extractCarryState(state: State, mode: VerseBoundaryMode): CarryState {
  if (mode === "reset") {
    return {};
  }

  const carry: CarryState = {
    omegaHandleId: OMEGA_ID
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

  if (domainHandleId) {
    state.vm.D = domainHandleId;
  } else if (omegaHandleId) {
    state.vm.D = omegaHandleId;
  }

  if (focusHandleId) {
    state.vm.F = focusHandleId;
  } else if (omegaHandleId) {
    state.vm.F = omegaHandleId;
  }

  if (omegaHandleId) {
    state.vm.wordEntryFocus = omegaHandleId;
  }

  // Reserved for later tasks where pinned handles become carry-participating.
  if (pinnedHandleIds && pinnedHandleIds.length > 0) {
    void pinnedHandleIds;
  }
}

export function onVerseEnd(ref: string, state: State, mode: VerseBoundaryMode): CarryState {
  void ref;
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
