import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { eff } from "@ref/state/eff";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { addCarry } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest } from "@ref/vm/vm";

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function backwardContReachable(
  state: ReturnType<typeof createInitialState>,
  start: string,
  target: string
): boolean {
  if (start === target) {
    return true;
  }

  const predecessors = new Map<string, string[]>();
  for (const edge of state.cont) {
    const [from, to] = parseEdge(edge);
    const current = predecessors.get(to) ?? [];
    predecessors.set(to, current.includes(from) ? current : [...current, from]);
  }

  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const previous of predecessors.get(current) ?? []) {
      if (previous === target) {
        return true;
      }
      if (visited.has(previous)) {
        continue;
      }
      visited.add(previous);
      queue.push(previous);
    }
  }

  return false;
}

function executeExplicitYodFromOrdinaryFocus(): {
  state: ReturnType<typeof createInitialState>;
  focusId: string;
  pinId: string;
} {
  const state = createInitialState();
  const focusId = "F";
  const witnessSource = "S";
  const [token] = tokenize("י");
  if (!token) {
    throw new Error("Missing token for י");
  }

  state.handles.set(focusId, createHandle(focusId, "scope"));
  state.handles.set(
    witnessSource,
    createHandle(witnessSource, "scope", { meta: { witness: { lineage_through_f: 1 } } })
  );
  state.vm.F = focusId;
  state.vm.K = [focusId, BOT_ID];
  state.vm.R = BOT_ID;
  state.vm.wordHasContent = true;
  state.vm.activeConstruct = "C:mid";

  // Upstream witness-thread on F. The purpose of י is to keep this lineage reachable
  // from the exported pin by placing the pin on the cont spine instead of creating an
  // isolated zero-edge node.
  addCarry(state, witnessSource, focusId);

  const baselineHandleIds = new Set(state.handles.keys());
  executeLetterForTest(state, token, {
    wordText: "אי",
    isWordFinal: false,
    prevBoundaryMode: "hard"
  });

  const freshHandleIds = Array.from(state.handles.keys())
    .filter((id) => !baselineHandleIds.has(id))
    .sort();
  expect(freshHandleIds).toHaveLength(1);

  return { state, focusId, pinId: freshHandleIds[0] as string };
}

describe("eff() reachability for explicit י", () => {
  it("keeps the exported pin on the cont spine so eff can inspect lineage through F without adding a new carry-thread", () => {
    const { state, focusId, pinId } = executeExplicitYodFromOrdinaryFocus();

    // If י were a bare isolated node with zero edges, the backward cont* frontier from `p`
    // would be `{p}` only. `eff(p)` would never reach `F`, so carries attached at `F`
    // would be invisible. That is why the current design emits `cont(F, p)`.
    expect(backwardContReachable(state, pinId, focusId)).toBe(true);
    expect(state.cont.has(`${focusId}->${pinId}`)).toBe(true);

    expect(eff(state, pinId, { focusNodeId: pinId })).toEqual({
      lineage_through_f: 1
    });

    expect(Array.from(state.carry).filter((edge) => edge.endsWith(`->${pinId}`))).toEqual([]);
    expect(state.carry.has(`S->${focusId}`)).toBe(true);
  });
});
