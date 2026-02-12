import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORPUS_SCRIPT = path.resolve(process.cwd(), "scripts", "torah-corpus.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

function writeJson(pathName: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(pathName), { recursive: true });
  fs.writeFileSync(pathName, JSON.stringify(payload, null, 2), "utf8");
}

function writeJsonl(pathName: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathName), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  fs.writeFileSync(pathName, content, "utf8");
}

describe("torah corpus regress pipeline", () => {
  it("writes diff + goldens + regression and fails loudly on mismatch", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "torah-corpus-regress-test-"));
    const runADir = path.join(tmpDir, "run-a");
    const runBDir = path.join(tmpDir, "run-b");

    const runATrace = path.join(runADir, "word_traces.jsonl");
    const runBTrace = path.join(runBDir, "word_traces.jsonl");
    const compiledAPath = path.join(runADir, "tokens.compiled.json");
    const compiledBPath = path.join(runBDir, "tokens.compiled.json");
    const diffPath = path.join(tmpDir, "diffs", "runA_vs_runB.md");
    const goldensPath = path.join(tmpDir, "tests", "goldens.json");
    const regressionPath = path.join(tmpDir, "reports", "regression_report.md");

    writeJson(compiledAPath, {
      semantics: { semver: "1.0.0", definitions_sha256: "defs-a" },
      source: { registry_sha256: "registry-a" },
      stats: {
        warning_count: 2,
        warning_by_code: { ORTHOGRAPHIC_MARK_IGNORED: 2 }
      },
      tokens: {
        "1": {
          warnings: [{ code: "ORTHOGRAPHIC_MARK_IGNORED" }]
        },
        "2": { warnings: [] },
        "3": {
          warnings: [{ code: "ORTHOGRAPHIC_MARK_IGNORED" }]
        },
        "4": { warnings: [] },
        "5": { warnings: [] },
        "6": { warnings: [] }
      }
    });

    writeJson(compiledBPath, {
      semantics: { semver: "1.1.0", definitions_sha256: "defs-b" },
      source: { registry_sha256: "registry-b" },
      stats: {
        warning_count: 0,
        warning_by_code: {}
      },
      tokens: {
        "1": { warnings: [] },
        "2": { warnings: [] },
        "3": { warnings: [] },
        "4": { warnings: [] },
        "5": { warnings: [] },
        "6": { warnings: [] }
      }
    });

    const rowsA = [
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "נ",
        token_ids: [1],
        skeleton: ["NUN.SUPPORT_DEBT"],
        flow: "נ support debt",
        semantics_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "נס",
        token_ids: [1, 2],
        skeleton: ["NUN.SUPPORT_DEBT", "SAMEKH.SUPPORT_DISCHARGE"],
        flow: "נ support debt -> ס support discharge",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 3 },
        ref_key: "Genesis/1/1/3",
        surface: "את",
        token_ids: [2, 3],
        skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
        flow: "א alias -> ת finalize",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 4 },
        ref_key: "Genesis/1/1/4",
        surface: "הּ",
        token_ids: [4],
        skeleton: ["HE.DECLARE_PIN"],
        flow: "ה pin export",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 5 },
        ref_key: "Genesis/1/1/5",
        surface: "ם",
        token_ids: [5],
        skeleton: ["FINAL_MEM.CLOSE"],
        flow: "ם close mem-zone",
        semantic_version: "1.0.0"
      }
    ];

    const rowsB = [
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "נ",
        token_ids: [1],
        skeleton: ["NUN.SUPPORT_DEBT"],
        flow: "נ support debt (text changed)",
        semantic_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "נס",
        token_ids: [1, 2],
        skeleton: ["NUN.SUPPORT_DEBT", "FINAL_NUN.SUPPORT_DISCHARGE"],
        flow: "נ support debt -> ן same-word discharge",
        semantic_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 3 },
        ref_key: "Genesis/1/1/3",
        surface: "את",
        token_ids: [2, 3],
        skeleton: ["TAV.FINALIZE", "ALEPH.ALIAS"],
        flow: "ת finalize -> א alias",
        semantic_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 4 },
        ref_key: "Genesis/1/1/4",
        surface: "הּ",
        token_ids: [4],
        skeleton: ["HE.DECLARE_PIN", "TAV.FINALIZE"],
        flow: "ה pin export -> ת finalize",
        semantic_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 6 },
        ref_key: "Genesis/1/1/6",
        surface: "שׁ",
        token_ids: [6],
        skeleton: ["SHIN.FORK"],
        flow: "ש fork route",
        semantic_version: "1.1.0"
      }
    ];

    writeJsonl(runATrace, rowsA);
    writeJsonl(runBTrace, rowsB);

    const passRunOut = runNode([
      CORPUS_SCRIPT,
      "regress",
      `--run-a=${runATrace}`,
      `--run-b=${runBTrace}`,
      `--compiled-a=${compiledAPath}`,
      `--compiled-b=${compiledBPath}`,
      `--diff-out=${diffPath}`,
      `--goldens=${goldensPath}`,
      `--regression-out=${regressionPath}`,
      "--update-goldens",
      "--golden-limit=8"
    ]);

    expect(passRunOut).toContain("regress:");
    expect(fs.existsSync(diffPath)).toBe(true);
    expect(fs.existsSync(goldensPath)).toBe(true);
    expect(fs.existsSync(regressionPath)).toBe(true);

    const diffText = fs.readFileSync(diffPath, "utf8");
    expect(diffText).toContain("## Breaking Changes (Tokenization / Ingestion)");
    expect(diffText).toContain("## Top Skeleton Delta Groups");
    expect(diffText).toContain("REPLACE:SAMEKH.SUPPORT_DISCHARGE→FINAL_NUN.SUPPORT_DISCHARGE");

    const goldenPayload = JSON.parse(fs.readFileSync(goldensPath, "utf8"));
    expect(goldenPayload.count).toBeGreaterThan(0);
    expect(Array.isArray(goldenPayload.cases)).toBe(true);
    expect(goldenPayload.cases[0].expected_skeleton).toBeDefined();

    const passReport = fs.readFileSync(regressionPath, "utf8");
    expect(passReport).toContain("- failed: 0");
    expect(passReport).toContain("- PASS");

    const brokenRowsB = rowsB.map((row) => ({ ...row }));
    brokenRowsB[1].skeleton = ["NUN.SUPPORT_DEBT"];
    brokenRowsB[1].flow = "נ support debt";
    writeJsonl(runBTrace, brokenRowsB);

    let didFail = false;
    try {
      runNode([
        CORPUS_SCRIPT,
        "regress",
        `--run-a=${runATrace}`,
        `--run-b=${runBTrace}`,
        `--compiled-a=${compiledAPath}`,
        `--compiled-b=${compiledBPath}`,
        `--diff-out=${diffPath}`,
        `--goldens=${goldensPath}`,
        `--regression-out=${regressionPath}`
      ]);
    } catch (err: any) {
      didFail = true;
      expect(err.status).toBe(1);
    }
    expect(didFail).toBe(true);

    const failReport = fs.readFileSync(regressionPath, "utf8");
    expect(failReport).toContain("- FAIL");
    expect(failReport).toContain("skeleton mismatch");
  });
});
