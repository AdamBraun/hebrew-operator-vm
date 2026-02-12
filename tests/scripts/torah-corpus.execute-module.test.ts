import { describe, expect, it } from "vitest";
import {
  applyWordExecutionPolicy,
  assertModeExecutionLength,
  assertExecuteTokenSources,
  accumulateWordExecutionArtifacts,
  buildBaselineExecutions,
  buildExecuteCompletion,
  buildExecuteWritePlan,
  buildVerseMotifIndex,
  buildVerseTraceRecord,
  buildVerseWordRowsMeta,
  buildWordExecutionArtifacts,
  computeSafetyRailActivation,
  finalizeExecuteOutputs,
  resolveExecutePaths,
  resolveSemanticVersion,
  selectModeExecutions
} from "@ref/scripts/torahCorpus/execute";

describe("torah corpus execute module helpers", () => {
  it("resolves execute paths to absolute paths", () => {
    const paths = resolveExecutePaths({
      input: "data/torah.json",
      tokenRegistry: "data/tokens.registry.json",
      compiledBundles: "data/tokens.compiled.json",
      traceOut: "corpus/word_traces.jsonl",
      flowsOut: "corpus/word_flows.txt",
      reportOut: "reports/execution_report.md",
      verseTraceOut: "corpus/verse_traces.jsonl",
      verseReportOut: "reports/verse_execution_report.md",
      verseMotifIndexOut: "index/verse_motif_index.json"
    });
    expect(paths.inputPath.endsWith("/data/torah.json")).toBe(true);
    expect(paths.verseMotifIndexOutPath.endsWith("/index/verse_motif_index.json")).toBe(true);
  });

  it("resolves semantic version with fallback order", () => {
    expect(
      resolveSemanticVersion("2.0.0", { semantics: { semver: "1.0.0" } }, { semver: "0.9.0" })
    ).toBe("2.0.0");
    expect(
      resolveSemanticVersion("", { semantics: { semver: "1.0.0" } }, { semver: "0.9.0" })
    ).toBe("1.0.0");
    expect(resolveSemanticVersion("", {}, { semver: "0.9.0" })).toBe("0.9.0");
  });

  it("validates token sources", () => {
    expect(() =>
      assertExecuteTokenSources({
        tokenIdBySignatureSize: 0,
        compiledTokenCount: 1,
        tokenRegistryPath: "/tmp/a",
        compiledBundlesPath: "/tmp/b"
      })
    ).toThrow(/No tokens loaded/);
    expect(() =>
      assertExecuteTokenSources({
        tokenIdBySignatureSize: 1,
        compiledTokenCount: 0,
        tokenRegistryPath: "/tmp/a",
        compiledBundlesPath: "/tmp/b"
      })
    ).toThrow(/No compiled bundles/);
  });

  it("builds per-verse word rows and tracks missing/unknown tokens", () => {
    const result = buildVerseWordRowsMeta({
      verseEntry: {
        ref: { book: "Genesis", chapter: 1, verse: 1 },
        words: ["אב", "גד"]
      },
      tokenize: () => [],
      tokenIdBySignature: new Map([["known", 1]]),
      compiledTokenIdSet: new Set(["1"]),
      buildRefKey: (ref) => `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`,
      resolveWordTokenIds: ({ surface }) =>
        surface === "אב"
          ? { token_ids: [1], unknown_signatures: [], missing_bundle_ids: [] }
          : { token_ids: [2], unknown_signatures: ["unknown"], missing_bundle_ids: [2] }
    });

    expect(result.wordRowsMeta).toHaveLength(2);
    expect(result.missingBundles).toHaveLength(1);
    expect(result.unknownSignatures).toHaveLength(1);
  });

  it("selects mode executions and preserves WORD baseline rows", () => {
    const baselineExecutions = [
      {
        flowRaw: ["A"],
        flowCompact: ["A"],
        traceEvents: [{ event: "a" }],
        runtimeErrorMessage: "",
        windowStart: 1
      }
    ];
    const verseModeResult = [
      {
        flowRaw: ["V"],
        flowCompact: ["V"],
        traceEvents: [],
        runtimeErrorMessage: "",
        windowStart: 1
      }
    ];
    const windowModeResult = [
      {
        flowRaw: ["W"],
        flowCompact: ["W"],
        traceEvents: [],
        runtimeErrorMessage: "",
        windowStart: 2
      }
    ];

    const wordMode = selectModeExecutions({
      mode: "WORD",
      baselineExecutions,
      words: ["אב"],
      windowSize: null,
      defaultWindowSize: 4,
      runVerseWordFlows: () => verseModeResult,
      runWindowWordFlows: () => windowModeResult,
      runProgramWithTrace: () => null,
      createInitialState: () => ({}),
      allowRuntimeErrors: false,
      verseRefKey: "Genesis/1/1"
    });
    expect(wordMode).toEqual(baselineExecutions);
    expect(wordMode[0]).not.toBe(baselineExecutions[0]);

    const verseMode = selectModeExecutions({
      mode: "VERSE",
      baselineExecutions,
      words: ["אב"],
      windowSize: 2,
      defaultWindowSize: 4,
      runVerseWordFlows: () => verseModeResult,
      runWindowWordFlows: () => windowModeResult,
      runProgramWithTrace: () => null,
      createInitialState: () => ({}),
      allowRuntimeErrors: false,
      verseRefKey: "Genesis/1/1"
    });
    expect(verseMode).toBe(verseModeResult);
  });

  it("computes safety rail activation from provisional deltas", () => {
    const result = computeSafetyRailActivation({
      mode: "WINDOW",
      safetyRailEnabled: true,
      safetyRailThreshold: 0.4,
      wordRowsMeta: [
        { unknown_signatures: [] },
        { unknown_signatures: ["x"] },
        { unknown_signatures: [] }
      ],
      baselineExecutions: [{ flowCompact: ["A"] }, { flowCompact: ["B"] }, { flowCompact: ["C"] }],
      modeExecutions: [{ flowCompact: ["A"] }, { flowCompact: ["X"] }, { flowCompact: ["D"] }],
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right)
    });

    expect(result.provisionalDeltaCount).toBe(1);
    expect(result.provisionalDeltaRate).toBeCloseTo(1 / 3);
    expect(result.safetyRailActive).toBe(false);
  });

  it("applies per-word policy for unknown signatures and safety rail clamps", () => {
    const baselineExecution = {
      flowRaw: ["BASE"],
      flowCompact: ["BASE"],
      traceEvents: [{ event: "base" }],
      runtimeErrorMessage: "",
      windowStart: 1
    };
    const modeExecution = {
      flowRaw: ["NEXT"],
      flowCompact: ["NEXT"],
      traceEvents: [{ event: "next" }],
      runtimeErrorMessage: "",
      windowStart: 3
    };

    const unknownResult = applyWordExecutionPolicy({
      metaUnknownSignatures: ["sig-x"],
      baselineExecution,
      modeExecution,
      mode: "WINDOW",
      safetyRailActive: false,
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      skeletonDeltaOps: () => [],
      isSafetyRailDeltaAllowed: () => true,
      makeUnknownSignatureTraceEvent: (signature) => ({ event: "unknown", signature })
    });
    expect(unknownResult.execution.flowCompact).toEqual(["ERROR.UNKNOWN_SIGNATURE"]);
    expect(unknownResult.allowedDeltaIncrement).toBe(1);

    const clampedResult = applyWordExecutionPolicy({
      metaUnknownSignatures: [],
      baselineExecution,
      modeExecution,
      mode: "WINDOW",
      safetyRailActive: true,
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      skeletonDeltaOps: () => [{ op: "replace" }],
      isSafetyRailDeltaAllowed: () => false,
      makeUnknownSignatureTraceEvent: () => ({})
    });
    expect(clampedResult.execution.safetyRailClamped).toBe(true);
    expect(clampedResult.blockedDeltaIncrement).toBe(1);
    expect(clampedResult.clampedWordIncrement).toBe(1);
  });

  it("builds verse trace records with mode/safety metadata", () => {
    const verseRecord = buildVerseTraceRecord({
      traceVersion: "1.0.0",
      traceRenderVersion: "1.1.0",
      semanticVersion: "2.1.0",
      verseRef: { book: "Genesis", chapter: 1, verse: 1 },
      verseRefKey: "Genesis/1/1",
      modeLabel: "WINDOW(2)",
      mode: "WINDOW",
      windowSize: 2,
      safetyRailActive: true,
      provisionalDeltaCount: 2,
      provisionalDeltaRate: 0.5,
      safetyRailThreshold: 0.4,
      verseWordRows: [{ boundary_ops: ["DIVINE_NAME_STATE"] }, { boundary_ops: ["WORD_BOUNDARY"] }],
      crossWordEvents: [{ ref_key: "Genesis/1/1/2" }],
      totalEventsInVerse: 5,
      boundaryByType: { WORD_BOUNDARY: 1, DIVINE_NAME_STATE: 1 },
      sortCountObjectByKey: (counts) =>
        Object.keys(counts)
          .sort()
          .reduce<Record<string, number>>((acc, key) => {
            acc[key] = counts[key];
            return acc;
          }, {}),
      buildVerseBoundaryResolution: () => ({ action: "preserve" }),
      buildVerseMotifs: () => [{ motif: "operator_chain", count: 1 }]
    });

    expect(verseRecord.record_kind).toBe("VERSE_TRACE");
    expect(verseRecord.window_size).toBe(2);
    expect(verseRecord.safety_rail).toMatchObject({
      active: true,
      provisional_delta_count: 2,
      threshold: 0.4
    });
  });

  it("builds word execution artifacts with delta and runtime samples", () => {
    const result = buildWordExecutionArtifacts({
      traceVersion: "1.0.0",
      traceRenderVersion: "1.1.0",
      semanticVersion: "2.0.0",
      mode: "WINDOW",
      debugRawEvents: true,
      meta: {
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        ref_key: "Genesis/1/1/1",
        surface: "אב",
        token_ids: [11]
      },
      wordIndex: 0,
      baselineExecution: {
        flowRaw: ["BASE"],
        flowCompact: ["BASE"],
        traceEvents: [],
        runtimeErrorMessage: "",
        windowStart: 1
      },
      execution: {
        flowRaw: ["NEXT"],
        flowCompact: ["NEXT"],
        traceEvents: [{ event: "x" }],
        runtimeErrorMessage: "runtime failure",
        windowStart: 2
      },
      compileFlowString: (skeleton) => skeleton.join(" ⇢ "),
      extractBoundaryOps: () => ["WORD_BOUNDARY"],
      explainDeltaByMode: () => "window shift",
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      canonicalizeWordTraceRecord: (record) => record
    });

    expect(result.flowLine).toContain("Genesis/1/1/1");
    expect(result.row.skeleton_raw).toEqual(["NEXT"]);
    expect(result.runtimeErrorSample).toEqual({
      ref_key: "Genesis/1/1/1",
      surface: "אב",
      message: "runtime failure"
    });
    expect(result.deltaEvent).toMatchObject({
      token_index: 1,
      explanation: "window shift"
    });
  });

  it("accumulates word execution artifacts into verse-level trackers", () => {
    const rows: Record<string, unknown>[] = [];
    const flowLines: string[] = [];
    const baselineRows: Array<{ ref_key: string; skeleton: string[] }> = [];
    const runtimeErrors: Array<{ ref_key: string; surface: string; message: string }> = [];
    const skeletonCounts = new Map<string, number>();
    const boundaryByType: Record<string, number> = {};
    const verseWordRows: Array<{
      ref_key: string;
      token_index: number;
      skeleton: string[];
      boundary_ops: string[];
    }> = [];
    const crossWordEvents: Array<{
      ref_key: string;
      token_index: number;
      baseline_skeleton: string[];
      observed_skeleton: string[];
      explanation: string;
    }> = [];
    const modeDiffEvents: Array<{
      verse_ref_key: string;
      ref_key: string;
      token_index: number;
      baseline_skeleton: string[];
      observed_skeleton: string[];
      explanation: string;
    }> = [];

    const total = accumulateWordExecutionArtifacts({
      artifacts: {
        row: { ref_key: "Genesis/1/1/1" },
        flowLine: "Genesis/1/1/1\tאב\tA",
        baselineRow: { ref_key: "Genesis/1/1/1", skeleton: ["BASE"] },
        runtimeErrorSample: { ref_key: "Genesis/1/1/1", surface: "אב", message: "err" },
        skeleton: ["NEXT"],
        skeletonKey: "NEXT",
        boundaryOps: ["WORD_BOUNDARY", "WORD_BOUNDARY"],
        traceEventCount: 3,
        verseWordRow: {
          ref_key: "Genesis/1/1/1",
          token_index: 1,
          skeleton: ["NEXT"],
          boundary_ops: ["WORD_BOUNDARY", "WORD_BOUNDARY"]
        },
        deltaEvent: {
          ref_key: "Genesis/1/1/1",
          token_index: 1,
          baseline_skeleton: ["BASE"],
          observed_skeleton: ["NEXT"],
          explanation: "window shift"
        }
      },
      verseRefKey: "Genesis/1/1",
      rows,
      flowLines,
      baselineRows,
      runtimeErrors,
      skeletonCounts,
      boundaryByType,
      verseWordRows,
      crossWordEvents,
      modeDiffEvents,
      totalEventsInVerse: 7
    });

    expect(total).toBe(10);
    expect(rows).toHaveLength(1);
    expect(flowLines).toHaveLength(1);
    expect(runtimeErrors).toHaveLength(1);
    expect(skeletonCounts.get("NEXT")).toBe(1);
    expect(boundaryByType.WORD_BOUNDARY).toBe(2);
    expect(crossWordEvents).toHaveLength(1);
    expect(modeDiffEvents[0]?.verse_ref_key).toBe("Genesis/1/1");
  });

  it("finalizes execute outputs with sorted rows and top skeletons", () => {
    const result = finalizeExecuteOutputs({
      rows: [{ ref_key: "Genesis/1/1/2" }, { ref_key: "Genesis/1/1/1" }],
      verseRows: [{ ref_key: "Genesis/1/2" }, { ref_key: "Genesis/1/1" }],
      compareWordTraceRecords: (left, right) =>
        String(left.ref_key).localeCompare(String(right.ref_key), "en"),
      compareVerseTraceRecords: (left, right) =>
        String(left.ref_key).localeCompare(String(right.ref_key), "en"),
      skeletonCounts: new Map([
        ["B", 1],
        ["A", 2]
      ])
    });

    expect(result.sortedRows.map((row) => row.ref_key)).toEqual(["Genesis/1/1/1", "Genesis/1/1/2"]);
    expect(result.sortedVerseRows.map((row) => row.ref_key)).toEqual([
      "Genesis/1/1",
      "Genesis/1/2"
    ]);
    expect(result.traceContent.endsWith("\n")).toBe(true);
    expect(result.verseTraceContent.endsWith("\n")).toBe(true);
    expect(result.topSkeletons[0]).toEqual(["A", 2]);
    expect(result.uniqueSkeletons).toBe(2);
  });

  it("builds execute completion payloads for error and success cases", () => {
    const failed = buildExecuteCompletion({
      wordsEmitted: 10,
      modeLabel: "WINDOW(2)",
      uniqueSkeletons: 4,
      runtimeErrors: 1,
      traceOutPath: "/tmp/trace.jsonl",
      flowsOutPath: "/tmp/flows.txt",
      verseTraceOutPath: "/tmp/verse-trace.jsonl",
      reportOutPath: "/tmp/report.md",
      verseReportOutPath: "/tmp/verse-report.md",
      verseMotifIndexOutPath: "/tmp/motif.json",
      unknownSignatures: 2,
      missingBundles: 3
    });
    expect(failed.hardErrorMessage).toBe("execute failed: unknownSignatures=2 missingBundles=3");
    expect(failed.consoleLine).toContain("mode=WINDOW(2)");

    const ok = buildExecuteCompletion({
      wordsEmitted: 1,
      modeLabel: "WORD",
      uniqueSkeletons: 1,
      runtimeErrors: 0,
      traceOutPath: "/tmp/trace.jsonl",
      flowsOutPath: "/tmp/flows.txt",
      verseTraceOutPath: "/tmp/verse-trace.jsonl",
      reportOutPath: "/tmp/report.md",
      verseReportOutPath: "/tmp/verse-report.md",
      verseMotifIndexOutPath: "/tmp/motif.json",
      unknownSignatures: 0,
      missingBundles: 0
    });
    expect(ok.hardErrorMessage).toBeNull();
    expect(ok.consoleLine).toContain("execute: words=1");
  });

  it("builds verse motif index aggregates", () => {
    const result = buildVerseMotifIndex({
      modeLabel: "WINDOW(2)",
      traceVersion: "1.0.0",
      renderVersion: "1.1.0",
      semanticVersion: "2.0.0",
      verseRows: [
        {
          ref_key: "Genesis/1/2",
          cross_word_events: [{}, {}],
          boundary_events: { by_type: { WORD_BOUNDARY: 1 } },
          notable_motifs: [{ motif: "A", count: 2, action: "x" }]
        },
        {
          ref_key: "Genesis/1/1",
          cross_word_events: [{}],
          boundary_events: { by_type: { WORD_BOUNDARY: 3, DIVINE_NAME_STATE: 1 } },
          notable_motifs: [{ motif: "A", count: 1, refs: ["Genesis/1/1/1"] }]
        }
      ],
      safetyRailSummary: { enabled: true, activated_verses: 1 },
      verseTraceSha256: "abc123"
    });

    expect(result.cross_word_event_count).toBe(3);
    expect(result.boundary_operator_totals).toEqual({
      DIVINE_NAME_STATE: 1,
      WORD_BOUNDARY: 4
    });
    expect(Array.isArray(result.motifs)).toBe(true);
    expect((result.motifs as Array<{ motif: string; count: number }>)[0]).toMatchObject({
      motif: "A",
      count: 3
    });
  });

  it("builds execute write plans with deduped directories", () => {
    const plan = buildExecuteWritePlan({
      traceOutPath: "/tmp/out/word.jsonl",
      flowsOutPath: "/tmp/out/flows.txt",
      reportOutPath: "/tmp/reports/execution.md",
      verseTraceOutPath: "/tmp/out/verse.jsonl",
      verseReportOutPath: "/tmp/reports/verse.md",
      verseMotifIndexOutPath: "/tmp/index/motif.json",
      traceContent: '{"a":1}\n',
      flowLines: ["a", "b"],
      verseTraceContent: '{"v":1}\n',
      reportLines: ["# Report"],
      verseReportLines: ["# Verse Report"],
      verseMotifIndexPayload: { schema_version: 1 }
    });

    expect(plan.directoryPaths).toEqual(["/tmp/index", "/tmp/out", "/tmp/reports"]);
    expect(plan.textWrites).toHaveLength(5);
    expect(plan.textWrites[1]?.content).toBe("a\nb\n");
    expect(plan.textWrites[3]?.content).toBe("# Report\n");
    expect(plan.jsonWrites[0]?.path).toBe("/tmp/index/motif.json");
  });

  it("builds baseline executions and handles unknown signatures", () => {
    const result = buildBaselineExecutions({
      wordRowsMeta: [
        { surface: "אב", unknown_signatures: [] },
        { surface: "גד", unknown_signatures: ["sig-x"] }
      ],
      getIsolatedFlow: (surface) => ({
        flowRaw: [surface],
        flowCompact: [surface],
        traceEvents: [],
        runtimeErrorMessage: "",
        windowStart: 1
      }),
      makeUnknownSignatureTraceEvent: (signature) => ({ event: "unknown", signature })
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.flowCompact).toEqual(["אב"]);
    expect(result[1]?.flowCompact).toEqual(["ERROR.UNKNOWN_SIGNATURE"]);
  });

  it("asserts mode execution length matches expected rows", () => {
    expect(() =>
      assertModeExecutionLength({
        modeLabel: "WORD",
        verseRefKey: "Genesis/1/1",
        emitted: 1,
        expected: 2
      })
    ).toThrow(/emitted 1 rows/);
  });
});
