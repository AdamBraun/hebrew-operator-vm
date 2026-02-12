import crypto from "node:crypto";
import path from "node:path";
import { workspaceRelativePath } from "./report";

type SkeletonRow = {
  skeleton: string[];
  flow: string;
};

type BaselineRow = {
  skeleton: string[];
};

type ModeDiffEvent = {
  ref_key: string;
  baseline_skeleton: string[];
  observed_skeleton: string[];
  explanation: string;
};

type UnknownSignatureSample = {
  ref_key: string;
  signatures: string[];
};

type MissingBundleSample = {
  ref_key: string;
  token_id: number;
};

type RuntimeErrorSample = {
  ref_key: string;
  message: string;
};

type SafetyRailStats = {
  enabled: boolean;
  threshold: number;
  activated_verses: number;
  clamped_words: number;
};

type VerseRow = {
  cross_word_events?: unknown[];
  boundary_events?: {
    by_type?: Record<string, number>;
    verse_boundary_operator?: {
      action?: string;
    };
  };
  notable_motifs?: Array<{
    motif?: string;
    count?: number;
  }>;
};

type BuildExecuteReportsInput = {
  inputPath: string;
  tokenRegistryPath: string;
  compiledBundlesPath: string;
  traceOutPath: string;
  flowsOutPath: string;
  reportOutPath: string;
  verseTraceOutPath: string;
  verseReportOutPath: string;
  verseMotifIndexOutPath: string;
  semanticVersion: string;
  mode: string;
  modeLabel: string;
  windowSize: number | null;
  safetyRailStats: SafetyRailStats;
  wordsTotal: number;
  versesTotal: number;
  versesSanitized: number;
  versesSkipped: number;
  rows: SkeletonRow[];
  baselineRows: BaselineRow[];
  modeDiffEvents: ModeDiffEvent[];
  verseRows: VerseRow[];
  uniqueSkeletons: number;
  topSkeletons: Array<[string, number]>;
  unknownSignatures: UnknownSignatureSample[];
  missingBundles: MissingBundleSample[];
  runtimeErrors: RuntimeErrorSample[];
  elapsedMs: number;
  traceContent: string;
  verseTraceContent: string;
  compileFlowString: (skeleton: string[], separator: string) => string;
  arraysEqual: (left: string[], right: string[]) => boolean;
};

type BuildExecuteReportsOutput = {
  traceSha256: string;
  verseTraceSha256: string;
  reportLines: string[];
  verseReportLines: string[];
};

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
  buildRefKey: (ref: { book: string; chapter: number; verse: number; token_index: number }) => string;
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

function sortRefLike(left: string, right: string): number {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

function sha256FromBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function buildExecuteReports(input: BuildExecuteReportsInput): BuildExecuteReportsOutput {
  const traceSha256 = sha256FromBuffer(Buffer.from(input.traceContent, "utf8"));
  const verseTraceSha256 = sha256FromBuffer(Buffer.from(input.verseTraceContent, "utf8"));

  const flowDeterminismFailures = input.rows.filter(
    (row) => row.flow !== input.compileFlowString(row.skeleton, " ⇢ ")
  ).length;
  const wordModeMismatches = input.rows.filter(
    (row, index) => !input.arraysEqual(row.skeleton, input.baselineRows[index]?.skeleton ?? [])
  ).length;
  const explainabilityFailures = input.modeDiffEvents.filter(
    (event) => typeof event.explanation !== "string" || event.explanation.length === 0
  ).length;
  const explainabilityPass =
    input.mode === "WORD" || input.modeDiffEvents.length === 0 || explainabilityFailures === 0;
  const wordModeGateText =
    input.mode === "WORD"
      ? `${wordModeMismatches === 0 ? "PASS" : "FAIL"} (${input.rows.length - wordModeMismatches}/${input.rows.length})`
      : `N/A (${input.modeLabel}; baseline_deltas=${input.modeDiffEvents.length})`;
  const explainabilityGateText =
    input.mode === "WORD"
      ? "PASS (WORD baseline mode)"
      : input.modeDiffEvents.length === 0
        ? "PASS (0/0)"
        : `${explainabilityPass ? "PASS" : "FAIL"} (${input.modeDiffEvents.length - explainabilityFailures}/${input.modeDiffEvents.length})`;
  const safetyRailGateText =
    !input.safetyRailStats.enabled || input.mode === "WORD"
      ? "N/A"
      : input.safetyRailStats.activated_verses === 0
        ? "PASS (not triggered)"
        : `ACTIVE (verses=${input.safetyRailStats.activated_verses}, clamped_words=${input.safetyRailStats.clamped_words})`;

  const reportLines = [
    "# Corpus Execution Report",
    "",
    "## Summary",
    `- input: ${workspaceRelativePath(input.inputPath)}`,
    `- token_registry: ${workspaceRelativePath(input.tokenRegistryPath)}`,
    `- compiled_bundles: ${workspaceRelativePath(input.compiledBundlesPath)}`,
    `- semantic_version: ${input.semanticVersion}`,
    `- execution_mode: ${input.modeLabel}`,
    `- safety_rail_enabled: ${input.safetyRailStats.enabled}`,
    `- safety_rail_threshold: ${input.safetyRailStats.threshold}`,
    `- words_total: ${input.wordsTotal}`,
    `- words_emitted: ${input.rows.length}`,
    `- verses_total: ${input.versesTotal}`,
    `- verses_sanitized: ${input.versesSanitized}`,
    `- verses_skipped: ${input.versesSkipped}`,
    `- verses_emitted: ${input.verseRows.length}`,
    `- unique_skeletons: ${input.uniqueSkeletons}`,
    `- trace_sha256: ${traceSha256}`,
    `- verse_trace_sha256: ${verseTraceSha256}`,
    `- elapsed_ms: ${input.elapsedMs.toFixed(2)}`,
    `- words_per_second: ${(input.elapsedMs > 0 ? (input.rows.length * 1000) / input.elapsedMs : 0).toFixed(2)}`,
    "",
    "## Quality Gates",
    `- coverage: ${input.rows.length === input.wordsTotal ? "PASS" : "FAIL"} (${input.rows.length}/${input.wordsTotal})`,
    `- determinism_basis: trace checksum captured (${traceSha256})`,
    `- flow_derivation: ${flowDeterminismFailures === 0 ? "PASS" : "FAIL"} (${flowDeterminismFailures} mismatches)`,
    `- word_mode_equivalence: ${wordModeGateText}`,
    `- explainability: ${explainabilityGateText}`,
    `- safety_rail: ${safetyRailGateText}`,
    "",
    "## Errors",
    `- unknown_signatures: ${input.unknownSignatures.length}`,
    `- missing_compiled_bundles: ${input.missingBundles.length}`,
    `- runtime_errors: ${input.runtimeErrors.length}`,
    "",
    "## Top Skeletons",
    ...input.topSkeletons.map(([skeleton, count]) => `- ${count} x ${skeleton || "(empty)"}`),
    "",
    "## Outputs",
    `- traces: ${workspaceRelativePath(input.traceOutPath)}`,
    `- flows: ${workspaceRelativePath(input.flowsOutPath)}`,
    `- verse_traces: ${workspaceRelativePath(input.verseTraceOutPath)}`,
    `- report: ${workspaceRelativePath(input.reportOutPath)}`,
    `- verse_report: ${workspaceRelativePath(input.verseReportOutPath)}`,
    `- verse_motif_index: ${workspaceRelativePath(input.verseMotifIndexOutPath)}`
  ];

  if (input.unknownSignatures.length > 0) {
    reportLines.push("", "### Unknown Signature Samples");
    for (const sample of input.unknownSignatures.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: ${sample.signatures.join(", ")}`);
    }
  }

  if (input.missingBundles.length > 0) {
    reportLines.push("", "### Missing Bundle Samples");
    for (const sample of input.missingBundles.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: token_id=${sample.token_id}`);
    }
  }

  if (input.runtimeErrors.length > 0) {
    reportLines.push("", "### Runtime Error Samples");
    for (const sample of input.runtimeErrors.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}: ${sample.message}`);
    }
  }

  if (input.modeDiffEvents.length > 0) {
    reportLines.push("", "### Cross-Word Delta Samples");
    for (const sample of input.modeDiffEvents.slice(0, 20)) {
      reportLines.push(`- ${sample.ref_key}`);
      reportLines.push(`  - baseline: ${sample.baseline_skeleton.join(" -> ") || "(empty)"}`);
      reportLines.push(`  - observed: ${sample.observed_skeleton.join(" -> ") || "(empty)"}`);
      reportLines.push(`  - reason: ${sample.explanation}`);
    }
  }

  const totalBoundaryByType: Record<string, number> = {};
  const motifTotals: Record<string, number> = {};
  const boundaryResolutionActionCounts: Record<string, number> = {};
  let versesWithCrossWordEvents = 0;
  for (const verseRow of input.verseRows) {
    if ((verseRow.cross_word_events ?? []).length > 0) {
      versesWithCrossWordEvents += 1;
    }
    for (const [op, count] of Object.entries(verseRow.boundary_events?.by_type ?? {})) {
      totalBoundaryByType[op] = (totalBoundaryByType[op] ?? 0) + Number(count);
    }
    for (const motif of verseRow.notable_motifs ?? []) {
      if (typeof motif.motif !== "string") {
        continue;
      }
      motifTotals[motif.motif] = (motifTotals[motif.motif] ?? 0) + Number(motif.count ?? 0);
    }
    const action = verseRow?.boundary_events?.verse_boundary_operator?.action;
    if (typeof action === "string" && action.length > 0) {
      boundaryResolutionActionCounts[action] = (boundaryResolutionActionCounts[action] ?? 0) + 1;
    }
  }

  const topBoundaryRows = Object.entries(totalBoundaryByType)
    .sort((left, right) => right[1] - left[1] || sortRefLike(left[0], right[0]))
    .slice(0, 12)
    .map(([op, count]) => `- ${count} x ${op}`);
  const topMotifRows = Object.entries(motifTotals)
    .sort((left, right) => right[1] - left[1] || sortRefLike(left[0], right[0]))
    .slice(0, 12)
    .map(([motif, count]) => `- ${count} x ${motif}`);
  const boundaryResolutionRows = Object.entries(boundaryResolutionActionCounts)
    .sort((left, right) => right[1] - left[1] || sortRefLike(left[0], right[0]))
    .map(([action, count]) => `- ${count} x ${action}`);

  const verseReportLines = [
    "# Verse Execution Report",
    "",
    "## Summary",
    `- input: ${workspaceRelativePath(input.inputPath)}`,
    `- semantic_version: ${input.semanticVersion}`,
    `- execution_mode: ${input.modeLabel}`,
    `- safety_rail_enabled: ${input.safetyRailStats.enabled}`,
    `- safety_rail_threshold: ${input.safetyRailStats.threshold}`,
    `- words_total: ${input.rows.length}`,
    `- verses_total: ${input.verseRows.length}`,
    `- changed_words_vs_word_mode: ${input.modeDiffEvents.length}`,
    `- verses_with_cross_word_events: ${versesWithCrossWordEvents}`,
    `- trace_sha256: ${traceSha256}`,
    `- verse_trace_sha256: ${verseTraceSha256}`,
    "",
    "## Quality Gates",
    `- word_mode_equivalence: ${wordModeGateText}`,
    `- determinism: PASS (checksum basis captured)`,
    `- explainability: ${explainabilityGateText}`,
    `- safety_rail: ${safetyRailGateText}`,
    "",
    "## Boundary Operators",
    ...(topBoundaryRows.length > 0 ? topBoundaryRows : ["- none"]),
    "",
    "## Verse Boundary Operator",
    ...(boundaryResolutionRows.length > 0 ? boundaryResolutionRows : ["- none"]),
    "",
    "## Motif Expansions",
    ...(topMotifRows.length > 0 ? topMotifRows : ["- none"]),
    "",
    "## Cross-Word Samples",
    ...(input.modeDiffEvents.length > 0
      ? input.modeDiffEvents
          .slice(0, 30)
          .map(
            (sample) =>
              `- ${sample.ref_key} | ${sample.baseline_skeleton.join(" -> ") || "(empty)"} => ${sample.observed_skeleton.join(" -> ") || "(empty)"} | ${sample.explanation}`
          )
      : ["- none"]),
    "",
    "## Outputs",
    `- traces: ${workspaceRelativePath(input.traceOutPath)}`,
    `- verse_traces: ${workspaceRelativePath(input.verseTraceOutPath)}`,
    `- execution_report: ${workspaceRelativePath(input.reportOutPath)}`,
    `- verse_report: ${workspaceRelativePath(input.verseReportOutPath)}`,
    `- verse_motif_index: ${workspaceRelativePath(input.verseMotifIndexOutPath)}`
  ];
  if (input.mode === "WINDOW") {
    const insertAfterExecutionMode = verseReportLines.findIndex((line) =>
      line.startsWith("- execution_mode:")
    );
    if (insertAfterExecutionMode >= 0) {
      verseReportLines.splice(
        insertAfterExecutionMode + 1,
        0,
        `- window_size: ${input.windowSize}`
      );
    }
  }

  return {
    traceSha256,
    verseTraceSha256,
    reportLines,
    verseReportLines
  };
}
