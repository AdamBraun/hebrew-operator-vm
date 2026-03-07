import { describe, expect, it } from "vitest";
import { addCarry, addHeadOf, addSub, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

type EdgeKind = "carry" | "cont" | "head_of" | "sub" | "supp";

function normalizeEdge(edge: string, headId: string): string {
  const [from, to] = edge.split("->");
  const normalizedFrom = from === headId ? "h" : from;
  const normalizedTo = to === headId ? "h" : to;
  return `${normalizedFrom}->${normalizedTo}`;
}

function collectTypedEdges(
  state: ReturnType<typeof createInitialState>,
  headId: string
): Set<string> {
  const typed = new Set<string>();
  const push = (kind: EdgeKind, edges: Iterable<string>) => {
    for (const edge of edges) {
      typed.add(`${kind}:${normalizeEdge(edge, headId)}`);
    }
  };

  push("cont", state.cont);
  push("carry", state.carry);
  push("supp", state.supp);
  push("head_of", state.head_of);
  push("sub", state.sub);

  return typed;
}

function symmetricDifference(left: Set<string>, right: Set<string>): string[] {
  const diff: string[] = [];

  for (const edge of left) {
    if (!right.has(edge)) {
      diff.push(edge);
    }
  }
  for (const edge of right) {
    if (!left.has(edge)) {
      diff.push(edge);
    }
  }

  return diff.sort();
}

describe("edge types", () => {
  it("addCarry inserts carry(source,target) and matching cont(source,target)", () => {
    const state = createInitialState();
    addCarry(state, "a", "b");

    expect(state.cont.has("a->b")).toBe(true);
    expect(state.carry.has("a->b")).toBe(true);
    expect(state.supp.size).toBe(0);
  });

  it("addSupp inserts a back-edge supp(closer,origin)", () => {
    const state = createInitialState();
    addSupp(state, "closer", "origin");

    expect(state.supp.has("closer->origin")).toBe(true);
    expect(state.cont.size).toBe(0);
    expect(state.carry.size).toBe(0);
  });

  it("addSub inserts an interior subdivision edge sub(parent,child)", () => {
    const state = createInitialState();
    addSub(state, "parent", "child");

    expect(state.sub.has("parent->child")).toBe(true);
    expect(state.cont.size).toBe(0);
    expect(state.carry.size).toBe(0);
    expect(state.supp.size).toBe(0);
  });

  it("addHeadOf inserts a representational edge head_of(head,whole)", () => {
    const state = createInitialState();
    addHeadOf(state, "head", "whole");

    expect(state.head_of.has("head->whole")).toBe(true);
    expect(state.cont.size).toBe(0);
    expect(state.carry.size).toBe(0);
    expect(state.supp.size).toBe(0);
    expect(state.sub.size).toBe(0);
  });

  it("distinguishes ד from ר by exactly one supp edge", () => {
    const resh = runProgram("ר", createInitialState());
    const dalet = runProgram("ד", createInitialState());
    const reshHead = String(Array.from(resh.head_of)[0] ?? "").split("->")[0] ?? "";
    const daletHead = String(Array.from(dalet.head_of)[0] ?? "").split("->")[0] ?? "";
    const reshEdges = collectTypedEdges(resh, reshHead);
    const daletEdges = collectTypedEdges(dalet, daletHead);

    expect(reshEdges.has("head_of:h->Ω")).toBe(true);
    expect(daletEdges.has("head_of:h->Ω")).toBe(true);
    expect(reshEdges.has("carry:Ω->h")).toBe(true);
    expect(daletEdges.has("carry:Ω->h")).toBe(true);
    expect(reshEdges.has("cont:Ω->h")).toBe(true);
    expect(daletEdges.has("cont:Ω->h")).toBe(true);

    expect(symmetricDifference(reshEdges, daletEdges)).toEqual(["supp:h->Ω"]);
  });
});
