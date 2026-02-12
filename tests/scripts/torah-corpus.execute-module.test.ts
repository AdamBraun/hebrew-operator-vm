import { describe, expect, it } from "vitest";
import {
  applyWordExecutionPolicy,
  assertExecuteTokenSources,
  buildVerseTraceRecord,
  buildVerseWordRowsMeta,
  buildWordExecutionArtifacts,
  computeSafetyRailActivation,
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
      wordRowsMeta: [{ unknown_signatures: [] }, { unknown_signatures: ["x"] }, { unknown_signatures: [] }],
      baselineExecutions: [
        { flowCompact: ["A"] },
        { flowCompact: ["B"] },
        { flowCompact: ["C"] }
      ],
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
      traceRenderVersion: "1.0.0",
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
      traceRenderVersion: "1.0.0",
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
});
