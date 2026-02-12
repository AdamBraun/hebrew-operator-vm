import { describe, expect, it } from "vitest";
import { buildExecuteReports } from "@ref/scripts/torahCorpus/execute";

describe("torah corpus execute report builder", () => {
  it("builds deterministic report sections and checksums", () => {
    const output = buildExecuteReports({
      inputPath: `${process.cwd()}/data/torah.json`,
      tokenRegistryPath: `${process.cwd()}/data/tokens.registry.json`,
      compiledBundlesPath: `${process.cwd()}/data/tokens.compiled.json`,
      traceOutPath: `${process.cwd()}/corpus/word_traces.jsonl`,
      flowsOutPath: `${process.cwd()}/corpus/word_flows.txt`,
      reportOutPath: `${process.cwd()}/reports/execution_report.md`,
      verseTraceOutPath: `${process.cwd()}/corpus/verse_traces.jsonl`,
      verseReportOutPath: `${process.cwd()}/reports/verse_execution_report.md`,
      verseMotifIndexOutPath: `${process.cwd()}/index/verse_motif_index.json`,
      semanticVersion: "1.0.0",
      mode: "WORD",
      modeLabel: "WORD",
      windowSize: null,
      safetyRailStats: {
        enabled: true,
        threshold: 0.35,
        activated_verses: 0,
        clamped_words: 0
      },
      wordsTotal: 1,
      versesTotal: 1,
      versesSanitized: 1,
      versesSkipped: 0,
      rows: [{ skeleton: ["ALEPH.ALIAS"], flow: "א alias" }],
      baselineRows: [{ skeleton: ["ALEPH.ALIAS"] }],
      modeDiffEvents: [],
      verseRows: [
        {
          cross_word_events: [],
          boundary_events: {
            by_type: { "SPACE.BOUNDARY_AUTO_CLOSE": 1 },
            verse_boundary_operator: { action: "AUTO" }
          },
          notable_motifs: [{ motif: "ENDS_WITH_FINALIZE", count: 1 }]
        }
      ],
      uniqueSkeletons: 1,
      topSkeletons: [["ALEPH.ALIAS", 1]],
      unknownSignatures: [],
      missingBundles: [],
      runtimeErrors: [],
      elapsedMs: 10,
      traceContent: '{"x":1}\n',
      verseTraceContent: '{"y":1}\n',
      compileFlowString: (skeleton, separator) => skeleton.join(separator),
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right)
    });

    expect(output.traceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(output.verseTraceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(output.reportLines.join("\n")).toContain("## Quality Gates");
    expect(output.verseReportLines.join("\n")).toContain("## Verse Boundary Operator");
  });
});
