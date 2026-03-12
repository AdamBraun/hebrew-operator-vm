import { describe, expect, it } from "vitest";
import { gimelOp } from "@ref/letters/gimel";
import { nunOp } from "@ref/letters/nun";
import type { LetterOp } from "@ref/letters/types";
import { vavOp } from "@ref/letters/vav";
import { createInitialState } from "@ref/state/state";

type TestState = ReturnType<typeof createInitialState>;

type StateSnapshot = {
  focus: string;
  handles: Set<string>;
  cont: Set<string>;
  carry: Set<string>;
  supp: Set<string>;
  headOf: Set<string>;
  sub: Set<string>;
};

type GimelInvariantWitness = {
  F0: string;
  M: string;
  Fp: string;
};

function captureState(state: TestState): StateSnapshot {
  return {
    focus: state.vm.F,
    handles: new Set(state.handles.keys()),
    cont: new Set(state.cont),
    carry: new Set(state.carry),
    supp: new Set(state.supp),
    headOf: new Set(state.head_of),
    sub: new Set(state.sub)
  };
}

function deltaEdges(after: Set<string>, before: Set<string>): string[] {
  return Array.from(after)
    .filter((edge) => !before.has(edge))
    .sort((left, right) => left.localeCompare(right));
}

function executeUnary(state: TestState, op: LetterOp) {
  const origin = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? origin : sealed.h;
  state.vm.R = sealed.r;

  return {
    origin,
    child: sealed.h,
    cons: bound.cons
  };
}

function reachByEdges(start: string, edges: Iterable<string>): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const [from = "", to = ""] = edge.split("->");
    if (!from || !to) {
      continue;
    }
    const targets = adjacency.get(from) ?? [];
    targets.push(to);
    adjacency.set(from, targets);
  }

  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const target of adjacency.get(current) ?? []) {
      if (visited.has(target)) {
        continue;
      }
      visited.add(target);
      queue.push(target);
    }
  }

  return visited;
}

function assertGimelShoulderInvariant(
  state: TestState,
  before: StateSnapshot
): GimelInvariantWitness {
  const F0 = before.focus;
  const freshNodes = Array.from(state.handles.keys())
    .filter((id) => !before.handles.has(id))
    .sort((left, right) => left.localeCompare(right));
  const newCont = deltaEdges(state.cont, before.cont);
  const newCarry = deltaEdges(state.carry, before.carry);
  const newSupp = deltaEdges(state.supp, before.supp);
  const newHeadOf = deltaEdges(state.head_of, before.headOf);
  const newSub = deltaEdges(state.sub, before.sub);

  expect(freshNodes).toHaveLength(2);
  expect(newCont).toHaveLength(2);
  expect(newCarry).toHaveLength(1);
  expect(newSupp).toEqual([]);
  expect(newHeadOf).toEqual([]);
  expect(newSub).toEqual([]);

  const candidatePairs: Array<[string, string]> = [];
  for (const M of freshNodes) {
    for (const Fp of freshNodes) {
      if (M === Fp) {
        continue;
      }
      if (
        newCont.includes(`${F0}->${M}`) &&
        newCarry.includes(`${F0}->${M}`) &&
        newCont.includes(`${M}->${Fp}`) &&
        state.vm.F === Fp
      ) {
        candidatePairs.push([M, Fp]);
      }
    }
  }

  expect(candidatePairs).toHaveLength(1);
  const [M, Fp] = candidatePairs[0] as [string, string];

  expect(state.vm.F).toBe(Fp);
  expect(state.carry.has(`${F0}->${Fp}`)).toBe(false);
  expect(newCarry).not.toContain(`${F0}->${Fp}`);
  expect(newSupp.filter((edge) => edge.endsWith(`->${F0}`))).toEqual([]);

  const contReachable = reachByEdges(F0, state.cont);
  expect(contReachable.has(M)).toBe(true);
  expect(contReachable.has(Fp)).toBe(true);

  const nonContEdges = new Set<string>([
    ...state.carry,
    ...state.supp,
    ...state.head_of,
    ...state.sub
  ]);
  const nonContReachable = reachByEdges(F0, nonContEdges);
  const freshReachableOnlyByNonCont = freshNodes.filter(
    (node) => nonContReachable.has(node) && !contReachable.has(node)
  );

  expect(freshReachableOnlyByNonCont).toEqual([]);

  return { F0, M, Fp };
}

describe("gimel invariant", () => {
  it("enforces the unique shoulder-pair theorem across distinct incoming focus contexts", () => {
    const scenarios = [
      {
        label: "fresh focus",
        setup: (_state: TestState) => {}
      },
      {
        label: "after cont-only continuation",
        setup: (state: TestState) => {
          executeUnary(state, vavOp);
        }
      },
      {
        label: "after cont+carry continuation",
        setup: (state: TestState) => {
          executeUnary(state, nunOp);
        }
      }
    ];

    for (const scenario of scenarios) {
      const state = createInitialState();
      scenario.setup(state);

      const before = captureState(state);
      const { origin } = executeUnary(state, gimelOp);
      const witness = assertGimelShoulderInvariant(state, before);

      expect(origin).toBe(before.focus);
      expect(witness.F0).toBe(before.focus);
      expect(witness.M).not.toBe(witness.Fp);
    }
  });

  it("re-establishes the same invariant on each execution instance in גג", () => {
    const state = createInitialState();

    const beforeFirst = captureState(state);
    const first = executeUnary(state, gimelOp);
    const firstWitness = assertGimelShoulderInvariant(state, beforeFirst);

    const beforeSecond = captureState(state);
    const second = executeUnary(state, gimelOp);
    const secondWitness = assertGimelShoulderInvariant(state, beforeSecond);

    expect(first.origin).toBe(beforeFirst.focus);
    expect(first.child).toBe(firstWitness.Fp);
    expect(second.origin).toBe(firstWitness.Fp);
    expect(second.child).toBe(secondWitness.Fp);
    expect(secondWitness.F0).toBe(beforeSecond.focus);
    expect(secondWitness.F0).toBe(firstWitness.Fp);
  });
});
