import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORPUS_SCRIPT = path.resolve(process.cwd(), "scripts", "torah-corpus.mjs");
const TOKEN_REGISTRY_SCRIPT = path.resolve(process.cwd(), "scripts", "extract-token-registry.mjs");
const TOKEN_COMPILE_SCRIPT = path.resolve(process.cwd(), "scripts", "compile-token-operators.mjs");
const DEFINITIONS = path.resolve(process.cwd(), "registry", "token-semantics.json");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("torah corpus execute pipeline", () => {
  it("emits per-word traces, human flow strings, and deterministic artifacts", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "torah-corpus-exec-test-"));
    const corpusDir = path.join(tmpDir, "corpus");
    const reportsDir = path.join(tmpDir, "reports");

    const inputPath = path.join(tmpDir, "torah.json");
    const normalizedPath = path.join(tmpDir, "torah.normalized.txt");
    const tokenRegistryPath = path.join(tmpDir, "tokens.registry.json");
    const signaturesPath = path.join(tmpDir, "tokens.signatures.txt");
    const tokenRegistryReportPath = path.join(tmpDir, "token_registry_report.md");
    const compiledBundlesPath = path.join(tmpDir, "tokens.compiled.json");
    const compileReportPath = path.join(tmpDir, "compile_report.md");
    const tracesPath = path.join(corpusDir, "word_traces.jsonl");
    const flowsPath = path.join(corpusDir, "word_flows.txt");
    const verseTracesPath = path.join(corpusDir, "verse_traces.jsonl");
    const verseMotifIndexPath = path.join(tmpDir, "index", "verse_motif_index.json");
    const executionReportPath = path.join(reportsDir, "execution_report.md");
    const verseExecutionReportPath = path.join(reportsDir, "verse_execution_report.md");

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

    const firstRunOut = runNode([
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
    expect(firstRunOut).toContain("execute: words=5");

    const tracesText = fs.readFileSync(tracesPath, "utf8");
    const traceRows = tracesText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    expect(traceRows).toHaveLength(5);
    for (const row of traceRows) {
      expect(row.record_kind).toBe("WORD_TRACE");
      expect(row.trace_version).toBe("1.0.0");
      expect(row.render_version).toBe("1.1.0");
      expect(row.ref).toBeDefined();
      expect(Array.isArray(row.token_ids)).toBe(true);
      expect(row.token_ids.length).toBeGreaterThan(0);
      expect(Array.isArray(row.events)).toBe(true);
      expect(Array.isArray(row.skeleton)).toBe(true);
      expect(typeof row.flow).toBe("string");
      expect(row.semantics_version).toBe("1.1.0");
      expect(String(row.canonical_hash)).toMatch(/^[a-f0-9]{64}$/);
    }

    const flowsLines = fs
      .readFileSync(flowsPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    expect(flowsLines).toHaveLength(5);

    const reportText = fs.readFileSync(executionReportPath, "utf8");
    expect(reportText).toContain("coverage: PASS (5/5)");
    expect(reportText).toContain("flow_derivation: PASS");

    const verseTraceText = fs.readFileSync(verseTracesPath, "utf8");
    const verseRows = verseTraceText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    expect(verseRows).toHaveLength(2);
    expect(verseRows[0].record_kind).toBe("VERSE_TRACE");
    expect(verseRows[0].trace_version).toBe("1.0.0");
    expect(verseRows[0].render_version).toBe("1.1.0");
    expect(String(verseRows[0].canonical_hash)).toMatch(/^[a-f0-9]{64}$/);
    expect(verseRows[0].mode).toBe("WORD");
    expect(verseRows[0].boundary_events).toBeDefined();
    expect(verseRows[0].boundary_events.verse_boundary_operator.op_family).toBe(
      "VERSE.BOUNDARY_RESOLUTION"
    );

    const verseMotifIndexPayload = JSON.parse(fs.readFileSync(verseMotifIndexPath, "utf8"));
    expect(verseMotifIndexPayload.mode).toBe("WORD");
    expect(Array.isArray(verseMotifIndexPayload.motifs)).toBe(true);

    const verseReportText = fs.readFileSync(verseExecutionReportPath, "utf8");
    expect(verseReportText).toContain("## Quality Gates");
    expect(verseReportText).toContain("word_mode_equivalence: PASS");

    const secondRunOut = runNode([
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
    expect(secondRunOut).toContain("execute: words=5");
    expect(fs.readFileSync(tracesPath, "utf8")).toBe(tracesText);
    expect(fs.readFileSync(verseTracesPath, "utf8")).toBe(verseTraceText);
  });
});
