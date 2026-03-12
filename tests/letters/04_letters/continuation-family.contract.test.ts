import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest } from "@ref/vm/vm";

type ContinuationLetter = "י" | "ו" | "נ" | "ז";

type ContinuationEffect = {
  nodeCount: number;
  cont: string[];
  carry: string[];
  supp: string[];
  focus: string;
  exportedTop: string;
};

type LegEffect = {
  cont: string[];
  carry: string[];
  supp: string[];
  sub: string[];
};

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function normalizeEdges(edges: Iterable<string>, names: Record<string, string>): string[] {
  return Array.from(edges, (edge) => {
    const [from, to] = parseEdge(edge);
    return `${names[from] ?? from}->${names[to] ?? to}`;
  }).sort();
}

function executeOnOrdinaryFocus(letter: ContinuationLetter | "ה") {
  const state = createInitialState();
  const source = "X";
  const [token] = tokenize(letter);
  if (!token) {
    throw new Error(`Missing token for ${letter}`);
  }

  state.handles.set(source, createHandle(source, "scope"));
  state.vm.F = source;
  state.vm.K = [source, BOT_ID];
  state.vm.R = BOT_ID;
  state.vm.wordHasContent = true;
  state.vm.activeConstruct = "C:mid";
  const baselineHandleIds = new Set(state.handles.keys());

  executeLetterForTest(state, token, {
    wordText: `א${letter}`,
    isWordFinal: false,
    prevBoundaryMode: "hard"
  });

  const freshHandleIds = Array.from(state.handles.keys())
    .filter((id) => !baselineHandleIds.has(id))
    .sort();

  return { state, source, freshHandleIds };
}

function continuationEffect(letter: ContinuationLetter): {
  state: ReturnType<typeof executeOnOrdinaryFocus>["state"];
  nodeId: string;
  effect: ContinuationEffect;
} {
  const { state, source, freshHandleIds } = executeOnOrdinaryFocus(letter);
  expect(freshHandleIds).toHaveLength(1);
  const [nodeId = ""] = freshHandleIds;
  const names = {
    [source]: "F",
    [nodeId]: "P"
  };

  return {
    state,
    nodeId,
    effect: {
      nodeCount: freshHandleIds.length,
      cont: normalizeEdges(state.cont, names),
      carry: normalizeEdges(state.carry, names),
      supp: normalizeEdges(state.supp, names),
      focus: names[state.vm.F] ?? state.vm.F,
      exportedTop: names[state.vm.K[state.vm.K.length - 1] ?? ""] ?? ""
    }
  };
}

function heLegEffect(): {
  state: ReturnType<typeof executeOnOrdinaryFocus>["state"];
  effect: LegEffect;
} {
  const { state } = executeOnOrdinaryFocus("ה");
  const [headOfEdge] = Array.from(state.head_of);
  if (!headOfEdge) {
    throw new Error("Missing head_of edge for ה");
  }
  const [head] = parseEdge(headOfEdge);
  const [leg] = state.adjuncts[head] ?? [];
  if (!leg) {
    throw new Error("Missing detached leg for ה");
  }

  return {
    state,
    effect: {
      cont: state.cont.has(`${head}->${leg}`) ? ["S->T"] : [],
      carry: state.carry.has(`${head}->${leg}`) ? ["S->T"] : [],
      supp: state.supp.has(`${leg}->${head}`) ? ["T->S"] : [],
      sub: state.sub.has(`${head}->${leg}`) ? ["S->T"] : []
    }
  };
}

describe("continuation family contract distinctions", () => {
  it("Case A: explicit י is a cont-only pin with unchanged focus and exported result", () => {
    const { effect, state, nodeId } = continuationEffect("י");

    expect(effect).toEqual({
      nodeCount: 1,
      cont: ["F->P"],
      carry: [],
      supp: [],
      focus: "F",
      exportedTop: "P"
    });
    expect(state.vm.K).toContain(nodeId);
  });

  it("Case B: ו emits only cont but advances focus, so י != ו", () => {
    const yod = continuationEffect("י").effect;
    const vav = continuationEffect("ו").effect;

    expect(vav).toEqual({
      nodeCount: 1,
      cont: ["F->P"],
      carry: [],
      supp: [],
      focus: "P",
      exportedTop: "P"
    });
    expect(yod.cont).toEqual(vav.cont);
    expect(yod.carry).toEqual(vav.carry);
    expect(yod.supp).toEqual(vav.supp);
    expect(yod).not.toEqual(vav);
  });

  it("Case C: נ adds carry on the same continuation step and advances focus", () => {
    const { effect } = continuationEffect("נ");

    expect(effect).toEqual({
      nodeCount: 1,
      cont: ["F->P"],
      carry: ["F->P"],
      supp: [],
      focus: "P",
      exportedTop: "P"
    });
  });

  it("Case D: ז adds supp on the same continuation step, exports the node, and keeps focus unchanged", () => {
    const { effect } = continuationEffect("ז");

    expect(effect).toEqual({
      nodeCount: 1,
      cont: ["F->P"],
      carry: [],
      supp: ["P->F"],
      focus: "F",
      exportedTop: "P"
    });
  });

  it("Case E: ה-leg has cont+carry+supp+sub and is not identical to explicit י", () => {
    const heLeg = heLegEffect().effect;
    const explicitYod = continuationEffect("י").effect;
    const normalizedYod: LegEffect = {
      cont: explicitYod.cont.map(() => "S->T"),
      carry: explicitYod.carry.map(() => "S->T"),
      supp: explicitYod.supp.map(() => "T->S"),
      sub: []
    };

    expect(heLeg).toEqual({
      cont: ["S->T"],
      carry: ["S->T"],
      supp: ["T->S"],
      sub: ["S->T"]
    });
    expect(normalizedYod).toEqual({
      cont: ["S->T"],
      carry: [],
      supp: [],
      sub: []
    });
    expect(heLeg).not.toEqual(normalizedYod);
  });
});
