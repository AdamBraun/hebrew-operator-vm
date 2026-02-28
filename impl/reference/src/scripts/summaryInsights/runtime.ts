import fs from "node:fs/promises";
import path from "node:path";
import { workspaceRelativePath } from "../torahCorpus/report";

export type InsightsFormat = "json" | "md" | "both";

type OptionValue = {
  value: string;
  nextIndex: number;
};

type CarryIds = {
  omega: string | null;
  focus: string | null;
  domain: string | null;
  pinned: string[];
  pinnedCount: number;
};

type StateSize = {
  handles: number;
  links: number;
  boundaries: number;
  rules: number;
  cont: number;
  aliasEdges: number;
};

type SummaryVerseRow = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  carryIn: CarryIds;
  carryOut: CarryIds;
  stateSize: StateSize;
  cleanup: {
    keptCount: number | null;
    droppedCount: number | null;
  };
  runtimeError: string | null;
};

type SummaryContinuity = {
  expectedTransitions: number;
  omegaMatches: number;
  focusMatches: number;
  domainMatches: number;
  mismatches: {
    omega: string[];
    focus: string[];
    domain: string[];
  };
};

type SummarySanity = {
  handleCounts: number[];
  nonIncreasingHandleCount: boolean;
};

export type ContinualRunSummary = {
  mode: string;
  from: string;
  to: string;
  input: string;
  outDir: string;
  versesSelected: number;
  runtimeErrors: number;
  continuity: SummaryContinuity;
  sanity: SummarySanity;
  verses: SummaryVerseRow[];
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

export type InsightsReport = {
  schema_version: 1;
  generated_at: string;
  source_summary_path: string;
  source_summary_sha256?: string;
  options: {
    format: InsightsFormat;
    top_n: number;
    include_joins: boolean;
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
  joins?: {
    requested: true;
    available: false;
    note: string;
  };
};

export type SummaryInsightsOptions = {
  summary: string;
  outDir: string;
  format: InsightsFormat;
  topN: number;
  includeJoins: boolean;
  workspaceRoot: string;
};

const DEFAULT_TOP_N = 25;
const DEFAULT_FORMAT: InsightsFormat = "both";

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object");
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`expected string at '${field}'`);
  }
  return value;
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value, field);
}

function asNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`expected number at '${field}'`);
  }
  return parsed;
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asNumber(value, field);
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`expected boolean at '${field}'`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`expected string[] at '${field}'`);
  }
  return value.map((entry, index) => asString(entry, `${field}[${index}]`));
}

function parseCarryIds(value: unknown, field: string): CarryIds {
  const row = asObject(value);
  const pinned = Array.isArray(row.pinned)
    ? row.pinned.map((entry, index) => asString(entry, `${field}.pinned[${index}]`))
    : [];
  return {
    omega: asNullableString(row.omega, `${field}.omega`),
    focus: asNullableString(row.focus, `${field}.focus`),
    domain: asNullableString(row.domain, `${field}.domain`),
    pinned,
    pinnedCount: asNumber(row.pinnedCount ?? pinned.length, `${field}.pinnedCount`)
  };
}

function parseStateSize(value: unknown, field: string): StateSize {
  const row = asObject(value);
  return {
    handles: asNumber(row.handles, `${field}.handles`),
    links: asNumber(row.links, `${field}.links`),
    boundaries: asNumber(row.boundaries, `${field}.boundaries`),
    rules: asNumber(row.rules, `${field}.rules`),
    cont: asNumber(row.cont, `${field}.cont`),
    aliasEdges: asNumber(row.aliasEdges, `${field}.aliasEdges`)
  };
}

function parseSummaryVerseRow(value: unknown, index: number): SummaryVerseRow {
  const row = asObject(value);
  const cleanup = asObject(row.cleanup);
  return {
    sequence: asNumber(row.sequence ?? index + 1, `verses[${index}].sequence`),
    ref_key: asString(row.ref_key, `verses[${index}].ref_key`),
    outputPath: asString(row.outputPath ?? "", `verses[${index}].outputPath`),
    carryIn: parseCarryIds(row.carryIn ?? {}, `verses[${index}].carryIn`),
    carryOut: parseCarryIds(row.carryOut ?? {}, `verses[${index}].carryOut`),
    stateSize: parseStateSize(row.stateSize ?? {}, `verses[${index}].stateSize`),
    cleanup: {
      keptCount: asNullableNumber(cleanup.keptCount, `verses[${index}].cleanup.keptCount`),
      droppedCount: asNullableNumber(cleanup.droppedCount, `verses[${index}].cleanup.droppedCount`)
    },
    runtimeError: asNullableString(row.runtimeError, `verses[${index}].runtimeError`)
  };
}

function parseSummaryContinuity(value: unknown): SummaryContinuity {
  const row = asObject(value);
  const mismatches = asObject(row.mismatches);
  return {
    expectedTransitions: asNumber(row.expectedTransitions ?? 0, "continuity.expectedTransitions"),
    omegaMatches: asNumber(row.omegaMatches ?? 0, "continuity.omegaMatches"),
    focusMatches: asNumber(row.focusMatches ?? 0, "continuity.focusMatches"),
    domainMatches: asNumber(row.domainMatches ?? 0, "continuity.domainMatches"),
    mismatches: {
      omega: asStringArray(mismatches.omega ?? [], "continuity.mismatches.omega"),
      focus: asStringArray(mismatches.focus ?? [], "continuity.mismatches.focus"),
      domain: asStringArray(mismatches.domain ?? [], "continuity.mismatches.domain")
    }
  };
}

function parseSummarySanity(value: unknown): SummarySanity {
  const row = asObject(value);
  const handleCounts = Array.isArray(row.handleCounts)
    ? row.handleCounts.map((entry, index) => asNumber(entry, `sanity.handleCounts[${index}]`))
    : [];
  return {
    handleCounts,
    nonIncreasingHandleCount: asBoolean(
      row.nonIncreasingHandleCount ?? false,
      "sanity.nonIncreasingHandleCount"
    )
  };
}

function parseSummaryObject(value: unknown): ContinualRunSummary {
  const root = asObject(value);
  if (!Array.isArray(root.verses)) {
    throw new Error("expected 'verses' array");
  }
  return {
    mode: asString(root.mode ?? "", "mode"),
    from: asString(root.from ?? "", "from"),
    to: asString(root.to ?? "", "to"),
    input: asString(root.input ?? "", "input"),
    outDir: asString(root.outDir ?? "", "outDir"),
    versesSelected: asNumber(root.versesSelected ?? root.verses.length, "versesSelected"),
    runtimeErrors: asNumber(root.runtimeErrors ?? 0, "runtimeErrors"),
    continuity: parseSummaryContinuity(root.continuity ?? {}),
    sanity: parseSummarySanity(root.sanity ?? {}),
    verses: root.verses.map((row, index) => parseSummaryVerseRow(row, index))
  };
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

function compareTop(
  left: ResolvedTopVerse,
  right: ResolvedTopVerse,
  metric: keyof ResolvedTopVerse
): number {
  const leftMetric = Number(left[metric] ?? 0);
  const rightMetric = Number(right[metric] ?? 0);
  if (leftMetric !== rightMetric) {
    return rightMetric - leftMetric;
  }
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  return left.ref_key.localeCompare(right.ref_key, "en");
}

function summarizeVerseRow(row: SummaryVerseRow, workspaceRoot: string): ResolvedTopVerse {
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

export function defaultOutDirForSummary(summaryPath: string): string {
  return path.join(path.dirname(path.resolve(summaryPath)), "insights");
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/summary-insights.mjs --summary=path/to/summary.json [--out-dir=path] [--format=json|md|both]"
  );
  console.log("  node scripts/summary-insights.mjs [--top-n=25] [--include-joins]");
  console.log("  node scripts/summary-insights.mjs [--workspace-root=path]");
  console.log("");
  console.log("Defaults:");
  console.log("  --format=both");
  console.log(`  --top-n=${DEFAULT_TOP_N}`);
  console.log("  --include-joins=false");
  console.log("  --out-dir=<summary_dir>/insights");
}

export function parseArgs(argv: string[]): SummaryInsightsOptions {
  const opts: SummaryInsightsOptions = {
    summary: "",
    outDir: "",
    format: DEFAULT_FORMAT,
    topN: DEFAULT_TOP_N,
    includeJoins: false,
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

export async function loadSummary(summaryPath: string): Promise<ContinualRunSummary> {
  const resolved = path.resolve(summaryPath);
  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing summary file: ${resolved}`);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid summary JSON at ${resolved}: ${message}`);
  }

  try {
    return parseSummaryObject(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid summary.json at ${resolved}: ${message}`);
  }
}

export function buildInsightsReport(args: {
  summary: ContinualRunSummary;
  summaryPath: string;
  format: InsightsFormat;
  topN: number;
  includeJoins: boolean;
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

  if (args.includeJoins) {
    report.joins = {
      requested: true,
      available: false,
      note: "Join metrics are not currently emitted in summary.json; no join insights were computed."
    };
  }

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
    lines.push(`- note: ${report.joins.note}`);
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
  const summary = await loadSummary(summaryPath);
  const insights = buildInsightsReport({
    summary,
    summaryPath,
    format: opts.format,
    topN: opts.topN,
    includeJoins: opts.includeJoins,
    workspaceRoot: opts.workspaceRoot
  });

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
