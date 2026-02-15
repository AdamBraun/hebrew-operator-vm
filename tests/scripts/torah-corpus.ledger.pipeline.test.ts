import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORPUS_SCRIPT = path.resolve(process.cwd(), "scripts", "torah-corpus.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("torah corpus verse ledger pipeline", () => {
  it("emits clause-aware verse ledger blocks derived from phrase trees", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "torah-corpus-ledger-test-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "outputs");
    const verseLedgerPath = path.join(outDir, "verse_ledger.jsonl");

    const fixture = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                {
                  n: 1,
                  he: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ"
                }
              ]
            }
          ]
        }
      ]
    };
    fs.writeFileSync(inputPath, JSON.stringify(fixture, null, 2), "utf8");

    const firstRunOut = runNode([
      CORPUS_SCRIPT,
      "run-all",
      `--input=${inputPath}`,
      `--out-dir=${outDir}`,
      "--lang=he"
    ]);
    expect(firstRunOut).toContain("done: words=7");
    expect(fs.existsSync(verseLedgerPath)).toBe(true);

    const firstLedgerText = fs.readFileSync(verseLedgerPath, "utf8");
    const verseLedgerRows = firstLedgerText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    expect(verseLedgerRows).toHaveLength(1);
    expect(verseLedgerRows[0].record_kind).toBe("VERSE_LEDGER");
    expect(verseLedgerRows[0].ref_key).toBe("Genesis/1/1");
    expect(Array.isArray(verseLedgerRows[0].clauses)).toBe(true);

    const clauses = verseLedgerRows[0].clauses as Array<Record<string, unknown>>;
    expect(clauses.map((clause) => String(clause.clause_id))).toEqual(["C1", "C2"]);

    const c1 = clauses.find((clause) => clause.clause_id === "C1") as Record<string, unknown>;
    const c2 = clauses.find((clause) => clause.clause_id === "C2") as Record<string, unknown>;
    const c1NodeIds = (c1.subtrees as Array<{ phrase_node_id: string }>).map(
      (row) => row.phrase_node_id
    );
    const c2NodeIds = (c2.subtrees as Array<{ phrase_node_id: string }>).map(
      (row) => row.phrase_node_id
    );
    expect(c1NodeIds).toContain("n_1_3_split");
    expect(c2NodeIds).toContain("n_4_7_split");

    const secondRunOut = runNode([
      CORPUS_SCRIPT,
      "run-all",
      `--input=${inputPath}`,
      `--out-dir=${outDir}`,
      "--lang=he"
    ]);
    expect(secondRunOut).toContain("done: words=7");
    expect(fs.readFileSync(verseLedgerPath, "utf8")).toBe(firstLedgerText);
  });
});
