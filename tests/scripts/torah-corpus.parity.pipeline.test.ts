import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORPUS_SCRIPT = path.resolve(process.cwd(), "scripts", "torah-corpus.mjs");
const TOKEN_REGISTRY_SCRIPT = path.resolve(process.cwd(), "scripts", "extract-token-registry.mjs");
const TOKEN_COMPILE_SCRIPT = path.resolve(process.cwd(), "scripts", "compile-token-operators.mjs");
const DEFINITIONS = path.resolve(process.cwd(), "registry", "token-semantics.json");
const PARITY_ROOT = path.resolve(process.cwd(), ".tmp", "torah-corpus-parity");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

function resetDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256File(filePath: string): string {
  const raw = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

describe("torah corpus CLI parity checksums", () => {
  it("keeps execute output checksums stable", () => {
    const dir = path.join(PARITY_ROOT, "execute");
    resetDir(dir);

    const inputPath = path.join(dir, "torah.json");
    const normalizedPath = path.join(dir, "torah.normalized.txt");
    const tokenRegistryPath = path.join(dir, "tokens.registry.json");
    const signaturesPath = path.join(dir, "tokens.signatures.txt");
    const tokenRegistryReportPath = path.join(dir, "token_registry_report.md");
    const compiledBundlesPath = path.join(dir, "tokens.compiled.json");
    const compileReportPath = path.join(dir, "compile_report.md");
    const tracesPath = path.join(dir, "corpus", "word_traces.jsonl");
    const flowsPath = path.join(dir, "corpus", "word_flows.txt");
    const verseTracesPath = path.join(dir, "corpus", "verse_traces.jsonl");
    const verseMotifIndexPath = path.join(dir, "index", "verse_motif_index.json");
    const executionReportPath = path.join(dir, "reports", "execution_report.md");
    const verseExecutionReportPath = path.join(dir, "reports", "verse_execution_report.md");

    const fixture = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                { n: 1, he: "א ב־ג׃" },
                { n: 2, he: "נ ס" }
              ]
            }
          ]
        }
      ]
    };
    fs.writeFileSync(inputPath, JSON.stringify(fixture, null, 2), "utf8");
    fs.writeFileSync(normalizedPath, "Genesis 1:1\tא ב ג\nGenesis 1:2\tנ ס\n", "utf8");

    runNode([
      TOKEN_REGISTRY_SCRIPT,
      `--input=${normalizedPath}`,
      `--registry-out=${tokenRegistryPath}`,
      `--signatures-out=${signaturesPath}`,
      `--report-out=${tokenRegistryReportPath}`
    ]);
    runNode([
      TOKEN_COMPILE_SCRIPT,
      `--registry=${tokenRegistryPath}`,
      `--out=${compiledBundlesPath}`,
      `--report=${compileReportPath}`,
      `--defs=${DEFINITIONS}`
    ]);

    runNode([
      CORPUS_SCRIPT,
      "execute",
      `--input=${inputPath}`,
      "--lang=he",
      `--trace-out=${tracesPath}`,
      `--flows-out=${flowsPath}`,
      `--report-out=${executionReportPath}`,
      `--verse-trace-out=${verseTracesPath}`,
      `--verse-report-out=${verseExecutionReportPath}`,
      `--verse-motif-index-out=${verseMotifIndexPath}`,
      `--token-registry=${tokenRegistryPath}`,
      `--compiled-bundles=${compiledBundlesPath}`
    ]);

    const runOne = {
      traces: sha256File(tracesPath),
      flows: sha256File(flowsPath),
      verseTraces: sha256File(verseTracesPath),
      verseMotifIndex: sha256File(verseMotifIndexPath)
    };

    runNode([
      CORPUS_SCRIPT,
      "execute",
      `--input=${inputPath}`,
      "--lang=he",
      `--trace-out=${tracesPath}`,
      `--flows-out=${flowsPath}`,
      `--report-out=${executionReportPath}`,
      `--verse-trace-out=${verseTracesPath}`,
      `--verse-report-out=${verseExecutionReportPath}`,
      `--verse-motif-index-out=${verseMotifIndexPath}`,
      `--token-registry=${tokenRegistryPath}`,
      `--compiled-bundles=${compiledBundlesPath}`
    ]);

    const runTwo = {
      traces: sha256File(tracesPath),
      flows: sha256File(flowsPath),
      verseTraces: sha256File(verseTracesPath),
      verseMotifIndex: sha256File(verseMotifIndexPath)
    };

    expect(runTwo).toEqual(runOne);
    expect(runOne).toEqual({
      traces: "43d2e566b416182998416b7827d0e176397ee04a58e625ced4574f2325e3c770",
      flows: "864f108e4c3d20ae87c94698b8962bb31935bb1576cd112438e613a9206449f2",
      verseTraces: "84feada50b10dca6fb2fd22907b5b391ba7ab2cced819922a895ccbd14451d4d",
      verseMotifIndex: "d9648d055265f6be3dd77a30932d2dc7b881a7639435b92e8aadb8b92d2601ee"
    });
  });

  it("keeps diff output checksums stable", () => {
    const dir = path.join(PARITY_ROOT, "diff");
    resetDir(dir);

    const prevPath = path.join(dir, "prev.jsonl");
    const nextPath = path.join(dir, "next.jsonl");
    const outPath = path.join(dir, "reports", "diff.json");
    fs.mkdirSync(path.dirname(prevPath), { recursive: true });

    const prevRows = [
      {
        ref_key: "Genesis/1/1/1",
        surface: "אב",
        tokens: [1],
        events: ["ALEPH.ALIAS"],
        flow_skeleton: ["ALEPH.ALIAS"],
        one_liner: "a"
      },
      {
        ref_key: "Genesis/1/1/2",
        surface: "גד",
        tokens: [2],
        events: ["GIMEL.BESTOW"],
        flow_skeleton: ["GIMEL.BESTOW"],
        one_liner: "b"
      }
    ];
    const nextRows = [
      {
        ref_key: "Genesis/1/1/1",
        surface: "אב",
        tokens: [1],
        events: ["ALEPH.ALIAS"],
        flow_skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
        one_liner: "a2"
      },
      {
        ref_key: "Genesis/1/1/3",
        surface: "הו",
        tokens: [3],
        events: ["HE.DECLARE"],
        flow_skeleton: ["HE.DECLARE"],
        one_liner: "c"
      }
    ];
    fs.writeFileSync(
      prevPath,
      prevRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
      "utf8"
    );
    fs.writeFileSync(
      nextPath,
      nextRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
      "utf8"
    );

    runNode([
      CORPUS_SCRIPT,
      "diff",
      `--prev=${prevPath}`,
      `--next=${nextPath}`,
      `--out=${outPath}`
    ]);
    const runOne = sha256File(outPath);
    runNode([
      CORPUS_SCRIPT,
      "diff",
      `--prev=${prevPath}`,
      `--next=${nextPath}`,
      `--out=${outPath}`
    ]);
    const runTwo = sha256File(outPath);

    expect(runTwo).toBe(runOne);
    expect(runOne).toBe("f0251e1b9de2876381467c3f9b3c503a5d72a8b6a19d8dc7e1a7ce2a1f625e34");
  });

  it("keeps regress output checksums stable", () => {
    const dir = path.join(PARITY_ROOT, "regress");
    resetDir(dir);

    const runATrace = path.join(dir, "run-a", "word_traces.jsonl");
    const runBTrace = path.join(dir, "run-b", "word_traces.jsonl");
    const compiledAPath = path.join(dir, "run-a", "tokens.compiled.json");
    const compiledBPath = path.join(dir, "run-b", "tokens.compiled.json");
    const diffPath = path.join(dir, "reports", "runA_vs_runB.md");
    const goldensPath = path.join(dir, "tests", "goldens.json");
    const regressionPath = path.join(dir, "reports", "regression_report.md");

    fs.mkdirSync(path.dirname(runATrace), { recursive: true });
    fs.mkdirSync(path.dirname(runBTrace), { recursive: true });

    fs.writeFileSync(
      compiledAPath,
      JSON.stringify(
        {
          semantics: { semver: "1.0.0", definitions_sha256: "defs-a" },
          source: { registry_sha256: "registry-a" },
          stats: { warning_count: 0, warning_by_code: {} },
          tokens: { "1": { warnings: [] }, "2": { warnings: [] } }
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(
      compiledBPath,
      JSON.stringify(
        {
          semantics: { semver: "1.1.0", definitions_sha256: "defs-b" },
          source: { registry_sha256: "registry-b" },
          stats: { warning_count: 0, warning_by_code: {} },
          tokens: { "1": { warnings: [] }, "2": { warnings: [] } }
        },
        null,
        2
      ),
      "utf8"
    );

    const rowsA = [
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "נ",
        token_ids: [1],
        skeleton: ["NUN.SUPPORT_DEBT"],
        flow: "נ support debt",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "ס",
        token_ids: [2],
        skeleton: ["SAMEKH.SUPPORT_DISCHARGE"],
        flow: "ס support discharge",
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
        flow: "נ support debt",
        semantic_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "ס",
        token_ids: [2],
        skeleton: ["FINAL_NUN.SUPPORT_DISCHARGE"],
        flow: "ן support discharge",
        semantic_version: "1.1.0"
      }
    ];
    fs.writeFileSync(runATrace, rowsA.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
    fs.writeFileSync(runBTrace, rowsB.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");

    runNode([
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

    const runOne = {
      diff: sha256File(diffPath),
      goldens: sha256File(goldensPath),
      regression: sha256File(regressionPath)
    };

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

    const runTwo = {
      diff: sha256File(diffPath),
      goldens: sha256File(goldensPath),
      regression: sha256File(regressionPath)
    };

    expect(runTwo).toEqual(runOne);
    expect(runOne).toEqual({
      diff: "e703db3156ed720392fe7ba5a4c5c07b5145d5ac969fcd097fb857bb67c2106b",
      goldens: "96b00936a457eaf2ee4a2a5e51b8ab033901541f4c237d0090a6bd995c307ca6",
      regression: "32d544c8184b73395f81a10e2777c2e35cdf552003ce69e8c9cedd0556448ebf"
    });
  });
});
