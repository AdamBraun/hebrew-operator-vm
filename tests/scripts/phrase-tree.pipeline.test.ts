import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "phrase-tree.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("phrase tree pipeline", () => {
  it("writes deterministic artifacts and verify gate passes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phrase-tree-test-"));
    const input = path.join(tmpDir, "torah.normalized.teamim.txt");
    const classification = path.join(tmpDir, "teamim.classification.json");
    const treeOut = path.join(tmpDir, "verse_phrase_trees.jsonl");
    const wordOut = path.join(tmpDir, "word_phrase_roles.jsonl");
    const reportOut = path.join(tmpDir, "phrase_tree_report.md");

    fs.writeFileSync(
      input,
      ["Genesis 1:1\tא֖ ב֣ ג֑ ד֣", "Genesis 1:2\tה֣ ו֣", ""].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      classification,
      `${JSON.stringify(
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
      )}\n`,
      "utf8"
    );

    const firstRunOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--classification=${classification}`,
      `--tree-out=${treeOut}`,
      `--word-out=${wordOut}`,
      `--report-out=${reportOut}`,
      "--book=Genesis"
    ]);
    expect(firstRunOut).toContain("done:");

    const firstTree = fs.readFileSync(treeOut, "utf8");
    const firstWord = fs.readFileSync(wordOut, "utf8");
    const firstReport = fs.readFileSync(reportOut, "utf8");

    const rerunOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--classification=${classification}`,
      `--tree-out=${treeOut}`,
      `--word-out=${wordOut}`,
      `--report-out=${reportOut}`,
      "--book=Genesis"
    ]);
    expect(rerunOut).toContain("done:");
    expect(fs.readFileSync(treeOut, "utf8")).toBe(firstTree);
    expect(fs.readFileSync(wordOut, "utf8")).toBe(firstWord);
    expect(fs.readFileSync(reportOut, "utf8")).toBe(firstReport);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--input=${input}`,
      `--classification=${classification}`,
      `--tree-out=${treeOut}`,
      `--word-out=${wordOut}`,
      `--report-out=${reportOut}`,
      "--book=Genesis"
    ]);
    expect(verifyOut).toContain("verify: ok");

    expect(firstTree.trim().split(/\r?\n/u)).toHaveLength(2);
    expect(firstWord.trim().split(/\r?\n/u)).toHaveLength(6);
    expect(firstReport).toContain("# Phrase Tree Report");
  });
});
