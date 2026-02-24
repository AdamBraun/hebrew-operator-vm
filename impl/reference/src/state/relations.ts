import { State } from "./state";

export function addCont(state: State, from: string, to: string): void {
  state.cont.add(`${from}->${to}`);
}

export function contReachable(state: State, start: string, target: string): boolean {
  if (start === target) {
    return true;
  }
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const edge of state.cont) {
      const [from, to] = edge.split("->");
      if (from !== current || visited.has(to)) {
        continue;
      }
      if (to === target) {
        return true;
      }
      visited.add(to);
      queue.push(to);
    }
  }

  return false;
}

export function closeMemZoneSilently(state: State, zoneId: string): void {
  const zone = state.handles.get(zoneId);
  if (zone) {
    zone.meta = { ...zone.meta, closed: 1 };
  }
}

export function addBoundary(
  state: State,
  id: string,
  inside: string,
  outside: string,
  anchor: 0 | 1
): void {
  state.boundaries.push({ inside, outside, anchor, id });
}

export function addLink(state: State, from: string, to: string, label: string): void {
  for (const edge of state.links) {
    if (edge.from === from && edge.to === to && edge.label === label) {
      return;
    }
  }
  state.links.push({ from, to, label });
}

const ALIAS_EDGE_TYPE = "ALIAS" as const;

function addDirectedAliasEdge(state: State, from: string, to: string): void {
  for (const edge of state.vm.aliasEdges) {
    if (edge.from === from && edge.to === to && edge.type === ALIAS_EDGE_TYPE) {
      return;
    }
  }
  state.vm.aliasEdges.push({ from, to, type: ALIAS_EDGE_TYPE });
}

export function addAliasEdge(state: State, a: string, b: string): void {
  if (!a || !b || a === b) {
    return;
  }
  addDirectedAliasEdge(state, a, b);
  addDirectedAliasEdge(state, b, a);
}

export function hasAliasEdge(state: State, from: string, to: string): boolean {
  return state.vm.aliasEdges.some(
    (edge) => edge.from === from && edge.to === to && edge.type === ALIAS_EDGE_TYPE
  );
}

export function aliasReachable(state: State, start: string, target: string): boolean {
  if (start === target) {
    return true;
  }
  const visited = new Set<string>([start]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const edge of state.vm.aliasEdges) {
      if (edge.type !== ALIAS_EDGE_TYPE || edge.from !== current || visited.has(edge.to)) {
        continue;
      }
      if (edge.to === target) {
        return true;
      }
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }

  return false;
}
