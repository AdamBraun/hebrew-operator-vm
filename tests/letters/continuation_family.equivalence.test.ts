import { describe, expect, it } from "vitest";
import { finalNunOp } from "@ref/letters/finalNun";
import type { LetterOp } from "@ref/letters/types";
import { nunOp } from "@ref/letters/nun";
import { vavOp } from "@ref/letters/vav";
import { zayinOp } from "@ref/letters/zayin";
import { createInitialState } from "@ref/state/state";

type EdgeDelta = {
  cont: string[];
  carry: string[];
  supp: string[];
};

type Execution = {
  nodeId: string;
  operatorKDelta: string[];
  finalKDelta: string[];
  focusBefore: string;
  focusAfter: string;
  edgeDelta: EdgeDelta;
};

type FamilyExecution = Record<"ו" | "נ" | "ן" | "ז", Execution>;

function diffSet(after: Set<string>, before: Set<string>): string[] {
  return Array.from(after)
    .filter((edge) => !before.has(edge))
    .sort();
}

function normalizeEdges(edges: string[], replacements: Record<string, string>): string[] {
  return edges
    .map((edge) => {
      const [from = "", to = ""] = edge.split("->");
      return `${replacements[from] ?? from}->${replacements[to] ?? to}`;
    })
    .sort();
}

function findFreshNodeId(currentIds: Iterable<string>, baselineIds: Set<string>): string {
  const freshIds = Array.from(currentIds)
    .filter((id) => !baselineIds.has(id))
    .sort();
  expect(freshIds).toHaveLength(1);
  return freshIds[0];
}

function executeUnary(op: LetterOp): Execution {
  const baseline = createInitialState();
  const state = createInitialState();
  const focusBefore = baseline.vm.F;
  const baselineHandleIds = new Set(baseline.handles.keys());
  const baselineK = [...baseline.vm.K];

  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  const nodeId = findFreshNodeId(state.handles.keys(), baselineHandleIds);
  const operatorKDelta = state.vm.K.slice(baselineK.length);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? focusBefore : sealed.h;
  state.vm.R = sealed.r;

  return {
    nodeId,
    operatorKDelta,
    finalKDelta: state.vm.K.slice(baselineK.length),
    focusBefore,
    focusAfter: state.vm.F,
    edgeDelta: {
      cont: normalizeEdges(diffSet(state.cont, baseline.cont), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      }),
      carry: normalizeEdges(diffSet(state.carry, baseline.carry), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      }),
      supp: normalizeEdges(diffSet(state.supp, baseline.supp), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      })
    }
  };
}

function executeFamily(): FamilyExecution {
  return {
    ו: executeUnary(vavOp),
    נ: executeUnary(nunOp),
    ן: executeUnary(finalNunOp),
    ז: executeUnary(zayinOp)
  };
}

describe("continuation family edge-delta equivalence", () => {
  it("ו נ ן ז share the same continuation spine and only add carry/supp by family rank", () => {
    const family = executeFamily();

    expect(family["ו"].edgeDelta.cont).toEqual(["F0->N1"]);
    expect(family["נ"].edgeDelta.cont).toEqual(family["ו"].edgeDelta.cont);
    expect(family["ן"].edgeDelta.cont).toEqual(family["ו"].edgeDelta.cont);
    expect(family["ז"].edgeDelta.cont).toEqual(family["ו"].edgeDelta.cont);

    expect(family["ו"].edgeDelta.carry).toEqual([]);
    expect(family["נ"].edgeDelta.carry).toEqual(["F0->N1"]);
    expect(family["ן"].edgeDelta.carry).toEqual(family["נ"].edgeDelta.carry);
    expect(family["ז"].edgeDelta.carry).toEqual(family["נ"].edgeDelta.carry);

    expect(family["ו"].edgeDelta.supp).toEqual([]);
    expect(family["נ"].edgeDelta.supp).toEqual([]);
    expect(family["ן"].edgeDelta.supp).toEqual(["N1->F0"]);
    expect(family["ז"].edgeDelta.supp).toEqual(family["ן"].edgeDelta.supp);
  });

  it("ז and ן stay edge-equivalent while differing only in focus/export behavior", () => {
    const family = executeFamily();

    expect(family["ז"].edgeDelta.cont).toEqual(family["ן"].edgeDelta.cont);
    expect(family["ז"].edgeDelta.carry).toEqual(family["ן"].edgeDelta.carry);
    expect(family["ז"].edgeDelta.supp).toEqual(family["ן"].edgeDelta.supp);

    expect(family["ז"].focusAfter).toBe(family["ז"].focusBefore);
    expect(family["ן"].focusAfter).toBe(family["ן"].nodeId);
    expect(family["ן"].focusAfter).not.toBe(family["ן"].focusBefore);

    expect(family["ז"].operatorKDelta).toEqual([family["ז"].nodeId]);
    expect(family["ן"].operatorKDelta).toEqual([]);

    expect(family["ז"].finalKDelta).toEqual([family["ז"].nodeId, family["ז"].nodeId]);
    expect(family["ן"].finalKDelta).toEqual([family["ן"].nodeId]);
  });

  it("operator-specific exports exist only on ז; focus advance exists on every other continuation form", () => {
    const family = executeFamily();

    expect(family["ו"].operatorKDelta).toEqual([]);
    expect(family["נ"].operatorKDelta).toEqual([]);
    expect(family["ן"].operatorKDelta).toEqual([]);
    expect(family["ז"].operatorKDelta).toEqual([family["ז"].nodeId]);

    expect(family["ו"].focusAfter).toBe(family["ו"].nodeId);
    expect(family["נ"].focusAfter).toBe(family["נ"].nodeId);
    expect(family["ן"].focusAfter).toBe(family["ן"].nodeId);
    expect(family["ז"].focusAfter).toBe(family["ז"].focusBefore);

    expect(family["ו"].finalKDelta).toEqual([family["ו"].nodeId]);
    expect(family["נ"].finalKDelta).toEqual([family["נ"].nodeId]);
    expect(family["ן"].finalKDelta).toEqual([family["ן"].nodeId]);
    expect(family["ז"].finalKDelta).toEqual([family["ז"].nodeId, family["ז"].nodeId]);
  });
});
