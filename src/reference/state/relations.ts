import { State } from "./state";

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

function validHandleId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

function subPorts(state: State, parent: string): string[] {
  const ports: string[] = [];
  for (const edge of state.sub) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, child] = parsed;
    if (source !== parent || !state.handles.has(child) || ports.includes(child)) {
      continue;
    }
    ports.push(child);
  }
  return ports;
}

function addContEdge(state: State, from: string, to: string): void {
  state.cont.add(edgeKey(from, to));
}

function targetSitesWithFanIn(state: State, target: string): string[] {
  const sites = [target];
  for (const child of subPorts(state, target)) {
    if (!sites.includes(child)) {
      sites.push(child);
    }
  }
  return sites;
}

export function addCont(state: State, from: string, to: string): void {
  if (!validHandleId(from) || !validHandleId(to)) {
    return;
  }
  for (const target of targetSitesWithFanIn(state, to)) {
    addContEdge(state, from, target);
  }
}

export function addCarry(state: State, source: string, target: string): void {
  if (!validHandleId(source) || !validHandleId(target)) {
    return;
  }
  for (const targetSite of targetSitesWithFanIn(state, target)) {
    addContEdge(state, source, targetSite);
    state.carry.add(edgeKey(source, targetSite));
  }
}

export function addSupp(state: State, closer: string, origin: string): void {
  if (!validHandleId(closer) || !validHandleId(origin)) {
    return;
  }
  state.supp.add(edgeKey(closer, origin));
}

export function addHeadOf(state: State, head: string, whole: string): void {
  if (!validHandleId(head) || !validHandleId(whole)) {
    return;
  }
  state.head_of.add(edgeKey(head, whole));
}

export function addSub(state: State, parent: string, child: string): void {
  if (!parent || !child) {
    return;
  }
  state.sub.add(edgeKey(parent, child));
}

export function addExportedAdjunct(state: State, head: string, adjunct: string): void {
  if (!validHandleId(head) || !validHandleId(adjunct)) {
    return;
  }
  addSub(state, head, adjunct);
  const existing = state.adjuncts[head] ?? [];
  if (existing.includes(adjunct)) {
    return;
  }
  state.adjuncts[head] = [...existing, adjunct];
}

export function exportedAdjuncts(state: State, head: string): string[] {
  const entries = state.adjuncts[head] ?? [];
  const out: string[] = [];
  for (const adjunct of entries) {
    if (
      !state.handles.has(adjunct) ||
      !state.sub.has(edgeKey(head, adjunct)) ||
      out.includes(adjunct)
    ) {
      continue;
    }
    out.push(adjunct);
  }
  return out;
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
      const parsed = parseEdge(edge);
      if (!parsed) {
        continue;
      }
      const [from, to] = parsed;
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
  const members = [inside, ...subPorts(state, inside)];
  state.boundaries.push({ inside, outside, anchor, id, members });
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
