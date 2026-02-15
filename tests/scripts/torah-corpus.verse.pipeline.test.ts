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

describe("torah corpus verse execution modes", () => {
  it("emits deterministic verse artifacts for VERSE and WINDOW modes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "torah-corpus-verse-mode-test-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const normalizedPath = path.join(tmpDir, "torah.normalized.txt");
    const tokenRegistryPath = path.join(tmpDir, "tokens.registry.json");
    const signaturesPath = path.join(tmpDir, "tokens.signatures.txt");
    const tokenRegistryReportPath = path.join(tmpDir, "token_registry_report.md");
    const compiledBundlesPath = path.join(tmpDir, "tokens.compiled.json");
    const compileReportPath = path.join(tmpDir, "compile_report.md");

    const fixture = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                { n: 1, he: "נ ס ת" },
                { n: 2, he: "מ ם א" }
              ]
            }
          ]
        }
      ]
    };
    fs.writeFileSync(inputPath, JSON.stringify(fixture, null, 2), "utf8");
    fs.writeFileSync(normalizedPath, "Genesis 1:1\tנ ס ת\nGenesis 1:2\tמ ם א\n", "utf8");

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

    const verseModeTracePath = path.join(tmpDir, "corpus", "verse.word_traces.jsonl");
    const verseModeFlowPath = path.join(tmpDir, "corpus", "verse.word_flows.txt");
    const verseModeReportPath = path.join(tmpDir, "reports", "verse.execution_report.md");
    const verseModeVerseTracePath = path.join(tmpDir, "corpus", "verse.verse_traces.jsonl");
    const verseModeVerseReportPath = path.join(
      tmpDir,
      "reports",
      "verse.verse_execution_report.md"
    );
    const verseModeMotifIndexPath = path.join(tmpDir, "index", "verse.verse_motif_index.json");

    runNode([
      CORPUS_SCRIPT,
      "execute",
      `--input=${inputPath}`,
      "--lang=he",
      "--mode=VERSE",
      `--trace-out=${verseModeTracePath}`,
      `--flows-out=${verseModeFlowPath}`,
      `--report-out=${verseModeReportPath}`,
      `--verse-trace-out=${verseModeVerseTracePath}`,
      `--verse-report-out=${verseModeVerseReportPath}`,
      `--verse-motif-index-out=${verseModeMotifIndexPath}`,
      `--token-registry=${tokenRegistryPath}`,
      `--compiled-bundles=${compiledBundlesPath}`
    ]);

    const verseRows = fs
      .readFileSync(verseModeVerseTracePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    expect(verseRows).toHaveLength(2);
    expect(verseRows[0].record_kind).toBe("VERSE_TRACE");
    expect(verseRows[0].trace_version).toBe("1.1.0");
    expect(verseRows[0].render_version).toBe("1.1.0");
    expect(String(verseRows[0].canonical_hash)).toMatch(/^[a-f0-9]{64}$/);
    expect(verseRows[0].mode).toBe("VERSE");
    expect(Array.isArray(verseRows[0].cross_word_events)).toBe(true);
    expect(Array.isArray(verseRows[0].notable_motifs)).toBe(true);
    expect(verseRows[0].boundary_events.verse_boundary_operator.op_family).toBe(
      "VERSE.BOUNDARY_RESOLUTION"
    );

    const verseMotifIndex = JSON.parse(fs.readFileSync(verseModeMotifIndexPath, "utf8"));
    expect(verseMotifIndex.mode).toBe("VERSE");
    expect(verseMotifIndex.safety_rail.enabled).toBe(true);

    const verseReport = fs.readFileSync(verseModeVerseReportPath, "utf8");
    expect(verseReport).toContain("execution_mode: VERSE");
    expect(verseReport).toContain("## Boundary Operators");
    expect(verseReport).toContain("## Verse Boundary Operator");

    const windowModeTracePath = path.join(tmpDir, "corpus", "window.word_traces.jsonl");
    const windowModeFlowPath = path.join(tmpDir, "corpus", "window.word_flows.txt");
    const windowModeReportPath = path.join(tmpDir, "reports", "window.execution_report.md");
    const windowModeVerseTracePath = path.join(tmpDir, "corpus", "window.verse_traces.jsonl");
    const windowModeVerseReportPath = path.join(
      tmpDir,
      "reports",
      "window.verse_execution_report.md"
    );
    const windowModeMotifIndexPath = path.join(tmpDir, "index", "window.verse_motif_index.json");

    runNode([
      CORPUS_SCRIPT,
      "execute",
      `--input=${inputPath}`,
      "--lang=he",
      "--mode=WINDOW(2)",
      `--trace-out=${windowModeTracePath}`,
      `--flows-out=${windowModeFlowPath}`,
      `--report-out=${windowModeReportPath}`,
      `--verse-trace-out=${windowModeVerseTracePath}`,
      `--verse-report-out=${windowModeVerseReportPath}`,
      `--verse-motif-index-out=${windowModeMotifIndexPath}`,
      `--token-registry=${tokenRegistryPath}`,
      `--compiled-bundles=${compiledBundlesPath}`
    ]);

    const windowRows = fs
      .readFileSync(windowModeVerseTracePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    expect(windowRows).toHaveLength(2);
    expect(windowRows[0].record_kind).toBe("VERSE_TRACE");
    expect(windowRows[0].mode).toBe("WINDOW(2)");
    expect(windowRows[0].window_size).toBe(2);

    const windowReport = fs.readFileSync(windowModeVerseReportPath, "utf8");
    expect(windowReport).toContain("execution_mode: WINDOW(2)");
    expect(windowReport).toContain("window_size: 2");

    const windowMotifIndex = JSON.parse(fs.readFileSync(windowModeMotifIndexPath, "utf8"));
    expect(windowMotifIndex.mode).toBe("WINDOW(2)");
  });
});
