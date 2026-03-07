import { BOT_ID, OMEGA_ID } from "./handles";
import { addLink } from "./relations";
import type { State, VMEvent } from "./state";

function exists(state: State, id: unknown): id is string {
  if (typeof id !== "string" || id.length === 0) {
    return false;
  }
  if (id === BOT_ID || id === OMEGA_ID) {
    return true;
  }
  return state.handles.has(id);
}

function link(state: State, from: unknown, to: unknown, label: string): void {
  if (!exists(state, from) || !exists(state, to)) {
    return;
  }
  addLink(state, from, to, label);
}

function bi(state: State, left: unknown, right: unknown, label: string): void {
  link(state, left, right, label);
  link(state, right, left, label);
}

function parseEdge(edge: string): [string, string] | null {
  const pivot = String(edge).indexOf("->");
  if (pivot <= 0 || pivot + 2 >= String(edge).length) {
    return null;
  }
  const from = String(edge).slice(0, pivot);
  const to = String(edge).slice(pivot + 2);
  if (!from || !to) {
    return null;
  }
  return [from, to];
}

function directSubChildren(state: State, parent: string): string[] {
  const children: string[] = [];
  for (const edge of state.sub) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [from, to] = parsed;
    if (from !== parent || children.includes(to)) {
      continue;
    }
    children.push(to);
  }
  return children;
}

export function applyEventLinks(state: State, events: readonly VMEvent[]): void {
  for (const event of events) {
    const type = String(event?.type ?? "");
    const data: any = event?.data ?? {};

    switch (type) {
      case "alias":
        bi(state, data.left, data.right, "transport");
        break;
      case "shin":
        if (data.focus !== data.id) {
          link(state, data.focus, data.id, "construct");
        }
        break;
      case "endpoint":
        link(state, data.endpoint, data.id, "endpoint");
        break;
      case "boundary_open":
      case "boundary_close":
      case "boundary_auto_close":
      case "boundary_cut_close": {
        link(state, data.inside, data.id, "boundary");
        link(state, data.id, data.outside, "boundary");
        // Boundary sits on the inside target; fan this edge into direct compartments.
        link(state, data.id, data.inside, "boundary");
        for (const child of directSubChildren(state, String(data.inside ?? ""))) {
          link(state, data.id, child, "boundary");
        }
        break;
      }
      case "finalize":
        link(state, data.target, data.id, "finalize");
        link(state, data.id, data.residueId, "residue");
        break;
      case "align":
      case "align_final":
        link(state, data.focus, data.id, "align");
        break;
      case "fall":
        link(state, data.parent, data.child, "fall");
        break;
      case "mem_spill":
        link(state, data.parent, data.node, "mem_spill");
        link(state, data.node, data.zone, "mem_spill");
        break;
      default:
        break;
    }
  }
}
