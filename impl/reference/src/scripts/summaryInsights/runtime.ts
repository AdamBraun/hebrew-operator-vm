import fs from "node:fs/promises";
import path from "node:path";
import { workspaceRelativePath } from "../torahCorpus/report";
import { loadSummary as loadSummaryModel, type Summary, type VerseRow } from "./model";
import {
  loadPerVersePayload,
  resolvePerVerseOutputPath,
  type PerVerseJoinPayload
} from "./joiners/perVerse";
import { extractContinuity, type ContinuityReport } from "./extractors/continuity";
import { extractPinned, type PinnedReport } from "./extractors/pinned";
import { extractCleanup, type CleanupReport } from "./extractors/cleanup";
import { extractStateShape, type StateShapeReport } from "./extractors/stateShape";
import { extractCarrySemantics, type CarrySemanticsReport } from "./extractors/carrySemantics";
import { extractErrors, type ErrorsReport } from "./extractors/errors";
import { extractSegmentation, type SegmentationReport } from "./extractors/segmentation";

export type InsightsFormat = "json" | "md" | "both";

type OptionValue = {
  value: string;
  nextIndex: number;
};

type ResolvedTopVerse = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  resolvedOutputPath: string;
  handles: number;
  droppedCount: number;
  keptCount: number;
  pinnedCount: number;
  carryOut: {
    omega: string | null;
    focus: string | null;
    domain: string | null;
  };
};

type CarryField = "omega" | "focus" | "domain";

type JoinLoadError = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  resolvedOutputPath: string;
  error: string;
};

type JoinBoundaryCoverageGap = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  reason: "missing_verse_boundary" | "load_error";
};

type JoinPinnedProvenanceRow = {
  handleId: string;
  occurrences: number;
  refKeys: string[];
  origins: string[];
};

type JoinMismatchDrillDown = {
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  ref_key: string;
  field: CarryField;
  summaryExpected: string | null;
  summaryObserved: string | null;
  boundaryStartNext: string | null;
  boundaryEnd: string | null;
  diagnosis:
    | "missing_previous_boundary"
    | "missing_boundary_start_next_field"
    | "boundary_matches_observed"
    | "boundary_matches_expected_only"
    | "boundary_disagrees";
};

type JoinSkippedVersesSummary = {
  count: number;
  sequences: number[];
};

type JoinMismatchTransitionCoverage = {
  total_transitions: number;
  fully_covered_transitions: number;
  partially_covered_transitions: number;
  uncovered_transitions: number;
  current_only_partial_transitions: number;
  previous_only_partial_transitions: number;
};

type JoinSelectionPlan = {
  verses_selected_for_join: number[];
  verses_skipped_due_to_limit: JoinSkippedVersesSummary;
  mismatch_transition_coverage: JoinMismatchTransitionCoverage;
};

type JoinReport = {
  requested: true;
  available: boolean;
  join_limit: number;
  verses_considered: number;
  verses_selected_for_join: number[];
  verses_loaded: number;
  verses_skipped_due_to_limit: JoinSkippedVersesSummary;
  mismatch_transition_coverage: JoinMismatchTransitionCoverage;
  load_errors: JoinLoadError[];
  boundary_instrumentation: {
    present_count: number;
    missing_count: number;
    coverage_rate: number | null;
    missing: JoinBoundaryCoverageGap[];
  };
  pinned_provenance: {
    provenance_available: boolean;
    pinned_observations: number;
    mapped_observations: number;
    unmapped_observations: number;
    mapped_handles: number;
    top_mapped_handles: JoinPinnedProvenanceRow[];
  };
  continuity_mismatch_drilldown: {
    mismatch_count: number;
    diagnosis_counts: Record<JoinMismatchDrillDown["diagnosis"], number>;
    items: JoinMismatchDrillDown[];
  };
};

type LoadedJoinVerse = {
  row: VerseRow;
  resolvedOutputPath: string;
  payload: PerVerseJoinPayload | null;
  loadError: string | null;
};

export type InsightsReport = {
  schema_version: 1;
  generated_at: string;
  source_summary_path: string;
  source_summary_sha256?: string;
  options: {
    format: InsightsFormat;
    top_n: number;
    include_joins: boolean;
    join_limit: number;
    workspace_root: string | null;
  };
  meta: {
    mode: string;
    from: string;
    to: string;
    versesSelected: number;
    runtimeErrors: number;
    expectedTransitions: number;
  };
  continuity: ContinuityReport;
  pinned: PinnedReport;
  cleanup: CleanupReport;
  stateShape: StateShapeReport;
  carrySemantics: CarrySemanticsReport;
  errors: ErrorsReport;
  segmentation: SegmentationReport;
  joinDetails?: JoinReport;
  overview: {
    mode: string;
    from: string;
    to: string;
    verses_selected: number;
    runtime_errors: number;
    expected_transitions: number;
    mismatch_counts: {
      omega: number;
      focus: number;
      domain: number;
    };
    non_increasing_handle_count: boolean;
  };
  top: {
    by_handle_count: ResolvedTopVerse[];
    by_dropped_count: ResolvedTopVerse[];
    by_pinned_count: ResolvedTopVerse[];
  };
  joins?: JoinReport;
};

export type InsightsIndexRow = {
  category: string;
  metric: string;
  sequence: number;
  ref_key: string;
  outputPath: string;
  resolvedOutputPath: string;
  value: number | string | null;
  details?: string;
};

export type InsightsIndex = {
  schema_version: 1;
  generated_at: string;
  source_summary_path: string;
  meta: {
    mode: string;
    from: string;
    to: string;
    versesSelected: number;
  };
  anomalies: InsightsIndexRow[];
  byCategory: Record<string, InsightsIndexRow[]>;
  totalAnomalies: number;
};

export type SummaryInsightsOptions = {
  summary: string;
  outDir: string;
  format: InsightsFormat;
  topN: number;
  includeJoins: boolean;
  joinLimit: number;
  workspaceRoot: string;
};

const DEFAULT_TOP_N = 25;
const DEFAULT_FORMAT: InsightsFormat = "both";
const DEFAULT_JOIN_LIMIT = 250;
const DEFAULT_JOIN_SAMPLE_LIMIT = 25;

function readOptionValue(argv: string[], index: number, optionName: string): OptionValue | null {
  const arg = argv[index] ?? "";
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return {
      value: arg.slice(prefix.length),
      nextIndex: index
    };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return {
      value: argv[index + 1] ?? "",
      nextIndex: index + 1
    };
  }
  return null;
}

function toAbsoluteMaybe(value: string, baseDir: string): string {
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(baseDir, value);
}

function parseInsightsFormat(rawValue: string): InsightsFormat {
  const format = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  if (format === "json" || format === "md" || format === "both") {
    return format;
  }
  throw new Error(`Invalid --format value: ${rawValue}. Expected one of: json, md, both`);
}

function parseTopN(rawValue: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid --top-n value: ${rawValue}. Expected a positive integer.`);
  }
  return value;
}

function parseJoinLimit(rawValue: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid --join-limit value: ${rawValue}. Expected a positive integer.`);
  }
  return value;
}

function compareTop(
  left: ResolvedTopVerse,
  right: ResolvedTopVerse,
  metric: "handles" | "droppedCount" | "pinnedCount"
): number {
  if (left[metric] !== right[metric]) {
    return right[metric] - left[metric];
  }
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  return left.ref_key.localeCompare(right.ref_key, "en");
}

function summarizeVerseRow(row: VerseRow, workspaceRoot: string): ResolvedTopVerse {
  const resolvedOutputPath = toAbsoluteMaybe(row.outputPath, workspaceRoot);
  return {
    sequence: row.sequence,
    ref_key: row.ref_key,
    outputPath: row.outputPath,
    resolvedOutputPath,
    handles: row.stateSize.handles,
    droppedCount: Number(row.cleanup.droppedCount ?? 0),
    keptCount: Number(row.cleanup.keptCount ?? 0),
    pinnedCount: Number(row.carryOut.pinnedCount ?? row.carryOut.pinned.length),
    carryOut: {
      omega: row.carryOut.omega,
      focus: row.carryOut.focus,
      domain: row.carryOut.domain
    }
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeNodeRef(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function readBoundaryField(
  verseBoundary: Record<string, unknown> | undefined,
  containerKey: "end" | "startNext",
  field: CarryField
): { exists: boolean; value: string | null } {
  const boundary = asObject(verseBoundary);
  if (!boundary) {
    return {
      exists: false,
      value: null
    };
  }
  const container = asObject(boundary[containerKey]);
  if (!container) {
    return {
      exists: false,
      value: null
    };
  }
  if (!Object.prototype.hasOwnProperty.call(container, field)) {
    return {
      exists: false,
      value: null
    };
  }
  return {
    exists: true,
    value: normalizeNodeRef(container[field])
  };
}

function collectStringLeaves(value: unknown, depth: number): string[] {
  if (depth > 3) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const entry of value) {
      out.push(...collectStringLeaves(entry, depth + 1));
    }
    return out;
  }
  const asRecord = asObject(value);
  if (!asRecord) {
    return [];
  }
  const preferredKeys = [
    "origin",
    "origins",
    "token",
    "tokens",
    "source",
    "sources",
    "ref",
    "refs"
  ];
  const out: string[] = [];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(asRecord, key)) {
      out.push(...collectStringLeaves(asRecord[key], depth + 1));
    }
  }
  if (out.length > 0) {
    return out;
  }
  for (const valueAtKey of Object.values(asRecord)) {
    out.push(...collectStringLeaves(valueAtKey, depth + 1));
  }
  return out;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, "en")
  );
}

function provenanceOriginsForHandle(payload: PerVerseJoinPayload, handleId: string): string[] {
  const candidateContainers: Array<Record<string, unknown> | null> = [];
  const provenance = asObject(payload.provenance);
  const traceMeta = asObject(payload.traceMeta);
  if (provenance) {
    candidateContainers.push(
      asObject(provenance.handles),
      asObject(provenance.handleOrigins),
      asObject(provenance.pinnedHandles),
      provenance
    );
  }
  if (traceMeta) {
    candidateContainers.push(
      asObject(traceMeta.handleOrigins),
      asObject(traceMeta.pinnedOrigins),
      asObject(traceMeta.provenanceByHandle),
      asObject(traceMeta.handles)
    );
  }

  const origins: string[] = [];
  for (const container of candidateContainers) {
    if (!container || !Object.prototype.hasOwnProperty.call(container, handleId)) {
      continue;
    }
    origins.push(...collectStringLeaves(container[handleId], 0));
  }
  return uniqueSorted(origins);
}

function compareJoinMapped(left: JoinPinnedProvenanceRow, right: JoinPinnedProvenanceRow): number {
  if (left.occurrences !== right.occurrences) {
    return right.occurrences - left.occurrences;
  }
  return left.handleId.localeCompare(right.handleId, "en");
}

function planJoinVerseSelection(args: {
  summary: Summary;
  report: InsightsReport;
  topN: number;
  joinLimit: number;
}): JoinSelectionPlan {
  const verseBySequence = new Map<number, VerseRow>();
  for (const row of args.summary.verses) {
    if (!verseBySequence.has(row.sequence)) {
      verseBySequence.set(row.sequence, row);
    }
  }
  const knownSequences = new Set(verseBySequence.keys());

  const mismatchTransitions: Array<{ prevSequence: number; sequence: number }> = [];
  const mismatchTransitionKeys = new Set<string>();
  for (const mismatch of args.report.continuity.mismatches.all) {
    const key = `${mismatch.prevSequence}->${mismatch.sequence}`;
    if (mismatchTransitionKeys.has(key)) {
      continue;
    }
    mismatchTransitionKeys.add(key);
    mismatchTransitions.push({
      prevSequence: mismatch.prevSequence,
      sequence: mismatch.sequence
    });
  }

  const candidateOrder: number[] = [];
  const candidateSeen = new Set<number>();
  const pushCandidate = (sequence: number): void => {
    if (!knownSequences.has(sequence) || candidateSeen.has(sequence)) {
      return;
    }
    candidateSeen.add(sequence);
    candidateOrder.push(sequence);
  };

  for (const transition of mismatchTransitions) {
    pushCandidate(transition.prevSequence);
    pushCandidate(transition.sequence);
  }
  for (const row of args.summary.verses) {
    if (!row.runtimeError) {
      continue;
    }
    pushCandidate(row.sequence);
  }
  for (const row of args.report.top.by_handle_count.slice(0, args.topN)) {
    pushCandidate(row.sequence);
  }
  for (const row of args.report.cleanup.outliers.topDroppedCount.slice(0, args.topN)) {
    pushCandidate(row.sequence);
  }
  for (const row of args.report.cleanup.outliers.topDropRate.slice(0, args.topN)) {
    pushCandidate(row.sequence);
  }
  for (const row of args.report.top.by_pinned_count.slice(0, args.topN)) {
    pushCandidate(row.sequence);
  }

  const selected: number[] = [];
  const selectedSet = new Set<number>();
  const pushSelected = (sequence: number): boolean => {
    if (
      selected.length >= args.joinLimit ||
      selectedSet.has(sequence) ||
      !knownSequences.has(sequence)
    ) {
      return false;
    }
    selectedSet.add(sequence);
    selected.push(sequence);
    return true;
  };

  for (const transition of mismatchTransitions) {
    if (selected.length >= args.joinLimit) {
      break;
    }
    const hasPrev = selectedSet.has(transition.prevSequence);
    const hasCurr = selectedSet.has(transition.sequence);
    if (hasPrev && hasCurr) {
      continue;
    }
    const canAddPrev = knownSequences.has(transition.prevSequence) && !hasPrev;
    const canAddCurr = knownSequences.has(transition.sequence) && !hasCurr;
    const remaining = args.joinLimit - selected.length;

    if (canAddPrev && canAddCurr) {
      if (remaining >= 2) {
        pushSelected(transition.prevSequence);
        pushSelected(transition.sequence);
      } else if (remaining === 1) {
        pushSelected(transition.sequence);
      }
      continue;
    }
    if (canAddCurr) {
      pushSelected(transition.sequence);
      continue;
    }
    if (canAddPrev) {
      pushSelected(transition.prevSequence);
    }
  }

  for (const sequence of candidateOrder) {
    if (selected.length >= args.joinLimit) {
      break;
    }
    pushSelected(sequence);
  }

  const skipped = candidateOrder.filter((sequence) => !selectedSet.has(sequence));

  let fullyCoveredTransitions = 0;
  let partiallyCoveredTransitions = 0;
  let uncoveredTransitions = 0;
  let currentOnlyPartialTransitions = 0;
  let previousOnlyPartialTransitions = 0;
  for (const transition of mismatchTransitions) {
    const hasPrev = selectedSet.has(transition.prevSequence);
    const hasCurr = selectedSet.has(transition.sequence);
    if (hasPrev && hasCurr) {
      fullyCoveredTransitions += 1;
      continue;
    }
    if (hasPrev || hasCurr) {
      partiallyCoveredTransitions += 1;
      if (hasCurr) {
        currentOnlyPartialTransitions += 1;
      } else {
        previousOnlyPartialTransitions += 1;
      }
      continue;
    }
    uncoveredTransitions += 1;
  }

  return {
    verses_selected_for_join: selected,
    verses_skipped_due_to_limit: {
      count: skipped.length,
      sequences: skipped.slice(0, DEFAULT_JOIN_SAMPLE_LIMIT)
    },
    mismatch_transition_coverage: {
      total_transitions: mismatchTransitions.length,
      fully_covered_transitions: fullyCoveredTransitions,
      partially_covered_transitions: partiallyCoveredTransitions,
      uncovered_transitions: uncoveredTransitions,
      current_only_partial_transitions: currentOnlyPartialTransitions,
      previous_only_partial_transitions: previousOnlyPartialTransitions
    }
  };
}

async function buildJoinReport(args: {
  summary: Summary;
  report: InsightsReport;
  workspaceRoot: string;
  joinLimit: number;
  joinPlan: JoinSelectionPlan;
}): Promise<JoinReport> {
  const workspaceRootResolved = args.workspaceRoot
    ? path.resolve(args.workspaceRoot)
    : process.cwd();
  const verseBySequence = new Map<number, VerseRow>();
  for (const row of args.summary.verses) {
    if (!verseBySequence.has(row.sequence)) {
      verseBySequence.set(row.sequence, row);
    }
  }
  const versesConsidered = args.joinPlan.verses_selected_for_join
    .map((sequence) => verseBySequence.get(sequence))
    .filter((row): row is VerseRow => Boolean(row));

  const loadedVerses: LoadedJoinVerse[] = [];
  const loadErrors: JoinLoadError[] = [];
  for (const row of versesConsidered) {
    const resolvedOutputPath = resolvePerVerseOutputPath(row.outputPath, workspaceRootResolved);
    try {
      const payload = await loadPerVersePayload(row.outputPath, workspaceRootResolved);
      loadedVerses.push({
        row,
        resolvedOutputPath,
        payload,
        loadError: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loadedVerses.push({
        row,
        resolvedOutputPath,
        payload: null,
        loadError: message
      });
      loadErrors.push({
        sequence: row.sequence,
        ref_key: row.ref_key,
        outputPath: row.outputPath,
        resolvedOutputPath,
        error: message
      });
    }
  }

  const missingBoundary: JoinBoundaryCoverageGap[] = [];
  let boundaryPresentCount = 0;
  for (const loaded of loadedVerses) {
    if (loaded.loadError) {
      missingBoundary.push({
        sequence: loaded.row.sequence,
        ref_key: loaded.row.ref_key,
        outputPath: loaded.row.outputPath,
        reason: "load_error"
      });
      continue;
    }
    if (loaded.payload?.verseBoundary) {
      boundaryPresentCount += 1;
      continue;
    }
    missingBoundary.push({
      sequence: loaded.row.sequence,
      ref_key: loaded.row.ref_key,
      outputPath: loaded.row.outputPath,
      reason: "missing_verse_boundary"
    });
  }

  const mappedByHandle = new Map<
    string,
    {
      occurrences: number;
      refs: Set<string>;
      origins: Set<string>;
    }
  >();
  let provenanceAvailable = false;
  let pinnedObservations = 0;
  let mappedObservations = 0;

  for (const loaded of loadedVerses) {
    if (!loaded.payload) {
      continue;
    }
    if (loaded.payload.provenance || loaded.payload.traceMeta) {
      provenanceAvailable = true;
    }
    for (const handleId of loaded.row.carryOut.pinned) {
      pinnedObservations += 1;
      const origins = provenanceOriginsForHandle(loaded.payload, handleId);
      if (origins.length === 0) {
        continue;
      }
      mappedObservations += 1;
      const existing = mappedByHandle.get(handleId) ?? {
        occurrences: 0,
        refs: new Set<string>(),
        origins: new Set<string>()
      };
      existing.occurrences += 1;
      existing.refs.add(loaded.row.ref_key);
      for (const origin of origins) {
        existing.origins.add(origin);
      }
      mappedByHandle.set(handleId, existing);
    }
  }

  const mappedRows: JoinPinnedProvenanceRow[] = Array.from(mappedByHandle.entries())
    .map(([handleId, entry]) => ({
      handleId,
      occurrences: entry.occurrences,
      refKeys: Array.from(entry.refs).sort((left, right) => left.localeCompare(right, "en")),
      origins: Array.from(entry.origins).sort((left, right) => left.localeCompare(right, "en"))
    }))
    .sort(compareJoinMapped);

  const loadedBySequence = new Map<number, LoadedJoinVerse>();
  for (const loaded of loadedVerses) {
    if (!loadedBySequence.has(loaded.row.sequence)) {
      loadedBySequence.set(loaded.row.sequence, loaded);
    }
  }

  const mismatchItems: JoinMismatchDrillDown[] = [];
  for (const mismatch of args.report.continuity.mismatches.all) {
    const prev = loadedBySequence.get(mismatch.prevSequence);
    const curr = loadedBySequence.get(mismatch.sequence);
    if (!prev || !curr || prev.loadError || curr.loadError) {
      continue;
    }

    const prevBoundary = prev.payload?.verseBoundary;
    const startNext = readBoundaryField(prevBoundary, "startNext", mismatch.field);
    const end = readBoundaryField(prevBoundary, "end", mismatch.field);
    const diagnosis: JoinMismatchDrillDown["diagnosis"] = !prevBoundary
      ? "missing_previous_boundary"
      : !startNext.exists
        ? "missing_boundary_start_next_field"
        : startNext.value === mismatch.observed
          ? "boundary_matches_observed"
          : startNext.value === mismatch.expected
            ? "boundary_matches_expected_only"
            : "boundary_disagrees";

    mismatchItems.push({
      prevSequence: mismatch.prevSequence,
      sequence: mismatch.sequence,
      prevRefKey: mismatch.prevRefKey,
      ref_key: mismatch.refKey,
      field: mismatch.field,
      summaryExpected: mismatch.expected,
      summaryObserved: mismatch.observed,
      boundaryStartNext: startNext.value,
      boundaryEnd: end.value,
      diagnosis
    });
  }

  const diagnosisCounts: Record<JoinMismatchDrillDown["diagnosis"], number> = {
    missing_previous_boundary: 0,
    missing_boundary_start_next_field: 0,
    boundary_matches_observed: 0,
    boundary_matches_expected_only: 0,
    boundary_disagrees: 0
  };
  for (const item of mismatchItems) {
    diagnosisCounts[item.diagnosis] += 1;
  }

  return {
    requested: true,
    available: loadedVerses.length > 0,
    join_limit: args.joinLimit,
    verses_considered: versesConsidered.length,
    verses_selected_for_join: args.joinPlan.verses_selected_for_join,
    verses_loaded: loadedVerses.filter((row) => row.loadError === null).length,
    verses_skipped_due_to_limit: args.joinPlan.verses_skipped_due_to_limit,
    mismatch_transition_coverage: args.joinPlan.mismatch_transition_coverage,
    load_errors: loadErrors,
    boundary_instrumentation: {
      present_count: boundaryPresentCount,
      missing_count: missingBoundary.length,
      coverage_rate:
        versesConsidered.length > 0 ? boundaryPresentCount / versesConsidered.length : null,
      missing: missingBoundary.slice(0, DEFAULT_JOIN_SAMPLE_LIMIT)
    },
    pinned_provenance: {
      provenance_available: provenanceAvailable,
      pinned_observations: pinnedObservations,
      mapped_observations: mappedObservations,
      unmapped_observations: Math.max(0, pinnedObservations - mappedObservations),
      mapped_handles: mappedRows.length,
      top_mapped_handles: mappedRows.slice(0, DEFAULT_JOIN_SAMPLE_LIMIT)
    },
    continuity_mismatch_drilldown: {
      mismatch_count: mismatchItems.length,
      diagnosis_counts: diagnosisCounts,
      items: mismatchItems
    }
  };
}

type VersePointer = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  resolvedOutputPath: string;
};

const INDEX_CATEGORY_ORDER = [
  "errors",
  "continuity",
  "cleanup",
  "stateShape",
  "carrySemantics"
] as const;

function toVerseKey(sequence: number, refKey: string): string {
  return `${sequence}::${refKey}`;
}

function buildVersePointerMaps(
  summary: Summary,
  workspaceRootResolved: string
): {
  byKey: Map<string, VersePointer>;
  bySequence: Map<number, VersePointer>;
} {
  const byKey = new Map<string, VersePointer>();
  const bySequence = new Map<number, VersePointer>();
  for (const row of summary.verses) {
    const pointer: VersePointer = {
      sequence: row.sequence,
      ref_key: row.ref_key,
      outputPath: row.outputPath,
      resolvedOutputPath: resolvePerVerseOutputPath(row.outputPath, workspaceRootResolved)
    };
    byKey.set(toVerseKey(row.sequence, row.ref_key), pointer);
    if (!bySequence.has(row.sequence)) {
      bySequence.set(row.sequence, pointer);
    }
  }
  return {
    byKey,
    bySequence
  };
}

function lookupVersePointer(
  maps: {
    byKey: Map<string, VersePointer>;
    bySequence: Map<number, VersePointer>;
  },
  sequence: number,
  refKey: string
): VersePointer {
  const exact = maps.byKey.get(toVerseKey(sequence, refKey));
  if (exact) {
    return exact;
  }
  const fallback = maps.bySequence.get(sequence);
  if (fallback) {
    return fallback;
  }
  return {
    sequence,
    ref_key: refKey,
    outputPath: "",
    resolvedOutputPath: ""
  };
}

function formatValue(value: number | string | null): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    const abs = Math.abs(value);
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) {
      return value.toExponential(3);
    }
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
  }
  return value;
}

function markdownEscapeCell(value: string): string {
  return String(value ?? "").replace(/\|/gu, "\\|");
}

function markdownOutlierTable(rows: readonly InsightsIndexRow[]): string[] {
  if (rows.length === 0) {
    return ["No rows."];
  }
  const lines = [
    "| sequence | ref_key | metric | value | outputPath |",
    "| ---: | --- | --- | --- | --- |"
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.sequence} | ${markdownEscapeCell(row.ref_key)} | ${markdownEscapeCell(
        row.metric
      )} | ${markdownEscapeCell(formatValue(row.value))} | ${markdownEscapeCell(row.outputPath)} |`
    );
  }
  return lines;
}

function buildInsightsIndex(args: {
  summary: Summary;
  report: InsightsReport;
  summaryPath: string;
  generatedAt: string;
  workspaceRoot: string;
  topN: number;
}): InsightsIndex {
  const workspaceRootResolved = args.workspaceRoot
    ? path.resolve(args.workspaceRoot)
    : process.cwd();
  const maps = buildVersePointerMaps(args.summary, workspaceRootResolved);

  const byCategory: Record<string, InsightsIndexRow[]> = {};
  for (const category of INDEX_CATEGORY_ORDER) {
    byCategory[category] = [];
  }

  const pushRow = (category: string, row: InsightsIndexRow): void => {
    const current = byCategory[category] ?? [];
    current.push(row);
    byCategory[category] = current;
  };

  for (const row of args.report.errors.errorVerses.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.sequence, row.ref_key);
    pushRow("errors", {
      category: "errors",
      metric: "runtimeError",
      sequence: row.sequence,
      ref_key: row.ref_key,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: row.runtimeError
    });
  }

  for (const row of args.report.continuity.mismatches.all.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.sequence, row.refKey);
    pushRow("continuity", {
      category: "continuity",
      metric: `mismatch:${row.field}`,
      sequence: row.sequence,
      ref_key: row.refKey,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: `${String(row.expected)} -> ${String(row.observed)}`,
      details: row.message
    });
  }

  for (const row of args.report.cleanup.outliers.topDroppedCount.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.sequence, row.ref_key);
    pushRow("cleanup", {
      category: "cleanup",
      metric: "droppedCount",
      sequence: row.sequence,
      ref_key: row.ref_key,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: row.value
    });
  }
  for (const row of args.report.cleanup.outliers.topDropRate.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.sequence, row.ref_key);
    pushRow("cleanup", {
      category: "cleanup",
      metric: "dropRate",
      sequence: row.sequence,
      ref_key: row.ref_key,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: row.value
    });
  }

  for (const row of args.report.stateShape.deltas.topAcrossMetrics.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.sequence, row.ref_key);
    pushRow("stateShape", {
      category: "stateShape",
      metric: `delta:${row.metric}`,
      sequence: row.sequence,
      ref_key: row.ref_key,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: row.delta,
      details: `absDelta=${formatValue(row.absDelta)}`
    });
  }

  for (const row of args.report.carrySemantics.rankings.longestFocusRuns.slice(0, args.topN)) {
    const pointer = lookupVersePointer(maps, row.startSeq, row.startRefKey);
    pushRow("carrySemantics", {
      category: "carrySemantics",
      metric: "longestFocusRun",
      sequence: row.startSeq,
      ref_key: row.startRefKey,
      outputPath: pointer.outputPath,
      resolvedOutputPath: pointer.resolvedOutputPath,
      value: row.length,
      details: `${row.startRefKey} -> ${row.endRefKey}`
    });
  }

  const anomalies = INDEX_CATEGORY_ORDER.flatMap((category) => byCategory[category] ?? []);
  return {
    schema_version: 1,
    generated_at: args.generatedAt,
    source_summary_path: workspaceRelativePath(path.resolve(args.summaryPath)),
    meta: {
      mode: args.summary.mode,
      from: args.summary.from,
      to: args.summary.to,
      versesSelected: args.summary.versesSelected
    },
    anomalies,
    byCategory,
    totalAnomalies: anomalies.length
  };
}

export function defaultOutDirForSummary(summaryPath: string): string {
  return path.join(path.dirname(path.resolve(summaryPath)), "insights");
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/summary-insights.mjs --summary=path/to/summary.json [--out-dir=path] [--format=json|md|both]"
  );
  console.log(
    "  node scripts/summary-insights.mjs [--top-n=25] [--include-joins] [--join-limit=250]"
  );
  console.log("  node scripts/summary-insights.mjs [--workspace-root=path]");
  console.log("");
  console.log("Defaults:");
  console.log("  --format=both");
  console.log(`  --top-n=${DEFAULT_TOP_N}`);
  console.log("  --include-joins=false");
  console.log(`  --join-limit=${DEFAULT_JOIN_LIMIT}`);
  console.log("  --out-dir=<summary_dir>/insights");
}

export function parseArgs(argv: string[]): SummaryInsightsOptions {
  const opts: SummaryInsightsOptions = {
    summary: "",
    outDir: "",
    format: DEFAULT_FORMAT,
    topN: DEFAULT_TOP_N,
    includeJoins: false,
    joinLimit: DEFAULT_JOIN_LIMIT,
    workspaceRoot: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const summaryOpt = readOptionValue(argv, index, "--summary");
    if (summaryOpt) {
      opts.summary = summaryOpt.value;
      index = summaryOpt.nextIndex;
      continue;
    }

    const outDirOpt = readOptionValue(argv, index, "--out-dir");
    if (outDirOpt) {
      opts.outDir = outDirOpt.value;
      index = outDirOpt.nextIndex;
      continue;
    }

    const formatOpt = readOptionValue(argv, index, "--format");
    if (formatOpt) {
      opts.format = parseInsightsFormat(formatOpt.value);
      index = formatOpt.nextIndex;
      continue;
    }

    const topNOpt = readOptionValue(argv, index, "--top-n");
    if (topNOpt) {
      opts.topN = parseTopN(topNOpt.value);
      index = topNOpt.nextIndex;
      continue;
    }

    const joinLimitOpt = readOptionValue(argv, index, "--join-limit");
    if (joinLimitOpt) {
      opts.joinLimit = parseJoinLimit(joinLimitOpt.value);
      index = joinLimitOpt.nextIndex;
      continue;
    }

    const workspaceRootOpt = readOptionValue(argv, index, "--workspace-root");
    if (workspaceRootOpt) {
      opts.workspaceRoot = workspaceRootOpt.value;
      index = workspaceRootOpt.nextIndex;
      continue;
    }

    if (arg === "--include-joins") {
      opts.includeJoins = true;
      continue;
    }
    if (arg === "--no-include-joins") {
      opts.includeJoins = false;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!opts.summary) {
    throw new Error("Missing required --summary option.");
  }
  if (!opts.outDir) {
    opts.outDir = defaultOutDirForSummary(opts.summary);
  }

  return opts;
}

export async function loadSummary(summaryPath: string): Promise<Summary> {
  return loadSummaryModel(summaryPath);
}

export function buildInsightsReport(args: {
  summary: Summary;
  summaryPath: string;
  format: InsightsFormat;
  topN: number;
  includeJoins: boolean;
  joinLimit: number;
  workspaceRoot: string;
}): InsightsReport {
  const workspaceRootResolved = args.workspaceRoot
    ? path.resolve(args.workspaceRoot)
    : process.cwd();
  const rows = args.summary.verses.map((row) => summarizeVerseRow(row, workspaceRootResolved));

  const byHandleCount = [...rows]
    .sort((left, right) => compareTop(left, right, "handles"))
    .slice(0, args.topN);
  const byDroppedCount = [...rows]
    .sort((left, right) => compareTop(left, right, "droppedCount"))
    .slice(0, args.topN);
  const byPinnedCount = [...rows]
    .sort((left, right) => compareTop(left, right, "pinnedCount"))
    .slice(0, args.topN);

  const continuity = extractContinuity(args.summary);
  const pinned = extractPinned(args.summary);
  const cleanup = extractCleanup(args.summary);
  const stateShape = extractStateShape(args.summary);
  const carrySemantics = extractCarrySemantics(args.summary);
  const errors = extractErrors(args.summary);
  const segmentation = extractSegmentation(args.summary);

  const report: InsightsReport = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_summary_path: workspaceRelativePath(path.resolve(args.summaryPath)),
    options: {
      format: args.format,
      top_n: args.topN,
      include_joins: args.includeJoins,
      join_limit: args.joinLimit,
      workspace_root: args.workspaceRoot ? workspaceRelativePath(workspaceRootResolved) : null
    },
    meta: {
      mode: args.summary.mode,
      from: args.summary.from,
      to: args.summary.to,
      versesSelected: args.summary.versesSelected,
      runtimeErrors: args.summary.runtimeErrors,
      expectedTransitions: args.summary.continuity.expectedTransitions
    },
    continuity,
    pinned,
    cleanup,
    stateShape,
    carrySemantics,
    errors,
    segmentation,
    overview: {
      mode: args.summary.mode,
      from: args.summary.from,
      to: args.summary.to,
      verses_selected: args.summary.versesSelected,
      runtime_errors: args.summary.runtimeErrors,
      expected_transitions: continuity.transitionCount,
      mismatch_counts: {
        omega: continuity.mismatches.counts.omega,
        focus: continuity.mismatches.counts.focus,
        domain: continuity.mismatches.counts.domain
      },
      non_increasing_handle_count: args.summary.sanity.nonIncreasingHandleCount
    },
    top: {
      by_handle_count: byHandleCount,
      by_dropped_count: byDroppedCount,
      by_pinned_count: byPinnedCount
    }
  };

  return report;
}

export function renderInsightsMarkdown(report: InsightsReport, index?: InsightsIndex): string {
  const lines: string[] = [];
  const indexRows = index?.byCategory ?? {};
  const cleanupTop = report.cleanup.outliers.topDroppedCount[0];
  const stateTop = report.stateShape.deltas.topAcrossMetrics[0];

  lines.push("# Continual Run Insights");
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(
    `- mode=${report.meta.mode}; range=${report.meta.from} -> ${report.meta.to}; verses=${report.meta.versesSelected}`
  );
  lines.push(
    `- runtimeErrors=${report.meta.runtimeErrors}; errorRate=${formatValue(report.errors.errorRate)}`
  );
  lines.push(
    `- continuity mismatches: omega=${report.continuity.mismatches.counts.omega}, focus=${report.continuity.mismatches.counts.focus}, domain=${report.continuity.mismatches.counts.domain}`
  );
  lines.push(
    `- cleanup: executedRate=${formatValue(report.cleanup.cleanupExecution.executedRate)}, meanDropRate=${formatValue(report.cleanup.dropRate.meanWhenExecuted)}`
  );
  if (cleanupTop) {
    lines.push(
      `- worst cleanup drop: ${cleanupTop.ref_key} (seq=${cleanupTop.sequence}, dropped=${formatValue(
        cleanupTop.value
      )})`
    );
  }
  if (stateTop) {
    lines.push(
      `- largest state delta: ${stateTop.ref_key} (seq=${stateTop.sequence}, metric=${stateTop.metric}, delta=${formatValue(
        stateTop.delta
      )})`
    );
  }
  lines.push("");
  lines.push("## meta");
  lines.push("");
  lines.push(`- generated_at: ${report.generated_at}`);
  lines.push(`- source_summary_path: ${report.source_summary_path}`);
  lines.push(`- mode: ${report.meta.mode}`);
  lines.push(`- from: ${report.meta.from}`);
  lines.push(`- to: ${report.meta.to}`);
  lines.push(`- versesSelected: ${report.meta.versesSelected}`);
  lines.push(`- runtimeErrors: ${report.meta.runtimeErrors}`);
  lines.push(`- expectedTransitions: ${report.meta.expectedTransitions}`);

  lines.push("");
  lines.push("## continuity");
  lines.push("");
  lines.push(
    `- match rates: omega=${formatValue(report.continuity.rates.omega.rate)}, focus=${formatValue(report.continuity.rates.focus.rate)}, domain=${formatValue(report.continuity.rates.domain.rate)}`
  );
  lines.push(`- mode compliance: compliant=${String(report.continuity.modeCompliance.compliant)}`);
  lines.push("");
  lines.push("### Top Continuity Outliers");
  lines.push("");
  lines.push(...markdownOutlierTable((indexRows.continuity ?? []).slice(0, report.options.top_n)));

  lines.push("");
  lines.push("## pinned");
  lines.push("");
  lines.push(
    `- pinnedCount mean=${formatValue(report.pinned.pinnedCount.describe.mean)}, max=${formatValue(report.pinned.pinnedCount.describe.max)}`
  );
  lines.push(`- accumulationRisk=${report.pinned.qualitySignals.accumulationRisk}`);
  lines.push(`- brittlenessRisk=${report.pinned.qualitySignals.brittlenessRisk}`);
  lines.push(
    `- immortal candidates=${report.pinned.longevity.immortals.handles.length} (thresholdPct=${report.pinned.longevity.immortals.thresholdPct})`
  );

  lines.push("");
  lines.push("## cleanup");
  lines.push("");
  lines.push(
    `- executed=${report.cleanup.cleanupExecution.executedCount}/${report.cleanup.verses}; skipped=${report.cleanup.cleanupExecution.skippedCount}`
  );
  lines.push(
    `- work=${report.cleanup.qualitySignals.cleanupWork}; leakRisk=${report.cleanup.qualitySignals.leakRisk}`
  );
  lines.push("");
  lines.push("### Top Cleanup Outliers");
  lines.push("");
  lines.push(...markdownOutlierTable((indexRows.cleanup ?? []).slice(0, report.options.top_n)));

  lines.push("");
  lines.push("## stateShape");
  lines.push("");
  lines.push(`- densitySignal=${report.stateShape.ratios.trend.densitySignal}`);
  lines.push(`- regimeChanges=${report.stateShape.regimeChange.events.length}`);
  lines.push("");
  lines.push("### Top StateShape Outliers");
  lines.push("");
  lines.push(...markdownOutlierTable((indexRows.stateShape ?? []).slice(0, report.options.top_n)));

  lines.push("");
  lines.push("## carrySemantics");
  lines.push("");
  lines.push(
    `- stickyFocus thresholdLength=${report.carrySemantics.stickyFocus.thresholdLength}; segments=${report.carrySemantics.stickyFocus.segments.length}`
  );
  lines.push(
    `- longest focus run length=${formatValue(report.carrySemantics.rankings.longestFocusRuns[0]?.length ?? null)}`
  );
  lines.push(
    `- longest domain run length=${formatValue(report.carrySemantics.rankings.longestDomainRuns[0]?.length ?? null)}`
  );
  lines.push("");
  lines.push("### Top CarrySemantics Outliers");
  lines.push("");
  lines.push(
    ...markdownOutlierTable((indexRows.carrySemantics ?? []).slice(0, report.options.top_n))
  );

  lines.push("");
  lines.push("## errors");
  lines.push("");
  lines.push(
    `- errorCount=${report.errors.errorCount}; errorRate=${formatValue(report.errors.errorRate)}`
  );
  lines.push(
    `- clusters=${report.errors.clustering.byMessagePrefix.length}; chaptersWithErrors=${report.errors.density.byBookChapter.filter((row) => row.errorCount > 0).length}`
  );
  lines.push("");
  lines.push("### Top Error Outliers");
  lines.push("");
  lines.push(...markdownOutlierTable((indexRows.errors ?? []).slice(0, report.options.top_n)));

  lines.push("");
  lines.push("## segmentation");
  lines.push("");
  lines.push(`- books tracked=${report.segmentation.perBook.length}`);
  lines.push(`- chapters tracked=${report.segmentation.perChapter.length}`);
  lines.push(
    `- chapter-boundary spike detected=${formatValue(report.segmentation.chapterTransitionChecks.spikeDetected ? 1 : report.segmentation.chapterTransitionChecks.spikeDetected === false ? 0 : null)}`
  );
  lines.push("");
  lines.push("| segment | errorRate | mismatchRate | growth |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const row of report.segmentation.perChapter.slice(0, Math.min(10, report.options.top_n))) {
    lines.push(
      `| ${markdownEscapeCell(row.key)} | ${markdownEscapeCell(
        formatValue(row.errorRate)
      )} | ${markdownEscapeCell(formatValue(row.mismatchTransitionRate))} | ${markdownEscapeCell(
        formatValue(row.handles.growth)
      )} |`
    );
  }

  const joinDetails = report.joinDetails ?? report.joins;
  if (joinDetails) {
    lines.push("");
    lines.push("## joinDetails");
    lines.push("");
    lines.push(`- available=${String(joinDetails.available)}`);
    lines.push(`- join_limit=${joinDetails.join_limit}`);
    lines.push(`- verses_considered=${joinDetails.verses_considered}`);
    lines.push(
      `- verses_selected_for_join=${joinDetails.verses_selected_for_join.join(", ") || "none"}`
    );
    lines.push(`- verses_loaded=${joinDetails.verses_loaded}`);
    lines.push(
      `- verses_skipped_due_to_limit=${joinDetails.verses_skipped_due_to_limit.count}; sample=[${joinDetails.verses_skipped_due_to_limit.sequences.join(", ")}]`
    );
    lines.push(
      `- mismatch transition coverage: full=${joinDetails.mismatch_transition_coverage.fully_covered_transitions}, partial=${joinDetails.mismatch_transition_coverage.partially_covered_transitions}, uncovered=${joinDetails.mismatch_transition_coverage.uncovered_transitions}`
    );
    lines.push(
      `- boundary coverage=${formatValue(joinDetails.boundary_instrumentation.coverage_rate)}`
    );
    lines.push(
      `- pinned mapped handles=${joinDetails.pinned_provenance.mapped_handles}, unmapped observations=${joinDetails.pinned_provenance.unmapped_observations}`
    );
    lines.push(
      `- continuity mismatch drilldown count=${joinDetails.continuity_mismatch_drilldown.mismatch_count}`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runSummaryInsights(opts: SummaryInsightsOptions): Promise<{
  insights: InsightsReport;
  index: InsightsIndex;
  outDir: string;
  jsonPath: string | null;
  markdownPath: string | null;
  indexPath: string;
}> {
  const summaryPath = path.resolve(opts.summary);
  const outDir = path.resolve(opts.outDir);
  const summary = loadSummaryModel(summaryPath);
  const insights = buildInsightsReport({
    summary,
    summaryPath,
    format: opts.format,
    topN: opts.topN,
    includeJoins: opts.includeJoins,
    joinLimit: opts.joinLimit,
    workspaceRoot: opts.workspaceRoot
  });

  if (opts.includeJoins) {
    const joinPlan = planJoinVerseSelection({
      summary,
      report: insights,
      topN: opts.topN,
      joinLimit: opts.joinLimit
    });
    const joinDetails = await buildJoinReport({
      summary,
      report: insights,
      workspaceRoot: opts.workspaceRoot,
      joinLimit: opts.joinLimit,
      joinPlan
    });
    insights.joins = joinDetails;
    insights.joinDetails = joinDetails;
  }

  const index = buildInsightsIndex({
    summary,
    report: insights,
    summaryPath,
    generatedAt: insights.generated_at,
    workspaceRoot: opts.workspaceRoot,
    topN: opts.topN
  });

  await fs.mkdir(outDir, { recursive: true });
  let jsonPath: string | null = null;
  let markdownPath: string | null = null;
  const indexPath = path.join(outDir, "index.json");

  if (opts.format === "json" || opts.format === "both") {
    jsonPath = path.join(outDir, "insights.json");
    await fs.writeFile(jsonPath, `${JSON.stringify(insights, null, 2)}\n`, "utf8");
  }
  if (opts.format === "md" || opts.format === "both") {
    markdownPath = path.join(outDir, "insights.md");
    await fs.writeFile(markdownPath, renderInsightsMarkdown(insights, index), "utf8");
  }
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  return {
    insights,
    index,
    outDir,
    jsonPath,
    markdownPath,
    indexPath
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const result = await runSummaryInsights(opts);
  const outputs = [result.jsonPath, result.markdownPath, result.indexPath]
    .filter((value): value is string => Boolean(value))
    .map((value) => workspaceRelativePath(value))
    .join(", ");

  console.log(
    [
      `summary-insights: outDir=${workspaceRelativePath(result.outDir)}`,
      `format=${opts.format}`,
      `outputs=[${outputs}]`
    ].join(" ")
  );
}
