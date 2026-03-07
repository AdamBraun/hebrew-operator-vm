import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest } from "@ref/vm/vm";

type FamilyLetter = "ר" | "ד" | "ק" | "ה";

type NormalizedTopology = {
  focus: string;
  head_of: string[];
  carry: string[];
  cont: string[];
  supp: string[];
  sub: string[];
  adjuncts: string[];
};

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function executeOnOrdinaryFocus(letter: FamilyLetter) {
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

  executeLetterForTest(state, token, {
    wordText: `א${letter}`,
    isWordFinal: false,
    prevBoundaryMode: "hard"
  });

  return state;
}

function normalizeEdges(edges: Iterable<string>, ids: Record<string, string>): string[] {
  return Array.from(edges, (edge) => {
    const [from, to] = parseEdge(edge);
    return `${ids[from] ?? from}->${ids[to] ?? to}`;
  }).sort();
}

function normalizeTopology(state: ReturnType<typeof executeOnOrdinaryFocus>): {
  head: string;
  leg: string | null;
  topology: NormalizedTopology;
} {
  const [headOfEdge] = Array.from(state.head_of);
  if (!headOfEdge) {
    throw new Error("Missing head_of edge");
  }
  const [head, source] = parseEdge(headOfEdge);
  const [leg] = state.adjuncts[head] ?? [];
  const ids: Record<string, string> = {
    [source]: "X",
    [head]: "h"
  };
  if (leg) {
    ids[leg] = "ℓ";
  }

  return {
    head,
    leg: leg ?? null,
    topology: {
      focus: ids[state.vm.F] ?? state.vm.F,
      head_of: normalizeEdges(state.head_of, ids),
      carry: normalizeEdges(state.carry, ids),
      cont: normalizeEdges(state.cont, ids),
      supp: normalizeEdges(state.supp, ids),
      sub: normalizeEdges(state.sub, ids),
      adjuncts: (state.adjuncts[head] ?? []).map((adjunct) => ids[adjunct] ?? adjunct).sort()
    }
  };
}

function eventTypes(state: ReturnType<typeof executeOnOrdinaryFocus>): string[] {
  return state.vm.H.map((event) => event.type);
}

describe("head-family topology", () => {
  it("A: ה from ordinary focus adds the resolved head+leg graph and keeps focus on the head", () => {
    const state = executeOnOrdinaryFocus("ה");
    const { head, leg, topology } = normalizeTopology(state);

    expect(topology).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h", "h->ℓ"],
      cont: ["X->h", "h->ℓ"],
      supp: ["h->X", "ℓ->h"],
      sub: ["h->ℓ"],
      adjuncts: ["ℓ"]
    });
    expect(head).toBe(state.vm.F);
    expect(leg).not.toBeNull();
    expect(state.adjuncts[head]).toEqual([leg]);
  });

  it("B: ק from ordinary focus adds the unresolved head+leg graph and keeps focus on the head", () => {
    const state = executeOnOrdinaryFocus("ק");
    const { head, leg, topology } = normalizeTopology(state);

    expect(topology).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h", "h->ℓ"],
      cont: ["X->h", "h->ℓ"],
      supp: [],
      sub: ["h->ℓ"],
      adjuncts: ["ℓ"]
    });
    expect(head).toBe(state.vm.F);
    expect(leg).not.toBeNull();
    expect(state.adjuncts[head]).toEqual([leg]);
  });

  it("C: preserves the structural square across ר/ד/ק/ה using actual graph edges", () => {
    const family = {
      ר: normalizeTopology(executeOnOrdinaryFocus("ר")).topology,
      ד: normalizeTopology(executeOnOrdinaryFocus("ד")).topology,
      ק: normalizeTopology(executeOnOrdinaryFocus("ק")).topology,
      ה: normalizeTopology(executeOnOrdinaryFocus("ה")).topology
    };

    expect(family["ר"]).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h"],
      cont: ["X->h"],
      supp: [],
      sub: [],
      adjuncts: []
    });
    expect(family["ד"]).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h"],
      cont: ["X->h"],
      supp: ["h->X"],
      sub: [],
      adjuncts: []
    });
    expect(family["ק"]).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h", "h->ℓ"],
      cont: ["X->h", "h->ℓ"],
      supp: [],
      sub: ["h->ℓ"],
      adjuncts: ["ℓ"]
    });
    expect(family["ה"]).toEqual({
      focus: "h",
      head_of: ["h->X"],
      carry: ["X->h", "h->ℓ"],
      cont: ["X->h", "h->ℓ"],
      supp: ["h->X", "ℓ->h"],
      sub: ["h->ℓ"],
      adjuncts: ["ℓ"]
    });
  });

  it("D: legacy ה/ק artifacts are absent", () => {
    const heState = executeOnOrdinaryFocus("ה");
    const qofState = executeOnOrdinaryFocus("ק");

    expect(eventTypes(heState)).toEqual(["head_with_leg"]);
    expect(heState.rules).toEqual([]);
    expect(
      Array.from(heState.handles.values()).some(
        (handle) => handle.kind === "rule" || handle.meta?.public || handle.meta?.announcement
      )
    ).toBe(false);

    expect(eventTypes(qofState)).toEqual(["head_with_leg"]);
    expect(Array.from(qofState.handles.values()).some((handle) => handle.kind === "alias")).toBe(
      false
    );
    expect(
      Array.from(qofState.handles.values()).some(
        (handle) => handle.meta?.approx === true || handle.meta?.representative_class
      )
    ).toBe(false);
    expect(qofState.links.some((link) => link.label === "approx")).toBe(false);
  });
});
