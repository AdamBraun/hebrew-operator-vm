import fs from "node:fs/promises";
import path from "node:path";
import { workspaceRelativePath } from "../torahCorpus/report";
import { loadSummary as loadSummaryModel, type Summary, type VerseRow } from "./model";
import {
  loadPerVersePayload,
  resolvePerVerseOutputPath,
  type PerVerseJoinPayload
} from "./joiners/perVerse";

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

type JoinReport = {
  requested: true;
  available: boolean;
  join_limit: number;
  verses_considered: number;
  verses_loaded: number;
  verses_skipped_due_to_limit: number;
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

async function buildJoinReport(args: {
  summary: Summary;
  workspaceRoot: string;
  joinLimit: number;
}): Promise<JoinReport> {
  const workspaceRootResolved = args.workspaceRoot
    ? path.resolve(args.workspaceRoot)
    : process.cwd();
  const versesConsidered = args.summary.verses.slice(0, args.joinLimit);
  const versesSkipped = Math.max(0, args.summary.verses.length - versesConsidered.length);

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

  const mismatchItems: JoinMismatchDrillDown[] = [];
  for (let index = 1; index < loadedVerses.length; index += 1) {
    const prev = loadedVerses[index - 1];
    const curr = loadedVerses[index];
    const fields: CarryField[] = ["omega", "focus", "domain"];
    for (const field of fields) {
      const expected = prev.row.carryOut[field];
      const observed = curr.row.carryIn[field];
      if (expected === observed) {
        continue;
      }
      const prevBoundary = prev.payload?.verseBoundary;
      const startNext = readBoundaryField(prevBoundary, "startNext", field);
      const end = readBoundaryField(prevBoundary, "end", field);
      const diagnosis: JoinMismatchDrillDown["diagnosis"] = !prevBoundary
        ? "missing_previous_boundary"
        : !startNext.exists
          ? "missing_boundary_start_next_field"
          : startNext.value === observed
            ? "boundary_matches_observed"
            : startNext.value === expected
              ? "boundary_matches_expected_only"
              : "boundary_disagrees";

      mismatchItems.push({
        prevSequence: prev.row.sequence,
        sequence: curr.row.sequence,
        prevRefKey: prev.row.ref_key,
        ref_key: curr.row.ref_key,
        field,
        summaryExpected: expected,
        summaryObserved: observed,
        boundaryStartNext: startNext.value,
        boundaryEnd: end.value,
        diagnosis
      });
    }
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
    verses_loaded: loadedVerses.filter((row) => row.loadError === null).length,
    verses_skipped_due_to_limit: versesSkipped,
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
    overview: {
      mode: args.summary.mode,
      from: args.summary.from,
      to: args.summary.to,
      verses_selected: args.summary.versesSelected,
      runtime_errors: args.summary.runtimeErrors,
      expected_transitions: args.summary.continuity.expectedTransitions,
      mismatch_counts: {
        omega: args.summary.continuity.mismatches.omega.length,
        focus: args.summary.continuity.mismatches.focus.length,
        domain: args.summary.continuity.mismatches.domain.length
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

function rowLine(row: ResolvedTopVerse): string {
  return `${row.sequence}. ${row.ref_key} (handles=${row.handles}, dropped=${row.droppedCount}, pinned=${row.pinnedCount})`;
}

export function renderInsightsMarkdown(report: InsightsReport): string {
  const lines: string[] = [];
  lines.push("# Continual Run Insights");
  lines.push("");
  lines.push(`- generated_at: ${report.generated_at}`);
  lines.push(`- source_summary_path: ${report.source_summary_path}`);
  lines.push(`- mode: ${report.overview.mode}`);
  lines.push(`- range: ${report.overview.from} -> ${report.overview.to}`);
  lines.push(`- verses_selected: ${report.overview.verses_selected}`);
  lines.push(`- runtime_errors: ${report.overview.runtime_errors}`);
  lines.push(
    `- mismatch_counts: omega=${report.overview.mismatch_counts.omega}, focus=${report.overview.mismatch_counts.focus}, domain=${report.overview.mismatch_counts.domain}`
  );
  lines.push(
    `- non_increasing_handle_count: ${String(report.overview.non_increasing_handle_count)}`
  );
  lines.push("");
  lines.push("## Top By Handle Count");
  lines.push("");
  if (report.top.by_handle_count.length === 0) {
    lines.push("- none");
  } else {
    for (const row of report.top.by_handle_count) {
      lines.push(`- ${rowLine(row)}`);
    }
  }
  lines.push("");
  lines.push("## Top By Dropped Count");
  lines.push("");
  if (report.top.by_dropped_count.length === 0) {
    lines.push("- none");
  } else {
    for (const row of report.top.by_dropped_count) {
      lines.push(`- ${rowLine(row)}`);
    }
  }
  lines.push("");
  lines.push("## Top By Pinned Count");
  lines.push("");
  if (report.top.by_pinned_count.length === 0) {
    lines.push("- none");
  } else {
    for (const row of report.top.by_pinned_count) {
      lines.push(`- ${rowLine(row)}`);
    }
  }
  if (report.joins) {
    lines.push("");
    lines.push("## Joins");
    lines.push("");
    lines.push(`- requested: ${String(report.joins.requested)}`);
    lines.push(`- available: ${String(report.joins.available)}`);
    lines.push(`- join_limit: ${report.joins.join_limit}`);
    lines.push(`- verses_considered: ${report.joins.verses_considered}`);
    lines.push(`- verses_loaded: ${report.joins.verses_loaded}`);
    lines.push(`- boundary_present: ${report.joins.boundary_instrumentation.present_count}`);
    lines.push(`- boundary_missing: ${report.joins.boundary_instrumentation.missing_count}`);
    lines.push(
      `- mismatches_drilldown: ${report.joins.continuity_mismatch_drilldown.mismatch_count}`
    );
    lines.push(`- pinned_mapped_handles: ${report.joins.pinned_provenance.mapped_handles}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runSummaryInsights(opts: SummaryInsightsOptions): Promise<{
  insights: InsightsReport;
  outDir: string;
  jsonPath: string | null;
  markdownPath: string | null;
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
    insights.joins = await buildJoinReport({
      summary,
      workspaceRoot: opts.workspaceRoot,
      joinLimit: opts.joinLimit
    });
  }

  await fs.mkdir(outDir, { recursive: true });
  let jsonPath: string | null = null;
  let markdownPath: string | null = null;

  if (opts.format === "json" || opts.format === "both") {
    jsonPath = path.join(outDir, "insights.json");
    await fs.writeFile(jsonPath, `${JSON.stringify(insights, null, 2)}\n`, "utf8");
  }
  if (opts.format === "md" || opts.format === "both") {
    markdownPath = path.join(outDir, "insights.md");
    await fs.writeFile(markdownPath, renderInsightsMarkdown(insights), "utf8");
  }

  return {
    insights,
    outDir,
    jsonPath,
    markdownPath
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const result = await runSummaryInsights(opts);
  const outputs = [result.jsonPath, result.markdownPath]
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
