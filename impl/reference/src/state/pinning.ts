import type { State } from "./state";

function normalizeHandleId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function pinHandle(state: State, id: string): void {
  const handleId = normalizeHandleId(id);
  if (!handleId) {
    return;
  }
  const handle = state.handles.get(handleId);
  if (!handle) {
    return;
  }
  handle.pinned = true;
  handle.meta = { ...handle.meta, pinned: true };
}

export function isPinned(state: State, id: string): boolean {
  const handleId = normalizeHandleId(id);
  if (!handleId) {
    return false;
  }
  const handle = state.handles.get(handleId);
  if (!handle) {
    return false;
  }
  return handle.pinned === true || handle.meta?.pinned === true;
}

export function listPinned(state: State): string[] {
  return Array.from(state.handles.keys())
    .filter((handleId) => isPinned(state, handleId))
    .sort(compareText);
}
