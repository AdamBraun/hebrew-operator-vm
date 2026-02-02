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
