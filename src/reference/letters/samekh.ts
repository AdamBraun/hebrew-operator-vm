import { BOT_ID } from "../state/handles";
import { isCarryUnresolved } from "../state/eff";
import { addSupp, contReachable } from "../state/relations";
import { State } from "../state/state";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ס",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const samekhOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const focus = ops.args[0];
    const origin = findNearestUnresolvedCarrySource(S, focus);
    if (origin) {
      addSupp(S, focus, origin);
    }
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope(),
      meta: { focus, origin }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const focus = cons.meta.focus as string;
    return { S, h: focus, r: BOT_ID };
  }
};

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

function buildContPredecessorIndex(state: State): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const edge of state.cont) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const predecessors = out.get(target) ?? [];
    predecessors.push(source);
    out.set(target, predecessors);
  }
  return out;
}

type IncomingCarry = {
  source: string;
  target: string;
};

function buildIncomingCarryIndex(state: State): Map<string, IncomingCarry[]> {
  const out = new Map<string, IncomingCarry[]>();
  for (const edge of state.carry) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, target] = parsed;
    const incoming = out.get(target) ?? [];
    incoming.push({ source, target });
    out.set(target, incoming);
  }
  return out;
}

function findNearestUnresolvedCarrySource(state: State, focus: string): string | null {
  const predecessors = buildContPredecessorIndex(state);
  const incomingCarryByTarget = buildIncomingCarryIndex(state);
  const visited = new Set<string>([focus]);
  const queue: string[] = [focus];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    const incoming = incomingCarryByTarget.get(current) ?? [];
    for (let index = incoming.length - 1; index >= 0; index -= 1) {
      const carry = incoming[index];
      if (!contReachable(state, carry.source, focus)) {
        continue;
      }
      if (
        isCarryUnresolved(state, carry.source, carry.target, {
          focusNodeId: focus
        })
      ) {
        return carry.source;
      }
    }

    for (const previous of predecessors.get(current) ?? []) {
      if (visited.has(previous)) {
        continue;
      }
      visited.add(previous);
      queue.push(previous);
    }
  }

  return null;
}
