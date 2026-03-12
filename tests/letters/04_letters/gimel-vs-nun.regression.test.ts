import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { createInitialState } from "@ref/state/state";

type LetterUnderTest = "ג" | "נ";
type EdgeLabel = "cont" | "carry" | "supp";
type EmittedEdge = {
  label: EdgeLabel;
  from: string;
  to: string;
};
type EmittedGraph = {
  root: string;
  focus: string;
  nodes: string[];
  edges: EmittedEdge[];
};

function createSingleLetterDispatcher(letter: LetterUnderTest) {
  return createTokenDispatcher({
    schema_version: 1,
    source: { registry_path: "test", registry_sha256: null },
    semantics: {
      definitions_path: "test",
      schema_version: null,
      semver: "0.0.0-test",
      definitions_sha256: "test"
    },
    compile_policy: {
      illegal_combinations: "error",
      unknown_marks: "error",
      orthographic_noise: "strip"
    },
    stats: {
      tokens_total: 1,
      warning_count: 0,
      warning_by_code: {}
    },
    tokens: {
      "1": {
        token_id: 1,
        signature: `BASE=${letter}|MARKS=NONE`,
        base: letter,
        count: 1,
        op_family: letter === "ג" ? "GIMEL" : "NUN",
        modifiers: [],
        raw_marks: [],
        derived: {
          rosh: [],
          toch: [],
          sof: [],
          dot_kind: "none",
          inside_dot_kind: "none",
          modes: [],
          ignored_marks: []
        },
        execution_plan: [],
        event_contract: [],
        warnings: [],
        runtime: {
          token_letter: letter,
          read_letter: letter,
          shape_letter: null,
          shape_effect_scope: null,
          rosh_branch: null,
          letter_mode_forced: null,
          has_shuruk: false,
          should_harden: false,
          sof_modifiers: []
        }
      }
    }
  });
}

function parseEdge(edge: string, label: EdgeLabel): EmittedEdge {
  const [from, to] = edge.split("->");
  return { label, from: from ?? "", to: to ?? "" };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    const current = items[index] as T;
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) {
      out.push([current, ...tail]);
    }
  }
  return out;
}

function edgeKey(edge: EmittedEdge): string {
  return `${edge.label}:${edge.from}->${edge.to}`;
}

function areGraphsIsomorphic(left: EmittedGraph, right: EmittedGraph): boolean {
  if (left.nodes.length !== right.nodes.length || left.edges.length !== right.edges.length) {
    return false;
  }

  const leftFocusIsRoot = left.focus === left.root;
  const rightFocusIsRoot = right.focus === right.root;
  if (leftFocusIsRoot !== rightFocusIsRoot) {
    return false;
  }

  const leftInterior = left.nodes.filter((node) => node !== left.root && node !== left.focus);
  const rightInterior = right.nodes.filter((node) => node !== right.root && node !== right.focus);
  if (leftInterior.length !== rightInterior.length) {
    return false;
  }

  const rightEdgeKeys = new Set(right.edges.map(edgeKey));
  for (const candidate of permutations(rightInterior)) {
    const mapping = new Map<string, string>([
      [left.root, right.root],
      [left.focus, right.focus]
    ]);
    leftInterior.forEach((node, index) => {
      mapping.set(node, candidate[index] as string);
    });
    const mappedEdgeKeys = left.edges.map((edge) =>
      edgeKey({
        label: edge.label,
        from: mapping.get(edge.from) ?? "",
        to: mapping.get(edge.to) ?? ""
      })
    );
    if (mappedEdgeKeys.every((key) => rightEdgeKeys.has(key))) {
      return true;
    }
  }

  return false;
}

function runSingleLetter(letter: LetterUnderTest): {
  F0: string;
  finalFocus: string;
  newNodes: string[];
  newCont: string[];
  newCarry: string[];
  newSupp: string[];
  graph: EmittedGraph;
} {
  const dispatcher = createSingleLetterDispatcher(letter);
  const state = createInitialState();
  const F0 = state.vm.F;
  const initialHandleIds = new Set(state.handles.keys());
  const initialCont = new Set(state.cont);
  const initialCarry = new Set(state.carry);
  const initialSupp = new Set(state.supp);

  dispatcher.apply(1, state, { isWordFinal: true });

  const finalFocus = state.vm.F;
  const newNodes = Array.from(state.handles.keys()).filter((id) => !initialHandleIds.has(id));
  const newCont = Array.from(state.cont).filter((edge) => !initialCont.has(edge));
  const newCarry = Array.from(state.carry).filter((edge) => !initialCarry.has(edge));
  const newSupp = Array.from(state.supp).filter((edge) => !initialSupp.has(edge));

  return {
    F0,
    finalFocus,
    newNodes,
    newCont,
    newCarry,
    newSupp,
    graph: {
      root: F0,
      focus: finalFocus,
      nodes: [F0, ...newNodes],
      edges: [
        ...newCont.map((edge) => parseEdge(edge, "cont")),
        ...newCarry.map((edge) => parseEdge(edge, "carry")),
        ...newSupp.map((edge) => parseEdge(edge, "supp"))
      ]
    }
  };
}

describe("gimel vs nun regression", () => {
  it("keeps ג structurally distinct from נ", () => {
    const nun = runSingleLetter("נ");
    const gimel = runSingleLetter("ג");

    expect(nun.newNodes).toHaveLength(1);
    const [N1] = nun.newNodes;
    expect(N1).toBeDefined();
    expect(nun.newCont).toEqual([`${nun.F0}->${N1}`]);
    expect(nun.newCarry).toEqual([`${nun.F0}->${N1}`]);
    expect(nun.finalFocus).toBe(N1);

    expect(gimel.newNodes).toHaveLength(2);
    const [M, G1] = gimel.newNodes;
    expect(M).toBeDefined();
    expect(G1).toBeDefined();
    expect(gimel.newCont).toHaveLength(2);
    expect(gimel.newCarry).toEqual([`${gimel.F0}->${M}`]);
    expect(gimel.newCont).toContain(`${gimel.F0}->${M}`);
    expect(gimel.newCont).toContain(`${M}->${G1}`);
    expect(gimel.finalFocus).toBe(G1);

    expect(areGraphsIsomorphic(nun.graph, gimel.graph)).toBe(false);
  });
});
