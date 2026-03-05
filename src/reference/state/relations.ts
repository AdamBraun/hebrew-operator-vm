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

function forkPortsFromMeta(state: State, id: string): string[] {
  const meta = state.handles.get(id)?.meta ?? {};
  const raw = Array.isArray(meta.fork_ports) ? meta.fork_ports : [];
  const ports: string[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }
    if (!state.handles.has(candidate) || candidate === id || ports.includes(candidate)) {
      continue;
    }
    ports.push(candidate);
  }
  return ports;
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

function attachmentSites(state: State, id: string): string[] {
  const sites = [id];
  const ports = forkPortsFromMeta(state, id);
  const inferred = ports.length > 0 ? ports : subPorts(state, id);
  for (const port of inferred) {
    if (!sites.includes(port)) {
      sites.push(port);
    }
  }
  return sites;
}

function addContEdge(state: State, from: string, to: string): void {
  state.cont.add(edgeKey(from, to));
}

export function addCont(state: State, from: string, to: string): void {
  if (!validHandleId(from) || !validHandleId(to)) {
    return;
  }
  const fromSites = attachmentSites(state, from);
  const toSites = attachmentSites(state, to);
  for (const source of fromSites) {
    for (const target of toSites) {
      addContEdge(state, source, target);
    }
  }
}

export function addCarry(state: State, source: string, target: string): void {
  if (!validHandleId(source) || !validHandleId(target)) {
    return;
  }
  const sourceSites = attachmentSites(state, source);
  const targetSites = attachmentSites(state, target);
  for (const sourceSite of sourceSites) {
    for (const targetSite of targetSites) {
      addContEdge(state, sourceSite, targetSite);
      state.carry.add(edgeKey(sourceSite, targetSite));
    }
  }
}

export function addSupp(state: State, closer: string, origin: string): void {
  if (!validHandleId(closer) || !validHandleId(origin)) {
    return;
  }
  const closerSites = attachmentSites(state, closer);
  const originSites = attachmentSites(state, origin);
  for (const closerSite of closerSites) {
    for (const originSite of originSites) {
      state.supp.add(edgeKey(closerSite, originSite));
    }
  }
}

export function addSub(state: State, parent: string, child: string): void {
  if (!parent || !child) {
    return;
  }
  state.sub.add(edgeKey(parent, child));
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
