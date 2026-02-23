import { BOT_ID, OMEGA_ID } from "../state/handles";
import { State } from "../state/state";

type HandleAdjacency = Map<string, Set<string>>;

function isHandleId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function connect(adjacency: HandleAdjacency, a: unknown, b: unknown): void {
  if (!isHandleId(a) || !isHandleId(b) || a === b) {
    return;
  }
  if (!adjacency.has(a) || !adjacency.has(b)) {
    return;
  }
  adjacency.get(a)?.add(b);
  adjacency.get(b)?.add(a);
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

function collectRoots(state: State): Set<string> {
  const roots = new Set<string>([OMEGA_ID, BOT_ID, state.vm.Omega, state.vm.F, state.vm.R]);

  for (const id of state.vm.K) roots.add(id);
  for (const id of state.vm.W) roots.add(id);
  for (const id of state.vm.A) roots.add(id);
  for (const id of state.vm.phraseWordValues) roots.add(id);
  for (const chunk of state.vm.H_phrase) roots.add(chunk.word_value);
  for (const chunk of state.vm.H_committed) roots.add(chunk.word_value);

  if (state.vm.wordLastSealedArtifact) roots.add(state.vm.wordLastSealedArtifact);
  if (state.vm.wordEntryFocus) roots.add(state.vm.wordEntryFocus);
  if (state.vm.PendingJoin?.left_span_handle) roots.add(state.vm.PendingJoin.left_span_handle);

  for (const frame of state.vm.E) {
    roots.add(frame.F);
    roots.add(frame.Omega_frame);
  }

  for (const obligation of state.vm.OStack_word) {
    roots.add(obligation.parent);
    roots.add(obligation.child);
  }

  for (const boundary of state.boundaries) {
    roots.add(boundary.id);
    roots.add(boundary.inside);
    roots.add(boundary.outside);
  }

  for (const rule of state.rules) {
    roots.add(rule.target);
    if (isHandleId(rule.id)) {
      roots.add(rule.id);
    }
  }

  for (const node of Object.values(state.vm.CNodes)) {
    for (const id of node.word_values) {
      roots.add(id);
    }
  }

  return roots;
}

function buildAdjacency(state: State): HandleAdjacency {
  const adjacency: HandleAdjacency = new Map();
  for (const id of state.handles.keys()) {
    adjacency.set(id, new Set<string>());
  }

  for (const link of state.links) {
    connect(adjacency, link.from, link.to);
  }

  for (const edge of state.cont) {
    const parsed = parseContEdge(edge);
    if (!parsed) {
      continue;
    }
    connect(adjacency, parsed[0], parsed[1]);
  }

  for (const boundary of state.boundaries) {
    connect(adjacency, boundary.id, boundary.inside);
    connect(adjacency, boundary.id, boundary.outside);
    connect(adjacency, boundary.inside, boundary.outside);
  }

  for (const obligation of state.vm.OStack_word) {
    connect(adjacency, obligation.parent, obligation.child);
  }

  for (const frame of state.vm.E) {
    connect(adjacency, frame.F, frame.Omega_frame);
  }

  for (const rule of state.rules) {
    connect(adjacency, rule.id, rule.target);
  }

  return adjacency;
}

function collectReachable(adjacency: HandleAdjacency, roots: Set<string>): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const id of roots) {
    if (adjacency.has(id) && !reachable.has(id)) {
      reachable.add(id);
      queue.push(id);
    }
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

function isEphemeralAliasLike(handleMeta: Record<string, any> | undefined): boolean {
  if (!handleMeta || typeof handleMeta !== "object") {
    return false;
  }
  return handleMeta.ephemeral === 1 || handleMeta.ephemeral === true;
}

function remapOrBot(id: string, removed: Set<string>): string {
  return removed.has(id) ? BOT_ID : id;
}

export function collectGarbage(state: State): void {
  if (state.handles.size <= 2) {
    return;
  }

  const roots = collectRoots(state);
  const adjacency = buildAdjacency(state);
  const reachable = collectReachable(adjacency, roots);

  const removed = new Set<string>();
  for (const [id, handle] of state.handles.entries()) {
    const ephemeral = handle.kind === "alias" || isEphemeralAliasLike(handle.meta);
    if (!ephemeral || reachable.has(id)) {
      continue;
    }
    removed.add(id);
  }

  if (removed.size === 0) {
    return;
  }

  for (const id of removed) {
    state.handles.delete(id);
  }

  state.links = state.links.filter((link) => !removed.has(link.from) && !removed.has(link.to));

  state.cont = new Set(
    Array.from(state.cont).filter((edge) => {
      const parsed = parseContEdge(edge);
      if (!parsed) {
        return true;
      }
      return !removed.has(parsed[0]) && !removed.has(parsed[1]);
    })
  );

  state.boundaries = state.boundaries.filter(
    (boundary) =>
      !removed.has(boundary.id) && !removed.has(boundary.inside) && !removed.has(boundary.outside)
  );

  state.rules = state.rules.filter(
    (rule) => !removed.has(rule.target) && !removed.has(rule.id)
  );

  if (removed.has(state.vm.F)) {
    state.vm.F = state.vm.Omega;
  }
  if (removed.has(state.vm.R)) {
    state.vm.R = BOT_ID;
  }
  if (removed.has(state.vm.Omega)) {
    state.vm.Omega = OMEGA_ID;
  }

  state.vm.K = state.vm.K.map((id) => remapOrBot(id, removed));
  state.vm.W = state.vm.W.map((id) => remapOrBot(id, removed));
  state.vm.A = state.vm.A.map((id) => remapOrBot(id, removed));
  state.vm.phraseWordValues = state.vm.phraseWordValues.map((id) => remapOrBot(id, removed));

  if (state.vm.wordLastSealedArtifact && removed.has(state.vm.wordLastSealedArtifact)) {
    state.vm.wordLastSealedArtifact = undefined;
  }
  if (state.vm.wordEntryFocus && removed.has(state.vm.wordEntryFocus)) {
    state.vm.wordEntryFocus = state.vm.F;
  }

  if (state.vm.PendingJoin) {
    if (removed.has(state.vm.PendingJoin.left_span_handle)) {
      state.vm.PendingJoin = undefined;
    } else {
      state.vm.PendingJoin.exported_pins = state.vm.PendingJoin.exported_pins.filter(
        (id) => !removed.has(id)
      );
    }
  }

  for (const frame of state.vm.E) {
    frame.F = removed.has(frame.F) ? state.vm.Omega : frame.F;
    frame.Omega_frame = removed.has(frame.Omega_frame) ? state.vm.Omega : frame.Omega_frame;
  }

  state.vm.OStack_word = state.vm.OStack_word.filter(
    (obligation) => !removed.has(obligation.parent) && !removed.has(obligation.child)
  );

  for (const chunk of state.vm.H_phrase) {
    chunk.word_value = remapOrBot(chunk.word_value, removed);
  }
  for (const chunk of state.vm.H_committed) {
    chunk.word_value = remapOrBot(chunk.word_value, removed);
  }
  for (const node of Object.values(state.vm.CNodes)) {
    node.word_values = node.word_values.map((id) => remapOrBot(id, removed));
  }
}
