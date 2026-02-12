import path from "node:path";
export { buildExecuteReports } from "./executeReports";

type ExecutePathOpts = {
  input: string;
  tokenRegistry: string;
  compiledBundles: string;
  traceOut: string;
  flowsOut: string;
  reportOut: string;
  verseTraceOut: string;
  verseReportOut: string;
  verseMotifIndexOut: string;
};

export type ExecutePaths = {
  inputPath: string;
  tokenRegistryPath: string;
  compiledBundlesPath: string;
  traceOutPath: string;
  flowsOutPath: string;
  reportOutPath: string;
  verseTraceOutPath: string;
  verseReportOutPath: string;
  verseMotifIndexOutPath: string;
};

type BuildVerseWordRowsMetaInput = {
  verseEntry: {
    ref: {
      book: string;
      chapter: number;
      verse: number;
    };
    words: string[];
  };
  tokenize: (surface: string) => unknown[];
  tokenIdBySignature: Map<string, number>;
  compiledTokenIdSet: Set<string>;
  buildRefKey: (ref: {
    book: string;
    chapter: number;
    verse: number;
    token_index: number;
  }) => string;
  resolveWordTokenIds: (args: {
    surface: string;
    tokenize: (surface: string) => unknown[];
    tokenIdBySignature: Map<string, number>;
    compiledTokenIdSet: Set<string>;
  }) => {
    token_ids: number[];
    unknown_signatures: string[];
    missing_bundle_ids: number[];
  };
};

type ExecutionResult = {
  flowRaw: string[];
  flowCompact: string[];
  traceEvents: unknown[];
  runtimeErrorMessage: string;
  windowStart: number;
  safetyRailClamped?: boolean;
  safetyRailDeltaOps?: unknown;
};

type VerseWordRow = {
  boundary_ops: string[];
};

type BuildWordExecutionArtifactsInput = {
  traceVersion: string;
  traceRenderVersion: string;
  semanticVersion: string;
  mode: string;
  debugRawEvents: boolean;
  meta: {
    ref: {
      book: string;
      chapter: number;
      verse: number;
      token_index: number;
    };
    ref_key: string;
    surface: string;
    token_ids: number[];
  };
  wordIndex: number;
  baselineExecution: ExecutionResult;
  execution: ExecutionResult;
  compileFlowString: (skeleton: string[], separator: string) => string;
  extractBoundaryOps: (skeleton: string[]) => string[];
  explainDeltaByMode: (args: {
    mode: string;
    tokenIndex: number;
    windowStart: number;
    boundaryOps: string[];
  }) => string;
  arraysEqual: (left: string[], right: string[]) => boolean;
  canonicalizeWordTraceRecord: (record: Record<string, unknown>) => Record<string, unknown>;
};

type BuildWordExecutionArtifactsOutput = {
  row: Record<string, unknown>;
  flowLine: string;
  baselineRow: {
    ref_key: string;
    skeleton: string[];
  };
  runtimeErrorSample: {
    ref_key: string;
    surface: string;
    message: string;
  } | null;
  skeleton: string[];
  skeletonKey: string;
  boundaryOps: string[];
  traceEventCount: number;
  verseWordRow: {
    ref_key: string;
    token_index: number;
    skeleton: string[];
    boundary_ops: string[];
  };
  deltaEvent: {
    ref_key: string;
    token_index: number;
    baseline_skeleton: string[];
    observed_skeleton: string[];
    explanation: string;
  } | null;
};

type AccumulateWordExecutionArtifactsInput = {
  artifacts: BuildWordExecutionArtifactsOutput;
  verseRefKey: string;
  rows: Record<string, unknown>[];
  flowLines: string[];
  baselineRows: Array<{
    ref_key: string;
    skeleton: string[];
  }>;
  runtimeErrors: Array<{
    ref_key: string;
    surface: string;
    message: string;
  }>;
  skeletonCounts: Map<string, number>;
  boundaryByType: Record<string, number>;
  verseWordRows: Array<{
    ref_key: string;
    token_index: number;
    skeleton: string[];
    boundary_ops: string[];
  }>;
  crossWordEvents: Array<{
    ref_key: string;
    token_index: number;
    baseline_skeleton: string[];
    observed_skeleton: string[];
    explanation: string;
  }>;
  modeDiffEvents: Array<{
    verse_ref_key: string;
    ref_key: string;
    token_index: number;
    baseline_skeleton: string[];
    observed_skeleton: string[];
    explanation: string;
  }>;
  totalEventsInVerse: number;
};

type FinalizeExecuteOutputsInput = {
  rows: Record<string, unknown>[];
  verseRows: Record<string, unknown>[];
  compareWordTraceRecords: (
    left: Record<string, unknown>,
    right: Record<string, unknown>
  ) => number;
  compareVerseTraceRecords: (
    left: Record<string, unknown>,
    right: Record<string, unknown>
  ) => number;
  skeletonCounts: Map<string, number>;
  topSkeletonLimit?: number;
};

type FinalizeExecuteOutputsOutput = {
  sortedRows: Record<string, unknown>[];
  sortedVerseRows: Record<string, unknown>[];
  traceContent: string;
  verseTraceContent: string;
  topSkeletons: Array<[string, number]>;
  uniqueSkeletons: number;
};

type BuildExecuteCompletionInput = {
  wordsEmitted: number;
  modeLabel: string;
  uniqueSkeletons: number;
  runtimeErrors: number;
  traceOutPath: string;
  flowsOutPath: string;
  verseTraceOutPath: string;
  reportOutPath: string;
  verseReportOutPath: string;
  verseMotifIndexOutPath: string;
  unknownSignatures: number;
  missingBundles: number;
};

type BuildExecuteCompletionOutput = {
  hardErrorMessage: string | null;
  consoleLine: string;
};

type BuildVerseMotifIndexInput = {
  modeLabel: string;
  semanticVersion: string;
  verseRows: Array<{
    ref_key?: string;
    cross_word_events?: unknown[];
    boundary_events?: {
      by_type?: Record<string, number>;
    };
    notable_motifs?: Array<{
      motif?: string;
      count?: number;
      samples?: unknown;
      refs?: unknown;
      ops?: unknown;
      action?: unknown;
    }>;
  }>;
  safetyRailSummary: Record<string, unknown>;
  verseTraceSha256: string;
};

type BuildExecuteWritePlanInput = {
  traceOutPath: string;
  flowsOutPath: string;
  reportOutPath: string;
  verseTraceOutPath: string;
  verseReportOutPath: string;
  verseMotifIndexOutPath: string;
  traceContent: string;
  flowLines: string[];
  verseTraceContent: string;
  reportLines: string[];
  verseReportLines: string[];
  verseMotifIndexPayload: Record<string, unknown>;
};

type BuildExecuteWritePlanOutput = {
  directoryPaths: string[];
  textWrites: Array<{
    path: string;
    content: string;
  }>;
  jsonWrites: Array<{
    path: string;
    payload: Record<string, unknown>;
  }>;
};

type BuildBaselineExecutionsInput = {
  wordRowsMeta: Array<{
    unknown_signatures: string[];
    surface: string;
  }>;
  getIsolatedFlow: (surface: string) => ExecutionResult;
  makeUnknownSignatureTraceEvent: (signature: string) => unknown;
};

type BuildVerseTraceRecordInput = {
  traceVersion: string;
  traceRenderVersion: string;
  semanticVersion: string;
  verseRef: {
    book: string;
    chapter: number;
    verse: number;
  };
  verseRefKey: string;
  modeLabel: string;
  mode: string;
  windowSize: number | null;
  safetyRailActive: boolean;
  provisionalDeltaCount: number;
  provisionalDeltaRate: number;
  safetyRailThreshold: number;
  verseWordRows: VerseWordRow[];
  crossWordEvents: unknown[];
  totalEventsInVerse: number;
  boundaryByType: Record<string, number>;
  sortCountObjectByKey: (counts: Record<string, number>) => Record<string, number>;
  buildVerseBoundaryResolution: (
    verseWordRows: VerseWordRow[],
    boundaryByType: Record<string, number>
  ) => unknown;
  buildVerseMotifs: (args: {
    verseWordRows: VerseWordRow[];
    crossWordEvents: unknown[];
    verseBoundaryResolution: unknown;
  }) => unknown[];
};

export function resolveExecutePaths(opts: ExecutePathOpts): ExecutePaths {
  return {
    inputPath: path.resolve(opts.input),
    tokenRegistryPath: path.resolve(opts.tokenRegistry),
    compiledBundlesPath: path.resolve(opts.compiledBundles),
    traceOutPath: path.resolve(opts.traceOut),
    flowsOutPath: path.resolve(opts.flowsOut),
    reportOutPath: path.resolve(opts.reportOut),
    verseTraceOutPath: path.resolve(opts.verseTraceOut),
    verseReportOutPath: path.resolve(opts.verseReportOut),
    verseMotifIndexOutPath: path.resolve(opts.verseMotifIndexOut)
  };
}

export function resolveSemanticVersion(
  cliSemanticVersion: string,
  compiledPayload: unknown,
  semanticsDefsPayload: unknown
): string {
  const compiledVersion =
    compiledPayload &&
    typeof compiledPayload === "object" &&
    "semantics" in compiledPayload &&
    compiledPayload.semantics &&
    typeof compiledPayload.semantics === "object" &&
    "semver" in compiledPayload.semantics
      ? String((compiledPayload.semantics as { semver?: string }).semver ?? "")
      : "";
  const defsVersion =
    semanticsDefsPayload &&
    typeof semanticsDefsPayload === "object" &&
    "semver" in semanticsDefsPayload
      ? String((semanticsDefsPayload as { semver?: string }).semver ?? "")
      : "";
  return cliSemanticVersion || compiledVersion || defsVersion || "unknown";
}

export function assertExecuteTokenSources(args: {
  tokenIdBySignatureSize: number;
  compiledTokenCount: number;
  tokenRegistryPath: string;
  compiledBundlesPath: string;
}): void {
  if (args.tokenIdBySignatureSize === 0) {
    throw new Error(`No tokens loaded from token registry at ${args.tokenRegistryPath}`);
  }
  if (args.compiledTokenCount === 0) {
    throw new Error(`No compiled bundles loaded from ${args.compiledBundlesPath}`);
  }
}

export function buildVerseWordRowsMeta({
  verseEntry,
  tokenize,
  tokenIdBySignature,
  compiledTokenIdSet,
  buildRefKey,
  resolveWordTokenIds
}: BuildVerseWordRowsMetaInput): {
  wordRowsMeta: Array<{
    ref: {
      book: string;
      chapter: number;
      verse: number;
      token_index: number;
    };
    ref_key: string;
    surface: string;
    token_ids: number[];
    unknown_signatures: string[];
  }>;
  missingBundles: Array<{ ref_key: string; surface: string; token_id: number }>;
  unknownSignatures: Array<{ ref_key: string; surface: string; signatures: string[] }>;
} {
  const wordRowsMeta = [];
  const missingBundles: Array<{ ref_key: string; surface: string; token_id: number }> = [];
  const unknownSignatures: Array<{ ref_key: string; surface: string; signatures: string[] }> = [];

  for (let wordIndex = 0; wordIndex < verseEntry.words.length; wordIndex += 1) {
    const surface = verseEntry.words[wordIndex];
    const ref = {
      book: verseEntry.ref.book,
      chapter: verseEntry.ref.chapter,
      verse: verseEntry.ref.verse,
      token_index: wordIndex + 1
    };
    const refKey = buildRefKey(ref);
    const tokenMeta = resolveWordTokenIds({
      surface,
      tokenize,
      tokenIdBySignature,
      compiledTokenIdSet
    });

    for (const tokenId of tokenMeta.missing_bundle_ids) {
      missingBundles.push({ ref_key: refKey, surface, token_id: tokenId });
    }
    if (tokenMeta.unknown_signatures.length > 0) {
      unknownSignatures.push({
        ref_key: refKey,
        surface,
        signatures: tokenMeta.unknown_signatures
      });
    }

    wordRowsMeta.push({
      ref,
      ref_key: refKey,
      surface,
      token_ids: tokenMeta.token_ids,
      unknown_signatures: tokenMeta.unknown_signatures
    });
  }

  return { wordRowsMeta, missingBundles, unknownSignatures };
}

export function selectModeExecutions(args: {
  mode: string;
  baselineExecutions: ExecutionResult[];
  words: string[];
  windowSize: number | null;
  defaultWindowSize: number;
  runVerseWordFlows: (input: {
    words: string[];
    runProgramWithTrace: unknown;
    createInitialState: unknown;
    allowRuntimeErrors: boolean;
    verseRefKey: string;
  }) => ExecutionResult[];
  runWindowWordFlows: (input: {
    words: string[];
    windowSize: number;
    runProgramWithTrace: unknown;
    createInitialState: unknown;
    allowRuntimeErrors: boolean;
    verseRefKey: string;
  }) => ExecutionResult[];
  runProgramWithTrace: unknown;
  createInitialState: unknown;
  allowRuntimeErrors: boolean;
  verseRefKey: string;
}): ExecutionResult[] {
  if (args.mode === "WORD") {
    return args.baselineExecutions.map((execution) => ({
      flowRaw: [...execution.flowRaw],
      flowCompact: [...execution.flowCompact],
      traceEvents: [...execution.traceEvents],
      runtimeErrorMessage: execution.runtimeErrorMessage,
      windowStart: execution.windowStart
    }));
  }
  if (args.mode === "VERSE") {
    return args.runVerseWordFlows({
      words: args.words,
      runProgramWithTrace: args.runProgramWithTrace,
      createInitialState: args.createInitialState,
      allowRuntimeErrors: args.allowRuntimeErrors,
      verseRefKey: args.verseRefKey
    });
  }
  return args.runWindowWordFlows({
    words: args.words,
    windowSize: args.windowSize ?? args.defaultWindowSize,
    runProgramWithTrace: args.runProgramWithTrace,
    createInitialState: args.createInitialState,
    allowRuntimeErrors: args.allowRuntimeErrors,
    verseRefKey: args.verseRefKey
  });
}

export function computeSafetyRailActivation(args: {
  mode: string;
  safetyRailEnabled: boolean;
  safetyRailThreshold: number;
  wordRowsMeta: Array<{ unknown_signatures: string[] }>;
  baselineExecutions: ExecutionResult[];
  modeExecutions: ExecutionResult[];
  arraysEqual: (left: string[], right: string[]) => boolean;
}): {
  provisionalDeltaCount: number;
  provisionalDeltaRate: number;
  safetyRailActive: boolean;
} {
  const provisionalDeltaCount = args.wordRowsMeta.reduce((sum, meta, index) => {
    if (meta.unknown_signatures.length > 0) {
      return sum;
    }
    return args.arraysEqual(
      args.baselineExecutions[index].flowCompact,
      args.modeExecutions[index].flowCompact
    )
      ? sum
      : sum + 1;
  }, 0);
  const provisionalDeltaRate =
    args.wordRowsMeta.length > 0 ? provisionalDeltaCount / args.wordRowsMeta.length : 0;
  const safetyRailActive =
    args.mode !== "WORD" &&
    args.safetyRailEnabled &&
    provisionalDeltaRate > args.safetyRailThreshold;
  return {
    provisionalDeltaCount,
    provisionalDeltaRate,
    safetyRailActive
  };
}

export function applyWordExecutionPolicy(args: {
  metaUnknownSignatures: string[];
  baselineExecution: ExecutionResult;
  modeExecution: ExecutionResult;
  mode: string;
  safetyRailActive: boolean;
  arraysEqual: (left: string[], right: string[]) => boolean;
  skeletonDeltaOps: (previousSkeleton: string[], nextSkeleton: string[]) => unknown;
  isSafetyRailDeltaAllowed: (deltaOps: unknown) => boolean;
  makeUnknownSignatureTraceEvent: (signature: string) => unknown;
}): {
  execution: ExecutionResult;
  changedFromBaseline: boolean;
  allowedDeltaIncrement: number;
  blockedDeltaIncrement: number;
  clampedWordIncrement: number;
} {
  let execution = args.modeExecution;

  if (args.metaUnknownSignatures.length > 0) {
    execution = {
      flowRaw: ["ERROR.UNKNOWN_SIGNATURE"],
      flowCompact: ["ERROR.UNKNOWN_SIGNATURE"],
      traceEvents: [
        args.makeUnknownSignatureTraceEvent(args.metaUnknownSignatures[0] ?? "unknown")
      ],
      runtimeErrorMessage: "",
      windowStart: execution?.windowStart ?? args.baselineExecution.windowStart
    };
  }

  const changedFromBaseline = !args.arraysEqual(
    args.baselineExecution.flowCompact,
    execution.flowCompact
  );

  if (args.safetyRailActive && changedFromBaseline) {
    const deltaOps = args.skeletonDeltaOps(
      args.baselineExecution.flowCompact,
      execution.flowCompact
    );
    if (!args.isSafetyRailDeltaAllowed(deltaOps)) {
      execution = {
        flowRaw: [...args.baselineExecution.flowRaw],
        flowCompact: [...args.baselineExecution.flowCompact],
        traceEvents: [...args.baselineExecution.traceEvents],
        runtimeErrorMessage: args.baselineExecution.runtimeErrorMessage,
        windowStart: execution.windowStart,
        safetyRailClamped: true,
        safetyRailDeltaOps: deltaOps
      };
      return {
        execution,
        changedFromBaseline,
        allowedDeltaIncrement: 0,
        blockedDeltaIncrement: 1,
        clampedWordIncrement: 1
      };
    }
    return {
      execution,
      changedFromBaseline,
      allowedDeltaIncrement: 1,
      blockedDeltaIncrement: 0,
      clampedWordIncrement: 0
    };
  }

  return {
    execution,
    changedFromBaseline,
    allowedDeltaIncrement: changedFromBaseline && args.mode !== "WORD" ? 1 : 0,
    blockedDeltaIncrement: 0,
    clampedWordIncrement: 0
  };
}

export function buildVerseTraceRecord(args: BuildVerseTraceRecordInput): Record<string, unknown> {
  const verseEndBoundaryOps =
    args.verseWordRows.length > 0
      ? args.verseWordRows[args.verseWordRows.length - 1].boundary_ops
      : [];
  const verseBoundaryResolution = args.buildVerseBoundaryResolution(
    args.verseWordRows,
    args.boundaryByType
  );

  const verseRecord: Record<string, unknown> = {
    record_kind: "VERSE_TRACE",
    trace_version: args.traceVersion,
    semantics_version: args.semanticVersion,
    render_version: args.traceRenderVersion,
    ref: args.verseRef,
    ref_key: args.verseRefKey,
    mode: args.modeLabel,
    words_total: args.verseWordRows.length,
    total_events: args.totalEventsInVerse,
    boundary_events: {
      total: Object.values(args.boundaryByType).reduce((sum, count) => sum + Number(count), 0),
      by_type: args.sortCountObjectByKey(args.boundaryByType),
      verse_end: verseEndBoundaryOps,
      verse_boundary_operator: verseBoundaryResolution
    },
    cross_word_events: args.crossWordEvents,
    notable_motifs: args.buildVerseMotifs({
      verseWordRows: args.verseWordRows,
      crossWordEvents: args.crossWordEvents,
      verseBoundaryResolution
    })
  };

  if (args.safetyRailActive) {
    verseRecord.safety_rail = {
      active: true,
      provisional_delta_count: args.provisionalDeltaCount,
      provisional_delta_rate: Number(args.provisionalDeltaRate.toFixed(6)),
      threshold: args.safetyRailThreshold
    };
  }
  if (args.mode === "WINDOW") {
    verseRecord.window_size = args.windowSize;
  }

  return verseRecord;
}

export function buildWordExecutionArtifacts(
  args: BuildWordExecutionArtifactsInput
): BuildWordExecutionArtifactsOutput {
  const skeleton = args.execution.flowCompact;
  const flow = args.compileFlowString(skeleton, " ⇢ ");
  const skeletonKey = skeleton.join(" -> ");
  const boundaryOps = args.extractBoundaryOps(skeleton);

  const rawWordRecord: Record<string, unknown> = {
    record_kind: "WORD_TRACE",
    trace_version: args.traceVersion,
    semantics_version: args.semanticVersion,
    render_version: args.traceRenderVersion,
    ref: args.meta.ref,
    ref_key: args.meta.ref_key,
    surface: args.meta.surface,
    token_ids: args.meta.token_ids,
    events: args.execution.traceEvents,
    skeleton,
    flow,
    mode: args.mode
  };
  if (args.mode === "WINDOW") {
    rawWordRecord.window_start = args.execution.windowStart ?? 1;
  }

  const row = args.canonicalizeWordTraceRecord(rawWordRecord);
  if (args.debugRawEvents) {
    row.skeleton_raw = args.execution.flowRaw;
  }

  const changedFromBaseline = !args.arraysEqual(args.baselineExecution.flowCompact, skeleton);
  const deltaEvent =
    args.mode !== "WORD" && changedFromBaseline
      ? {
          ref_key: args.meta.ref_key,
          token_index: args.wordIndex + 1,
          baseline_skeleton: args.baselineExecution.flowCompact,
          observed_skeleton: skeleton,
          explanation: args.explainDeltaByMode({
            mode: args.mode,
            tokenIndex: args.wordIndex + 1,
            windowStart: args.execution.windowStart ?? 1,
            boundaryOps
          })
        }
      : null;

  return {
    row,
    flowLine: `${args.meta.ref_key}\t${args.meta.surface}\t${flow}`,
    baselineRow: {
      ref_key: args.meta.ref_key,
      skeleton: args.baselineExecution.flowCompact
    },
    runtimeErrorSample: args.execution.runtimeErrorMessage
      ? {
          ref_key: args.meta.ref_key,
          surface: args.meta.surface,
          message: args.execution.runtimeErrorMessage
        }
      : null,
    skeleton,
    skeletonKey,
    boundaryOps,
    traceEventCount: args.execution.traceEvents.length,
    verseWordRow: {
      ref_key: args.meta.ref_key,
      token_index: args.wordIndex + 1,
      skeleton,
      boundary_ops: boundaryOps
    },
    deltaEvent
  };
}

export function accumulateWordExecutionArtifacts(
  args: AccumulateWordExecutionArtifactsInput
): number {
  if (args.artifacts.runtimeErrorSample) {
    args.runtimeErrors.push(args.artifacts.runtimeErrorSample);
  }
  args.skeletonCounts.set(
    args.artifacts.skeletonKey,
    (args.skeletonCounts.get(args.artifacts.skeletonKey) ?? 0) + 1
  );
  args.rows.push(args.artifacts.row);
  args.flowLines.push(args.artifacts.flowLine);
  args.baselineRows.push(args.artifacts.baselineRow);

  for (const op of args.artifacts.boundaryOps) {
    args.boundaryByType[op] = (args.boundaryByType[op] ?? 0) + 1;
  }
  args.verseWordRows.push(args.artifacts.verseWordRow);

  if (args.artifacts.deltaEvent) {
    args.crossWordEvents.push(args.artifacts.deltaEvent);
    args.modeDiffEvents.push({
      verse_ref_key: args.verseRefKey,
      ...args.artifacts.deltaEvent
    });
  }

  return args.totalEventsInVerse + args.artifacts.traceEventCount;
}

export function finalizeExecuteOutputs(
  args: FinalizeExecuteOutputsInput
): FinalizeExecuteOutputsOutput {
  const sortedRows = [...args.rows].sort(args.compareWordTraceRecords);
  const sortedVerseRows = [...args.verseRows].sort(args.compareVerseTraceRecords);
  const traceContent = sortedRows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const verseTraceContent = sortedVerseRows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const topSkeletons = Array.from(args.skeletonCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"))
    .slice(0, args.topSkeletonLimit ?? 20);

  return {
    sortedRows,
    sortedVerseRows,
    traceContent,
    verseTraceContent,
    topSkeletons,
    uniqueSkeletons: args.skeletonCounts.size
  };
}

export function buildExecuteCompletion(
  args: BuildExecuteCompletionInput
): BuildExecuteCompletionOutput {
  const hardErrorMessage =
    args.unknownSignatures > 0 || args.missingBundles > 0
      ? `execute failed: unknownSignatures=${args.unknownSignatures} missingBundles=${args.missingBundles}`
      : null;
  const consoleLine = [
    `execute: words=${args.wordsEmitted}`,
    `mode=${args.modeLabel}`,
    `uniqueSkeletons=${args.uniqueSkeletons}`,
    `runtimeErrors=${args.runtimeErrors}`,
    `traceOut=${args.traceOutPath}`,
    `flowsOut=${args.flowsOutPath}`,
    `verseTraceOut=${args.verseTraceOutPath}`,
    `reportOut=${args.reportOutPath}`,
    `verseReportOut=${args.verseReportOutPath}`,
    `verseMotifIndexOut=${args.verseMotifIndexOutPath}`
  ].join(" ");

  return {
    hardErrorMessage,
    consoleLine
  };
}

function sortCountObjectByKeyLocal(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(obj ?? {}).sort(sortRefLike)) {
    out[key] = obj[key];
  }
  return out;
}

export function buildVerseMotifIndex(args: BuildVerseMotifIndexInput): Record<string, unknown> {
  const motifByName = new Map<
    string,
    {
      motif: string;
      count: number;
      verse_refs: string[];
      samples: unknown[];
    }
  >();
  const boundaryCounts: Record<string, number> = {};
  let crossWordEventCount = 0;

  for (const row of args.verseRows) {
    crossWordEventCount += (row.cross_word_events ?? []).length;
    for (const [op, count] of Object.entries(row.boundary_events?.by_type ?? {})) {
      boundaryCounts[op] = (boundaryCounts[op] ?? 0) + Number(count);
    }
    for (const motif of row.notable_motifs ?? []) {
      if (typeof motif?.motif !== "string" || motif.motif.length === 0) {
        continue;
      }
      const entry = motifByName.get(motif.motif) ?? {
        motif: motif.motif,
        count: 0,
        verse_refs: [],
        samples: []
      };
      entry.count += Number(motif.count ?? 0);
      if (
        entry.verse_refs.length < 40 &&
        typeof row.ref_key === "string" &&
        row.ref_key.length > 0
      ) {
        entry.verse_refs.push(row.ref_key);
      }
      const sampleCandidate = motif.samples ?? motif.refs ?? motif.ops ?? motif.action ?? null;
      if (sampleCandidate !== null && entry.samples.length < 20) {
        entry.samples.push(sampleCandidate);
      }
      motifByName.set(motif.motif, entry);
    }
  }

  const motifs = Array.from(motifByName.values()).sort(
    (left, right) => right.count - left.count || sortRefLike(left.motif, right.motif)
  );

  return {
    schema_version: 1,
    mode: args.modeLabel,
    semantic_version: args.semanticVersion,
    verse_trace_sha256: args.verseTraceSha256,
    verses_indexed: args.verseRows.length,
    cross_word_event_count: crossWordEventCount,
    boundary_operator_totals: sortCountObjectByKeyLocal(boundaryCounts),
    safety_rail: args.safetyRailSummary,
    motifs
  };
}

export function buildExecuteWritePlan(
  args: BuildExecuteWritePlanInput
): BuildExecuteWritePlanOutput {
  const directoryPaths = Array.from(
    new Set([
      path.dirname(args.traceOutPath),
      path.dirname(args.flowsOutPath),
      path.dirname(args.reportOutPath),
      path.dirname(args.verseTraceOutPath),
      path.dirname(args.verseReportOutPath),
      path.dirname(args.verseMotifIndexOutPath)
    ])
  ).sort(sortRefLike);

  return {
    directoryPaths,
    textWrites: [
      {
        path: args.traceOutPath,
        content: args.traceContent
      },
      {
        path: args.flowsOutPath,
        content: args.flowLines.join("\n") + "\n"
      },
      {
        path: args.verseTraceOutPath,
        content: args.verseTraceContent
      },
      {
        path: args.reportOutPath,
        content: args.reportLines.join("\n") + "\n"
      },
      {
        path: args.verseReportOutPath,
        content: args.verseReportLines.join("\n") + "\n"
      }
    ],
    jsonWrites: [
      {
        path: args.verseMotifIndexOutPath,
        payload: args.verseMotifIndexPayload
      }
    ]
  };
}

export function buildBaselineExecutions(args: BuildBaselineExecutionsInput): ExecutionResult[] {
  return args.wordRowsMeta.map((meta) => {
    if (meta.unknown_signatures.length > 0) {
      return {
        flowRaw: ["ERROR.UNKNOWN_SIGNATURE"],
        flowCompact: ["ERROR.UNKNOWN_SIGNATURE"],
        traceEvents: [args.makeUnknownSignatureTraceEvent(meta.unknown_signatures[0] ?? "unknown")],
        runtimeErrorMessage: "",
        windowStart: 1
      };
    }
    return args.getIsolatedFlow(meta.surface);
  });
}

export function assertModeExecutionLength(args: {
  modeLabel: string;
  verseRefKey: string;
  emitted: number;
  expected: number;
}): void {
  if (args.emitted !== args.expected) {
    throw new Error(
      `Execution mode ${args.modeLabel} emitted ${args.emitted} rows for ${args.verseRefKey}, expected ${args.expected}`
    );
  }
}

function sortRefLike(left: string, right: string): number {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}
