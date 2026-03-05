import { State } from "./state";

export type CarryResolutionStatus = "resolved" | "unresolved";

export type CarryResolution = {
  status: CarryResolutionStatus;
  closer: string | null;
};

export type CarryResolutionContext = {
  focusNodeId?: string | null;
  chunkBoundaryNodes?: ReadonlySet<string>;
  isChunkBoundaryNode?: (nodeId: string, state: State) => boolean;
};

function edgeKey(source: string, target: string): string {
  return `${source}->${target}`;
}

function parseEdge(edge: string): [string, string] | null {
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

function hasCarry(state: State, source: string, target: string): boolean {
  return state.carry.has(edgeKey(source, target));
}

function hasSupp(state: State, closer: string, origin: string): boolean {
  return state.supp.has(edgeKey(closer, origin));
}

function isChunkBoundaryNode(
  state: State,
  nodeId: string,
  context: CarryResolutionContext
): boolean {
  if (context.chunkBoundaryNodes?.has(nodeId)) {
    return true;
  }
  if (context.isChunkBoundaryNode?.(nodeId, state)) {
    return true;
  }
  const handle = state.handles.get(nodeId);
  const meta = handle?.meta ?? {};
  return (
    meta.chunk_commit_boundary === 1 ||
    meta.chunk_commit_boundary === true ||
    meta.chunkCommitBoundary === 1 ||
    meta.chunkCommitBoundary === true
  );
}

function buildContSuccessorIndex(state: State): Map<string, string[]> {
  const bySource = new Map<string, Set<string>>();
  for (const edge of state.cont) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const successors = bySource.get(source) ?? new Set<string>();
    successors.add(target);
    bySource.set(source, successors);
  }
  const out = new Map<string, string[]>();
  for (const [source, successors] of bySource.entries()) {
    out.set(
      source,
      [...successors].sort((left, right) => left.localeCompare(right))
    );
  }
  return out;
}

export function resolveCarry(
  state: State,
  source: string,
  target: string,
  context: CarryResolutionContext = {}
): CarryResolution {
  if (!hasCarry(state, source, target)) {
    return { status: "unresolved", closer: null };
  }

  const focusNodeId = context.focusNodeId === undefined ? state.vm.F : context.focusNodeId;
  const successors = buildContSuccessorIndex(state);
  const visited = new Set<string>([target]);
  const queue: string[] = [target];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    if (hasSupp(state, current, source)) {
      return { status: "resolved", closer: current };
    }

    const shouldStop =
      (focusNodeId !== null && current === focusNodeId) ||
      isChunkBoundaryNode(state, current, context);
    if (shouldStop) {
      continue;
    }

    for (const next of successors.get(current) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      queue.push(next);
    }
  }

  return { status: "unresolved", closer: null };
}

export function isCarryResolved(
  state: State,
  source: string,
  target: string,
  context?: CarryResolutionContext
): boolean {
  return resolveCarry(state, source, target, context).status === "resolved";
}

export function isCarryUnresolved(
  state: State,
  source: string,
  target: string,
  context?: CarryResolutionContext
): boolean {
  return !isCarryResolved(state, source, target, context);
}

export function eff(state: State): void {
  void state;
}
