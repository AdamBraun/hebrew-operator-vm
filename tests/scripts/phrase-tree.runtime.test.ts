import { describe, expect, it } from "vitest";
import {
  buildArtifacts,
  parseArgs,
  parseInputRecords,
  type PhraseLeafNode,
  type PhraseNode,
  validateTree
} from "@ref/scripts/phraseTree/runtime";

function fixtureClassification(): string {
  return `${JSON.stringify(
    {
      schema_version: 1,
      entries: {
        "U+0591": {
          codepoint: "U+0591",
          unicode_name: "HEBREW ACCENT ETNAHTA",
          hebrew_name: "etnahta",
          class: "DISJUNCTIVE",
          precedence: 2
        },
        "U+0596": {
          codepoint: "U+0596",
          unicode_name: "HEBREW ACCENT TIPEHA",
          hebrew_name: "tipcha",
          class: "DISJUNCTIVE",
          precedence: 1
        },
        "U+05A3": {
          codepoint: "U+05A3",
          unicode_name: "HEBREW ACCENT MUNAH",
          hebrew_name: "munach",
          class: "CONJUNCTIVE",
          precedence: 1
        }
      }
    },
    null,
    2
  )}\n`;
}

function parseJsonl<T>(jsonl: string): T[] {
  return jsonl
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

describe("phrase tree runtime", () => {
  it("parses command/options", () => {
    const parsed = parseArgs([
      "verify",
      "--input=/tmp/in.txt",
      "--classification=/tmp/classification.json",
      "--tree-out=/tmp/trees.jsonl",
      "--word-out=/tmp/roles.jsonl",
      "--report-out=/tmp/report.md",
      "--book=Genesis"
    ]);

    expect(parsed.command).toBe("verify");
    expect(parsed.opts).toEqual({
      input: "/tmp/in.txt",
      classification: "/tmp/classification.json",
      treeOut: "/tmp/trees.jsonl",
      wordOut: "/tmp/roles.jsonl",
      reportOut: "/tmp/report.md",
      bookFilter: "Genesis"
    });
  });

  it("parses mixed line formats into records", () => {
    const records = parseInputRecords(["Genesis 1:1\tא֖ ב֣", "", "Genesis 1:2\tג֑", ""].join("\n"));

    expect(records).toEqual([
      { ref: "Genesis 1:1", lineNumber: 1, text: "א֖ ב֣" },
      { ref: "Genesis 1:2", lineNumber: 3, text: "ג֑" }
    ]);
  });

  it("builds exact expected tree structure for fixture verse", () => {
    const input = ["Genesis 1:1\tא֖ ב֣ ג֑ ד֣", ""].join("\n");
    const built = buildArtifacts(
      input,
      fixtureClassification(),
      "/tmp/torah.normalized.teamim.txt",
      "/tmp/teamim.classification.json",
      "Genesis"
    );

    const verseRows = parseJsonl<{
      ref_key: string;
      words: string[];
      primary_accents: Array<{ codepoint: string | null; class: string }>;
      tree: PhraseNode;
    }>(built.treeJsonl);
    expect(verseRows.length).toBe(1);

    const row = verseRows[0];
    expect(row.ref_key).toBe("Genesis/1/1");
    expect(row.words).toEqual(["א֖", "ב֣", "ג֑", "ד֣"]);
    expect(row.primary_accents.map((accent) => accent.codepoint)).toEqual([
      "U+0596",
      "U+05A3",
      "U+0591",
      "U+05A3"
    ]);
    expect(row.primary_accents.map((accent) => accent.class)).toEqual([
      "DISJUNCTIVE",
      "CONJUNCTIVE",
      "DISJUNCTIVE",
      "CONJUNCTIVE"
    ]);

    expect(row.tree).toEqual({
      id: "n_1_4_split",
      node_type: "SPLIT",
      span: { start: 1, end: 4 },
      split_word_index: 3,
      split_accent: {
        codepoint: "U+0591",
        name: "etnahta",
        precedence: 2
      },
      left: {
        id: "n_1_3_split",
        node_type: "SPLIT",
        span: { start: 1, end: 3 },
        split_word_index: 1,
        split_accent: {
          codepoint: "U+0596",
          name: "tipcha",
          precedence: 1
        },
        left: {
          id: "w_1",
          node_type: "LEAF",
          span: { start: 1, end: 1 },
          word_index: 1,
          surface: "א֖",
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
            surface: "ב֣",
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
            surface: "ג֑",
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
        id: "w_4",
        node_type: "LEAF",
        span: { start: 4, end: 4 },
        word_index: 4,
        surface: "ד֣",
        accent: {
          word_index: 4,
          class: "CONJUNCTIVE",
          codepoint: "U+05A3",
          name: "munach",
          precedence: 1,
          observed_teamim: ["U+05A3"]
        }
      }
    });

    const validation = validateTree(row.tree, row.words.length);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);

    const wordRows = parseJsonl<{
      ref_key: string;
      word_index: number;
      phrase_role: string;
      phrase_path: string[];
      clause_id: string;
      subclause_id: string;
    }>(built.wordJsonl);
    const compactRows = wordRows.map((row) => ({
      ref_key: row.ref_key,
      word_index: row.word_index,
      phrase_role: row.phrase_role,
      phrase_path: row.phrase_path,
      clause_id: row.clause_id,
      subclause_id: row.subclause_id
    }));
    expect(compactRows).toEqual([
      {
        ref_key: "Genesis/1/1",
        word_index: 1,
        phrase_role: "SPLIT",
        phrase_path: ["w_1", "n_1_3_split", "n_1_4_split"],
        clause_id: "C1",
        subclause_id: "C1.1"
      },
      {
        ref_key: "Genesis/1/1",
        word_index: 2,
        phrase_role: "JOIN",
        phrase_path: ["w_2", "n_2_3_join", "n_1_3_split", "n_1_4_split"],
        clause_id: "C1",
        subclause_id: "C1.2"
      },
      {
        ref_key: "Genesis/1/1",
        word_index: 3,
        phrase_role: "SPLIT",
        phrase_path: ["w_3", "n_2_3_join", "n_1_3_split", "n_1_4_split"],
        clause_id: "C1",
        subclause_id: "C1.2"
      },
      {
        ref_key: "Genesis/1/1",
        word_index: 4,
        phrase_role: "TAIL",
        phrase_path: ["w_4", "n_1_4_split"],
        clause_id: "C2",
        subclause_id: "C2"
      }
    ]);
  });

  it("is deterministic across repeated builds", () => {
    const input = ["Genesis 1:1\tא֖ ב֣ ג֑ ד֣", "Genesis 1:2\tה֣ ו֣", ""].join("\n");
    const first = buildArtifacts(
      input,
      fixtureClassification(),
      "/tmp/torah.normalized.teamim.txt",
      "/tmp/teamim.classification.json",
      "Genesis"
    );
    const second = buildArtifacts(
      input,
      fixtureClassification(),
      "/tmp/torah.normalized.teamim.txt",
      "/tmp/teamim.classification.json",
      "Genesis"
    );

    expect(second.treeJsonl).toBe(first.treeJsonl);
    expect(second.wordJsonl).toBe(first.wordJsonl);
    expect(second.reportText).toBe(first.reportText);
  });

  it("fails tree validation when spans are malformed", () => {
    const accent = {
      word_index: 1,
      class: "NONE",
      codepoint: null,
      name: null,
      precedence: 0,
      observed_teamim: []
    } as const;

    const malformed: PhraseNode = {
      id: "n_1_2_join",
      node_type: "JOIN",
      span: { start: 1, end: 2 },
      fold: "LEFT",
      left: {
        id: "w_1",
        node_type: "LEAF",
        span: { start: 1, end: 1 },
        word_index: 1,
        surface: "א",
        accent
      },
      right: {
        id: "w_2",
        node_type: "LEAF",
        span: { start: 3, end: 3 },
        word_index: 2,
        surface: "ב",
        accent: { ...accent, word_index: 2 }
      } as PhraseLeafNode
    };

    const validation = validateTree(malformed, 2);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" | ")).toMatch(
      /Gap\/overlap|Parent span mismatch|Leaf span mismatch/u
    );
  });

  it("strips parasha markers and heals split metadata fragments", () => {
    const input = [
      "Genesis 1:1\tבְּ רֵאשִׁ֖ית בָּרָ֣א {פ}",
      "Genesis 1:2\tוַיְהִי {ס}",
      "Genesis 1:3\tקַ֣ צְתִּי",
      "Genesis 1:4\tוְלִבְ כֹּ תָֽהּ׃",
      ""
    ].join("\n");
    const built = buildArtifacts(
      input,
      fixtureClassification(),
      "/tmp/torah.normalized.teamim.txt",
      "/tmp/teamim.classification.json",
      "Genesis"
    );

    const verseRows = parseJsonl<{ ref_key: string; words: string[] }>(built.treeJsonl);
    expect(verseRows[0]?.words[0]).toBe("בְּרֵאשִׁ֖ית");
    expect(verseRows[0]?.words).not.toContain("פ");
    expect(verseRows[1]?.words).not.toContain("ס");
    expect(verseRows[2]?.words[0]).toBe("קַ֣צְתִּי");
    expect(verseRows[3]?.words[0]).toBe("וְלִבְכֹּתָהּ");
    expect(built.healings.some((healing) => healing.kind === "PARASHA_MARKER_REMOVED")).toBe(true);
    expect(built.healings.some((healing) => healing.kind === "SPLIT_FRAGMENT_JOINED")).toBe(true);
    expect(
      built.healings.some(
        (healing) =>
          healing.kind === "SPLIT_FRAGMENT_JOINED" && healing.detail.includes("וְלִבְ + כֹּ + תָהּ")
      )
    ).toBe(true);
  });
});
