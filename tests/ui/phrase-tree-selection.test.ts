import { describe, expect, it } from "vitest";
import { derivePhraseSelection, spanToWordIndices } from "../../packages/ui/src/components/phraseTreeSelection";
import type { PhraseNode } from "../../packages/ui/src/lib/contracts/versePhraseTrees";
import type { WordPhraseRoleRecord } from "../../packages/ui/src/lib/contracts/wordPhraseRoles";

const TREE: PhraseNode = {
  id: "n_1_7_split",
  node_type: "SPLIT",
  span: { start: 1, end: 7 },
  split_word_index: 3,
  split_accent: { codepoint: "U+0591", name: "etnahta", precedence: 2 },
  left: {
    id: "n_1_3_split",
    node_type: "SPLIT",
    span: { start: 1, end: 3 },
    split_word_index: 1,
    split_accent: { codepoint: "U+0596", name: "tipcha", precedence: 1 },
    left: {
      id: "w_1",
      node_type: "LEAF",
      span: { start: 1, end: 1 },
      word_index: 1,
      surface: "A",
      accent: {
        word_index: 1,
        class: "DISJUNCTIVE",
        codepoint: "U+0596",
        name: "tipcha",
        precedence: 1,
        observed_teamim: ["U+0596"]
      }
    },
    right: {
      id: "n_2_3_join",
      node_type: "JOIN",
      span: { start: 2, end: 3 },
      fold: "LEFT",
      left: {
        id: "w_2",
        node_type: "LEAF",
        span: { start: 2, end: 2 },
        word_index: 2,
        surface: "B",
        accent: {
          word_index: 2,
          class: "CONJUNCTIVE",
          codepoint: "U+05A3",
          name: "munach",
          precedence: 1,
          observed_teamim: ["U+05A3"]
        }
      },
      right: {
        id: "w_3",
        node_type: "LEAF",
        span: { start: 3, end: 3 },
        word_index: 3,
        surface: "C",
        accent: {
          word_index: 3,
          class: "DISJUNCTIVE",
          codepoint: "U+0591",
          name: "etnahta",
          precedence: 2,
          observed_teamim: ["U+0591"]
        }
      }
    }
  },
  right: {
    id: "n_4_7_split",
    node_type: "SPLIT",
    span: { start: 4, end: 7 },
    split_word_index: 5,
    split_accent: { codepoint: "U+0596", name: "tipcha", precedence: 1 },
    left: {
      id: "n_4_5_join",
      node_type: "JOIN",
      span: { start: 4, end: 5 },
      fold: "LEFT",
      left: {
        id: "w_4",
        node_type: "LEAF",
        span: { start: 4, end: 4 },
        word_index: 4,
        surface: "D",
        accent: {
          word_index: 4,
          class: "CONJUNCTIVE",
          codepoint: "U+05A5",
          name: "merkha",
          precedence: 1,
          observed_teamim: ["U+05A5"]
        }
      },
      right: {
        id: "w_5",
        node_type: "LEAF",
        span: { start: 5, end: 5 },
        word_index: 5,
        surface: "E",
        accent: {
          word_index: 5,
          class: "DISJUNCTIVE",
          codepoint: "U+0596",
          name: "tipcha",
          precedence: 1,
          observed_teamim: ["U+0596"]
        }
      }
    },
    right: {
      id: "n_6_7_join",
      node_type: "JOIN",
      span: { start: 6, end: 7 },
      fold: "LEFT",
      left: {
        id: "w_6",
        node_type: "LEAF",
        span: { start: 6, end: 6 },
        word_index: 6,
        surface: "F",
        accent: {
          word_index: 6,
          class: "CONJUNCTIVE",
          codepoint: "U+05A5",
          name: "merkha",
          precedence: 1,
          observed_teamim: ["U+05A5"]
        }
      },
      right: {
        id: "w_7",
        node_type: "LEAF",
        span: { start: 7, end: 7 },
        word_index: 7,
        surface: "G",
        accent: {
          word_index: 7,
          class: "NONE",
          codepoint: null,
          name: null,
          precedence: 0,
          observed_teamim: []
        }
      }
    }
  }
};

const WORD_ROLES: WordPhraseRoleRecord[] = [
  {
    ref_key: "Genesis/1/1",
    word_index: 5,
    surface: "E",
    primary_accent: {
      word_index: 5,
      class: "DISJUNCTIVE",
      codepoint: "U+0596",
      name: "tipcha",
      precedence: 1,
      observed_teamim: ["U+0596"]
    },
    phrase_role: "SPLIT",
    phrase_path: ["w_5", "n_4_5_join", "n_4_7_split", "n_1_7_split"],
    clause_id: "C2",
    subclause_id: "C2.1",
    phrase_version: "phrase_tree.v1"
  }
];

describe("phrase tree selection", () => {
  it("highlights the correct span when a node is selected", () => {
    const selection = derivePhraseSelection({
      tree: TREE,
      wordCount: 7,
      wordPhraseRoles: WORD_ROLES,
      selectedNodeId: "n_4_5_join",
      selectedWordIndex: null
    });

    expect(selection.highlightedWordIndices).toEqual([4, 5]);
    expect(selection.highlightedNodeIds).toEqual(["n_4_5_join"]);
  });

  it("highlights the leaf-to-root path when a word is selected", () => {
    const selection = derivePhraseSelection({
      tree: TREE,
      wordCount: 7,
      wordPhraseRoles: WORD_ROLES,
      selectedNodeId: null,
      selectedWordIndex: 5
    });

    expect(selection.highlightedWordIndices).toEqual([5]);
    expect(selection.highlightedNodeIds).toEqual([
      "w_5",
      "n_4_5_join",
      "n_4_7_split",
      "n_1_7_split"
    ]);
  });

  it("returns in-range indices for spans", () => {
    expect(spanToWordIndices({ start: 0, end: 9 }, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
