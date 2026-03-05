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

export type WitnessBundle = Readonly<Record<string, any>>;

export type EffContext = CarryResolutionContext;

type CarryWithOrder = {
  source: string;
  target: string;
  creationOrder: number;
};

type RankedKey = {
  distance: number;
  resolution: CarryResolutionStatus;
  creationOrder: number;
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

function buildContPredecessorIndex(state: State): Map<string, string[]> {
  const byTarget = new Map<string, Set<string>>();
  for (const edge of state.cont) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const predecessors = byTarget.get(target) ?? new Set<string>();
    predecessors.add(source);
    byTarget.set(target, predecessors);
  }
  const out = new Map<string, string[]>();
  for (const [target, predecessors] of byTarget.entries()) {
    out.set(
      target,
      [...predecessors].sort((left, right) => left.localeCompare(right))
    );
  }
  return out;
}

function buildIncomingCarryIndex(state: State): Map<string, CarryWithOrder[]> {
  const byTarget = new Map<string, CarryWithOrder[]>();
  const edges = [...state.carry];
  for (let index = 0; index < edges.length; index += 1) {
    const parsed = parseEdge(edges[index]);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const incoming = byTarget.get(target) ?? [];
    incoming.push({
      source,
      target,
      creationOrder: index
    });
    byTarget.set(target, incoming);
  }
  return byTarget;
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = deepClone(entry);
  }
  return out as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return value;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function witnessBundleFromSource(state: State, sourceNodeId: string): WitnessBundle {
  const candidate =
    state.handles.get(sourceNodeId)?.meta?.witness ??
    state.handles.get(sourceNodeId)?.meta?.witness_bundle ??
    null;
  if (!isRecord(candidate)) {
    return {};
  }
  return deepClone(candidate);
}

function shouldOverride(existing: RankedKey | undefined, candidate: RankedKey): boolean {
  if (!existing) {
    return true;
  }
  if (candidate.distance < existing.distance) {
    return true;
  }
  if (candidate.distance > existing.distance) {
    return false;
  }
  if (candidate.resolution !== existing.resolution) {
    return candidate.resolution === "resolved";
  }
  return candidate.creationOrder > existing.creationOrder;
}

function applyContribution(
  output: Record<string, any>,
  rankByKey: Map<string, RankedKey>,
  bundle: WitnessBundle,
  rank: RankedKey
): void {
  for (const [key, value] of Object.entries(bundle)) {
    if (!shouldOverride(rankByKey.get(key), rank)) {
      continue;
    }
    output[key] = deepClone(value);
    rankByKey.set(key, rank);
  }
}

function collectBackwardContNodes(
  state: State,
  startNodeId: string,
  context: EffContext
): Array<{ nodeId: string; distance: number }> {
  const predecessors = buildContPredecessorIndex(state);
  const distanceByNode = new Map<string, number>([[startNodeId, 0]]);
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const distance = distanceByNode.get(current) ?? 0;
    if (isChunkBoundaryNode(state, current, context)) {
      continue;
    }
    for (const previous of predecessors.get(current) ?? []) {
      if (distanceByNode.has(previous)) {
        continue;
      }
      distanceByNode.set(previous, distance + 1);
      queue.push(previous);
    }
  }

  return [...distanceByNode.entries()]
    .map(([nodeId, distance]) => ({ nodeId, distance }))
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      return left.nodeId.localeCompare(right.nodeId);
    });
}

function resolveCarryWithSuccessors(
  state: State,
  source: string,
  target: string,
  context: CarryResolutionContext,
  successors: Map<string, string[]>
): CarryResolution {
  if (!hasCarry(state, source, target)) {
    return { status: "unresolved", closer: null };
  }

  const focusNodeId = context.focusNodeId === undefined ? state.vm.F : context.focusNodeId;
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

export function resolveCarry(
  state: State,
  source: string,
  target: string,
  context: CarryResolutionContext = {}
): CarryResolution {
  return resolveCarryWithSuccessors(state, source, target, context, buildContSuccessorIndex(state));
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

export function eff(state: State, nodeId: string, context: EffContext = {}): WitnessBundle {
  const contributions = collectBackwardContNodes(state, nodeId, context);
  const incomingCarryByTarget = buildIncomingCarryIndex(state);
  const contSuccessors = buildContSuccessorIndex(state);
  const resolutionContext: CarryResolutionContext = {
    ...context,
    focusNodeId: context.focusNodeId ?? nodeId
  };
  const output: Record<string, any> = {};
  const rankByKey = new Map<string, RankedKey>();

  for (const { nodeId: visitedNode, distance } of contributions) {
    const incoming = incomingCarryByTarget.get(visitedNode) ?? [];
    for (const carry of incoming) {
      const resolution = resolveCarryWithSuccessors(
        state,
        carry.source,
        carry.target,
        resolutionContext,
        contSuccessors
      );
      const bundle = witnessBundleFromSource(state, carry.source);
      applyContribution(output, rankByKey, bundle, {
        distance,
        resolution: resolution.status,
        creationOrder: carry.creationOrder
      });
    }
  }

  return deepFreeze(output);
}
