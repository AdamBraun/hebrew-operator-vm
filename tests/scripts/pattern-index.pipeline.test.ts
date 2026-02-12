import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "pattern-index.mjs");

type TraceRow = {
  ref: {
    book: string;
    chapter: number;
    verse: number;
    token_index: number;
  };
  ref_key: string;
  surface: string;
  skeleton: string[];
  flow: string;
  semantic_version?: string;
  semantics_version?: string;
};

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

function writeJsonl(pathName: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathName), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  fs.writeFileSync(pathName, content, "utf8");
}

function runQuery(indexDir: string, args: string[]): any {
  const output = runNode([SCRIPT, "query", ...args, `--index-dir=${indexDir}`]);
  return JSON.parse(output);
}

describe("pattern index build + query pipeline", () => {
  it("builds deterministic artifacts and serves exact/prefix/suffix/subsequence/motif queries", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-index-test-"));
    const tracePath = path.join(tmpDir, "corpus", "word_traces.jsonl");
    const indexDir = path.join(tmpDir, "index");
    const reportPath = path.join(tmpDir, "reports", "pattern_index_report.md");

    const rows: TraceRow[] = [
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "את",
        skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
        flow: "א alias -> ת finalize",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        ref_key: "Genesis/1/1/2",
        surface: "גת",
        skeleton: ["GIMEL.BESTOW", "TAV.FINALIZE"],
        flow: "ג bestow -> ת finalize",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 3 },
        ref_key: "Genesis/1/1/3",
        surface: "גסת",
        skeleton: ["GIMEL.BESTOW", "SAMEKH.SUPPORT_DISCHARGE", "TAV.FINALIZE"],
        flow: "ג bestow -> ס support discharge -> ת finalize",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 4 },
        ref_key: "Genesis/1/1/4",
        surface: "נס",
        skeleton: ["NUN.SUPPORT_DEBT", "SAMEKH.SUPPORT_DISCHARGE"],
        flow: "נ debt -> ס discharge",
        semantic_version: "1.0.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 1 },
        ref_key: "Genesis/1/2/1",
        surface: "הגם",
        skeleton: ["HE.DECLARE", "GIMEL.BESTOW", "FINAL_MEM.CLOSE"],
        flow: "ה declare -> ג bestow -> ם close",
        semantics_version: "1.1.0"
      },
      {
        ref: { book: "Genesis", chapter: 1, verse: 2, token_index: 2 },
        ref_key: "Genesis/1/2/2",
        surface: "גת",
        skeleton: ["GIMEL.BESTOW", "TAV.FINALIZE"],
        flow: "ג bestow -> ת finalize",
        semantic_version: "1.0.0"
      }
    ];

    writeJsonl(tracePath, rows);

    const buildOut = runNode([
      SCRIPT,
      "build",
      `--input=${tracePath}`,
      `--index-dir=${indexDir}`,
      `--report-out=${reportPath}`
    ]);
    expect(buildOut).toContain("build: rows=6");

    const countsPath = path.join(indexDir, "skeleton_counts.json");
    const occurrencesPath = path.join(indexDir, "skeleton_to_occurrences.bin");
    const motifIndexPath = path.join(indexDir, "motif_index.json");
    const motifsPath = path.join(indexDir, "motifs.json");

    expect(fs.existsSync(countsPath)).toBe(true);
    expect(fs.existsSync(occurrencesPath)).toBe(true);
    expect(fs.existsSync(motifIndexPath)).toBe(true);
    expect(fs.existsSync(motifsPath)).toBe(true);
    expect(fs.existsSync(reportPath)).toBe(true);

    const countsPayload = JSON.parse(fs.readFileSync(countsPath, "utf8"));
    const firstChecksum = countsPayload.skeleton_counts_sha256;

    expect(countsPayload.unique_skeletons).toBe(5);
    expect(countsPayload.total_occurrences).toBe(6);
    expect(countsPayload.semantic_versions).toEqual(["1.0.0", "1.1.0"]);
    expect(countsPayload.skeleton_counts["GIMEL.BESTOW|TAV.FINALIZE"]).toBe(2);

    const motifPayload = JSON.parse(fs.readFileSync(motifIndexPath, "utf8"));
    expect(motifPayload.motifs.ENDS_WITH_FINALIZE.occurrence_count).toBe(4);
    expect(motifPayload.motifs.CONTAINS_BESTOW_THEN_SEAL.occurrence_count).toBe(3);

    const secondBuildOut = runNode([
      SCRIPT,
      "build",
      `--input=${tracePath}`,
      `--index-dir=${indexDir}`,
      `--report-out=${reportPath}`
    ]);
    expect(secondBuildOut).toContain("build: rows=6");

    const secondCountsPayload = JSON.parse(fs.readFileSync(countsPath, "utf8"));
    expect(secondCountsPayload.skeleton_counts_sha256).toBe(firstChecksum);

    const exact = runQuery(indexDir, ["skeleton", "GIMEL.BESTOW|TAV.FINALIZE"]);
    expect(exact.mode).toBe("skeleton");
    expect(exact.matched_skeletons).toBe(1);
    expect(exact.total_occurrences).toBe(2);
    expect(exact.results).toHaveLength(2);

    const subsequence = runQuery(indexDir, ["subsequence", "GIMEL.BESTOW|TAV.FINALIZE"]);
    expect(subsequence.matched_skeletons).toBe(2);
    expect(subsequence.total_occurrences).toBe(3);

    const prefix = runQuery(indexDir, ["prefix", "GIMEL.BESTOW"]);
    expect(prefix.total_occurrences).toBe(3);

    const suffix = runQuery(indexDir, ["suffix", "*.FINALIZE"]);
    expect(suffix.total_occurrences).toBe(4);

    const containsThen = runQuery(indexDir, ["contains", "BESTOW", "--then=SEAL"]);
    expect(containsThen.total_occurrences).toBe(4);

    const motif = runQuery(indexDir, ["motif", "ENDS_WITH_FINALIZE"]);
    expect(motif.total_occurrences).toBe(4);

    const limited = runQuery(indexDir, ["motif", "ENDS_WITH_FINALIZE", "--limit=1"]);
    expect(limited.returned).toBe(1);

    const reportText = fs.readFileSync(reportPath, "utf8");
    expect(reportText).toContain("## Top-100 Skeletons");
    expect(reportText).toContain("## Motif Match Counts");
  });
});
