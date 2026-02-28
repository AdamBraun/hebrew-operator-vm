import fs from "node:fs/promises";
import path from "node:path";
import { workspaceRelativePath } from "../torahCorpus/report";
import { loadSummary, type Summary } from "../summaryInsights/model";
import { buildInsightsReport, type InsightsReport } from "../summaryInsights/runtime";

export type CompareFormat = "json" | "md" | "both";

type OptionValue = {
  value: string;
  nextIndex: number;
};

type RunRow = {
  id: string;
  label: string;
  summaryPath: string;
  mode: string;
  from: string;
  to: string;
  versesSelected: number;
  runtimeErrors: number;
  errorRate: number | null;
  continuity: {
    transitionCount: number;
    mismatchCount: number;
    mismatchRate: number | null;
    omegaMismatchRate: number | null;
    focusMismatchRate: number | null;
    domainMismatchRate: number | null;
  };
  pinnedCount: {
    mean: number | null;
    median: number | null;
    p90: number | null;
    max: number | null;
    histogram: Record<string, number>;
  };
  plateau: {
    stateHandlesPlateauRate: number | null;
    dropRatePlateauRate: number | null;
    linksPerHandleMean: number | null;
    linksPerHandleP90: number | null;
  };
};

type DeltaRow = {
  id: string;
  label: string;
  summaryPath: string;
  mode: string;
  errorRateDelta: number | null;
  mismatchRateDelta: number | null;
  mismatchCountDelta: number;
  pinnedMeanDelta: number | null;
  pinnedP90Delta: number | null;
  stateHandlesPlateauRateDelta: number | null;
  linksPerHandleMeanDelta: number | null;
  linksPerHandleP90Delta: number | null;
};

type ErrorRateChangeRow = {
  id: string;
  label: string;
  mode: string;
  summaryPath: string;
  versesSelected: number;
  runtimeErrors: number;
  errorRate: number | null;
  errorRateDelta: number | null;
};

type PinnedDistributionChangeRow = {
  id: string;
  label: string;
  mode: string;
  summaryPath: string;
  pinnedMean: number | null;
  pinnedP90: number | null;
  pinnedMax: number | null;
  pinnedMeanDelta: number | null;
  pinnedP90Delta: number | null;
  histogram: Record<string, number>;
  histogramDelta: Record<string, number>;
};

type PlateauLevelChangeRow = {
  id: string;
  label: string;
  mode: string;
  summaryPath: string;
  stateHandlesPlateauRate: number | null;
  stateHandlesPlateauRateDelta: number | null;
  linksPerHandleMean: number | null;
  linksPerHandleMeanDelta: number | null;
  linksPerHandleP90: number | null;
  linksPerHandleP90Delta: number | null;
};

type ContinuityMismatchChangeRow = {
  id: string;
  label: string;
  mode: string;
  summaryPath: string;
  transitionCount: number;
  mismatchCount: number;
  mismatchRate: number | null;
  mismatchRateDelta: number | null;
  omegaMismatchRate: number | null;
  focusMismatchRate: number | null;
  domainMismatchRate: number | null;
};

export type CompareReport = {
  schema_version: 1;
  generated_at: string;
  input: {
    summary_count: number;
    summary_paths: string[];
  };
  baseline: {
    id: string;
    label: string;
    summaryPath: string;
    mode: string;
  };
  runs: RunRow[];
  deltasFromBaseline: DeltaRow[];
  tables: {
    errorRateChange: ErrorRateChangeRow[];
    pinnedCountDistributionChange: PinnedDistributionChangeRow[];
    plateauLevelChange: PlateauLevelChangeRow[];
    continuityMismatchChange: ContinuityMismatchChangeRow[];
  };
};

export type SummaryCompareOptions = {
  summaries: string[];
  summaryDir: string;
  outDir: string;
  format: CompareFormat;
  workspaceRoot: string;
};

const DEFAULT_FORMAT: CompareFormat = "both";

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

function parseCompareFormat(rawValue: string): CompareFormat {
  const format = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  if (format === "json" || format === "md" || format === "both") {
    return format;
  }
  throw new Error(`Invalid --format value: ${rawValue}. Expected one of: json, md, both`);
}

function splitSummaryList(rawValue: string): string[] {
  return String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareNumberDesc(left: number | null, right: number | null): number {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  if (leftValue === rightValue) {
    return 0;
  }
  return rightValue - leftValue;
}

function deltaNumber(value: number | null, baseline: number | null): number | null {
  return value !== null && baseline !== null ? value - baseline : null;
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "null";
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
}

function markdownCell(value: string): string {
  return String(value ?? "").replace(/\|/gu, "\\|");
}

function defaultOutDir(options: { summaryDir: string; summaries: string[] }): string {
  if (options.summaryDir) {
    return path.join(path.resolve(options.summaryDir), "compare");
  }
  const first = options.summaries[0];
  if (!first) {
    return path.resolve("outputs", "summary-compare");
  }
  return path.join(path.dirname(path.resolve(first)), "compare");
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/summary-compare.mjs --summaries=path1,path2[,path3] [--out-dir=path] [--format=json|md|both]"
  );
  console.log(
    "  node scripts/summary-compare.mjs --summary-dir=path/to/runs [--out-dir=path] [--format=json|md|both]"
  );
  console.log("  node scripts/summary-compare.mjs [--workspace-root=path]");
  console.log("");
  console.log("Defaults:");
  console.log("  --format=both");
  console.log("  --out-dir=<summary-dir>/compare (or sibling compare folder for first summary)");
}

export function parseArgs(argv: string[]): SummaryCompareOptions {
  const opts: SummaryCompareOptions = {
    summaries: [],
    summaryDir: "",
    outDir: "",
    format: DEFAULT_FORMAT,
    workspaceRoot: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const summariesOpt = readOptionValue(argv, index, "--summaries");
    if (summariesOpt) {
      opts.summaries.push(...splitSummaryList(summariesOpt.value));
      index = summariesOpt.nextIndex;
      continue;
    }

    const summaryDirOpt = readOptionValue(argv, index, "--summary-dir");
    if (summaryDirOpt) {
      opts.summaryDir = summaryDirOpt.value;
      index = summaryDirOpt.nextIndex;
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
      opts.format = parseCompareFormat(formatOpt.value);
      index = formatOpt.nextIndex;
      continue;
    }

    const workspaceRootOpt = readOptionValue(argv, index, "--workspace-root");
    if (workspaceRootOpt) {
      opts.workspaceRoot = workspaceRootOpt.value;
      index = workspaceRootOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!opts.summaryDir && opts.summaries.length === 0) {
    throw new Error("Provide --summaries=... or --summary-dir=...");
  }
  if (!opts.outDir) {
    opts.outDir = defaultOutDir({
      summaryDir: opts.summaryDir,
      summaries: opts.summaries
    });
  }

  return opts;
}

async function collectSummaryPathsFromDir(dirPath: string): Promise<string[]> {
  const resolvedDir = path.resolve(dirPath);
  const out: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name === "summary.json") {
        out.push(path.resolve(entryPath));
      }
    }
  }

  await walk(resolvedDir);
  return out;
}

async function resolveSummaryPaths(opts: SummaryCompareOptions): Promise<string[]> {
  const ordered: string[] = [];
  for (const summaryPath of opts.summaries) {
    ordered.push(path.resolve(summaryPath));
  }
  if (opts.summaryDir) {
    ordered.push(...(await collectSummaryPathsFromDir(opts.summaryDir)));
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const resolved of ordered) {
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    unique.push(resolved);
  }
  if (unique.length === 0) {
    throw new Error("No summary.json files found.");
  }
  return unique;
}

function runLabel(summaryPath: string, summary: Summary): string {
  const parent = path.basename(path.dirname(summaryPath));
  return `${parent}:${summary.mode}`;
}

function runRow(args: {
  index: number;
  summaryPath: string;
  summary: Summary;
  report: InsightsReport;
}): RunRow {
  const mismatchCount = args.report.continuity.mismatches.counts.total;
  const transitionCount = args.report.continuity.transitionCount;
  return {
    id: `run${args.index + 1}`,
    label: runLabel(args.summaryPath, args.summary),
    summaryPath: workspaceRelativePath(args.summaryPath),
    mode: args.summary.mode,
    from: args.summary.from,
    to: args.summary.to,
    versesSelected: args.summary.versesSelected,
    runtimeErrors: args.summary.runtimeErrors,
    errorRate: args.report.errors.errorRate,
    continuity: {
      transitionCount,
      mismatchCount,
      mismatchRate: transitionCount > 0 ? mismatchCount / transitionCount : null,
      omegaMismatchRate: args.report.continuity.rates.omega.mismatches,
      focusMismatchRate: args.report.continuity.rates.focus.mismatches,
      domainMismatchRate: args.report.continuity.rates.domain.mismatches
    },
    pinnedCount: {
      mean: args.report.pinned.pinnedCount.describe.mean,
      median: args.report.pinned.pinnedCount.describe.median,
      p90: args.report.pinned.pinnedCount.describe.p90,
      max: args.report.pinned.pinnedCount.describe.max,
      histogram: args.report.pinned.pinnedCount.histogram
    },
    plateau: {
      stateHandlesPlateauRate: args.report.cleanup.trend.summary.stateHandlesPlateauRate,
      dropRatePlateauRate: args.report.cleanup.trend.summary.dropRatePlateauRate,
      linksPerHandleMean: args.report.stateShape.ratios.describe.linksPerHandle.mean,
      linksPerHandleP90: args.report.stateShape.ratios.describe.linksPerHandle.p90
    }
  };
}

function compareDeltaRows(left: DeltaRow, right: DeltaRow): number {
  const byError = compareNumberDesc(left.errorRateDelta, right.errorRateDelta);
  if (byError !== 0) {
    return byError;
  }
  const byMismatch = compareNumberDesc(left.mismatchRateDelta, right.mismatchRateDelta);
  if (byMismatch !== 0) {
    return byMismatch;
  }
  return compareText(left.label, right.label);
}

function compareErrorRateRow(left: ErrorRateChangeRow, right: ErrorRateChangeRow): number {
  const byRate = compareNumberDesc(left.errorRate, right.errorRate);
  if (byRate !== 0) {
    return byRate;
  }
  const byDelta = compareNumberDesc(left.errorRateDelta, right.errorRateDelta);
  if (byDelta !== 0) {
    return byDelta;
  }
  return compareText(left.label, right.label);
}

function comparePinnedRow(
  left: PinnedDistributionChangeRow,
  right: PinnedDistributionChangeRow
): number {
  const byMean = compareNumberDesc(left.pinnedMean, right.pinnedMean);
  if (byMean !== 0) {
    return byMean;
  }
  const byDelta = compareNumberDesc(left.pinnedMeanDelta, right.pinnedMeanDelta);
  if (byDelta !== 0) {
    return byDelta;
  }
  return compareText(left.label, right.label);
}

function comparePlateauRow(left: PlateauLevelChangeRow, right: PlateauLevelChangeRow): number {
  const byPlateau = compareNumberDesc(left.stateHandlesPlateauRate, right.stateHandlesPlateauRate);
  if (byPlateau !== 0) {
    return byPlateau;
  }
  const byLinks = compareNumberDesc(left.linksPerHandleMean, right.linksPerHandleMean);
  if (byLinks !== 0) {
    return byLinks;
  }
  return compareText(left.label, right.label);
}

function compareContinuityRow(
  left: ContinuityMismatchChangeRow,
  right: ContinuityMismatchChangeRow
): number {
  const byMismatchRate = compareNumberDesc(left.mismatchRate, right.mismatchRate);
  if (byMismatchRate !== 0) {
    return byMismatchRate;
  }
  const byCount = right.mismatchCount - left.mismatchCount;
  if (byCount !== 0) {
    return byCount;
  }
  return compareText(left.label, right.label);
}

function buildCompareReport(args: { summaryPaths: string[]; rows: RunRow[] }): CompareReport {
  const generatedAt = new Date().toISOString();
  const baseline = args.rows[0];
  if (!baseline) {
    throw new Error("Cannot build compare report with zero runs.");
  }

  const deltas: DeltaRow[] = args.rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      summaryPath: row.summaryPath,
      mode: row.mode,
      errorRateDelta: deltaNumber(row.errorRate, baseline.errorRate),
      mismatchRateDelta: deltaNumber(row.continuity.mismatchRate, baseline.continuity.mismatchRate),
      mismatchCountDelta: row.continuity.mismatchCount - baseline.continuity.mismatchCount,
      pinnedMeanDelta: deltaNumber(row.pinnedCount.mean, baseline.pinnedCount.mean),
      pinnedP90Delta: deltaNumber(row.pinnedCount.p90, baseline.pinnedCount.p90),
      stateHandlesPlateauRateDelta: deltaNumber(
        row.plateau.stateHandlesPlateauRate,
        baseline.plateau.stateHandlesPlateauRate
      ),
      linksPerHandleMeanDelta: deltaNumber(
        row.plateau.linksPerHandleMean,
        baseline.plateau.linksPerHandleMean
      ),
      linksPerHandleP90Delta: deltaNumber(
        row.plateau.linksPerHandleP90,
        baseline.plateau.linksPerHandleP90
      )
    }))
    .sort(compareDeltaRows);

  const errorRateChange: ErrorRateChangeRow[] = args.rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      mode: row.mode,
      summaryPath: row.summaryPath,
      versesSelected: row.versesSelected,
      runtimeErrors: row.runtimeErrors,
      errorRate: row.errorRate,
      errorRateDelta: deltaNumber(row.errorRate, baseline.errorRate)
    }))
    .sort(compareErrorRateRow);

  const pinnedCountDistributionChange: PinnedDistributionChangeRow[] = args.rows
    .map((row) => {
      const histogramDelta: Record<string, number> = {};
      const baselineHistogram = baseline.pinnedCount.histogram;
      for (const key of Object.keys(row.pinnedCount.histogram).sort(compareText)) {
        histogramDelta[key] = row.pinnedCount.histogram[key] - (baselineHistogram[key] ?? 0);
      }
      return {
        id: row.id,
        label: row.label,
        mode: row.mode,
        summaryPath: row.summaryPath,
        pinnedMean: row.pinnedCount.mean,
        pinnedP90: row.pinnedCount.p90,
        pinnedMax: row.pinnedCount.max,
        pinnedMeanDelta: deltaNumber(row.pinnedCount.mean, baseline.pinnedCount.mean),
        pinnedP90Delta: deltaNumber(row.pinnedCount.p90, baseline.pinnedCount.p90),
        histogram: row.pinnedCount.histogram,
        histogramDelta
      };
    })
    .sort(comparePinnedRow);

  const plateauLevelChange: PlateauLevelChangeRow[] = args.rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      mode: row.mode,
      summaryPath: row.summaryPath,
      stateHandlesPlateauRate: row.plateau.stateHandlesPlateauRate,
      stateHandlesPlateauRateDelta: deltaNumber(
        row.plateau.stateHandlesPlateauRate,
        baseline.plateau.stateHandlesPlateauRate
      ),
      linksPerHandleMean: row.plateau.linksPerHandleMean,
      linksPerHandleMeanDelta: deltaNumber(
        row.plateau.linksPerHandleMean,
        baseline.plateau.linksPerHandleMean
      ),
      linksPerHandleP90: row.plateau.linksPerHandleP90,
      linksPerHandleP90Delta: deltaNumber(
        row.plateau.linksPerHandleP90,
        baseline.plateau.linksPerHandleP90
      )
    }))
    .sort(comparePlateauRow);

  const continuityMismatchChange: ContinuityMismatchChangeRow[] = args.rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      mode: row.mode,
      summaryPath: row.summaryPath,
      transitionCount: row.continuity.transitionCount,
      mismatchCount: row.continuity.mismatchCount,
      mismatchRate: row.continuity.mismatchRate,
      mismatchRateDelta: deltaNumber(row.continuity.mismatchRate, baseline.continuity.mismatchRate),
      omegaMismatchRate:
        row.continuity.transitionCount > 0 && row.continuity.omegaMismatchRate !== null
          ? row.continuity.omegaMismatchRate / row.continuity.transitionCount
          : null,
      focusMismatchRate:
        row.continuity.transitionCount > 0 && row.continuity.focusMismatchRate !== null
          ? row.continuity.focusMismatchRate / row.continuity.transitionCount
          : null,
      domainMismatchRate:
        row.continuity.transitionCount > 0 && row.continuity.domainMismatchRate !== null
          ? row.continuity.domainMismatchRate / row.continuity.transitionCount
          : null
    }))
    .sort(compareContinuityRow);

  return {
    schema_version: 1,
    generated_at: generatedAt,
    input: {
      summary_count: args.rows.length,
      summary_paths: args.summaryPaths.map((entry) => workspaceRelativePath(entry))
    },
    baseline: {
      id: baseline.id,
      label: baseline.label,
      summaryPath: baseline.summaryPath,
      mode: baseline.mode
    },
    runs: args.rows,
    deltasFromBaseline: deltas,
    tables: {
      errorRateChange,
      pinnedCountDistributionChange,
      plateauLevelChange,
      continuityMismatchChange
    }
  };
}

function markdownTable(headers: string[], rows: string[][]): string[] {
  const out: string[] = [];
  out.push(`| ${headers.join(" | ")} |`);
  out.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    out.push(`| ${row.map((value) => markdownCell(value)).join(" | ")} |`);
  }
  return out;
}

export function renderCompareMarkdown(report: CompareReport): string {
  const lines: string[] = [];
  lines.push("# Summary Compare Report");
  lines.push("");
  lines.push("## Meta");
  lines.push("");
  lines.push(`- generated_at: ${report.generated_at}`);
  lines.push(`- summaries: ${report.input.summary_count}`);
  lines.push(`- baseline: ${report.baseline.label}`);
  lines.push("");

  lines.push("## Error Rate Change");
  lines.push("");
  lines.push(
    ...markdownTable(
      ["run", "mode", "verses", "runtimeErrors", "errorRate", "deltaFromBaseline"],
      report.tables.errorRateChange.map((row) => [
        row.label,
        row.mode,
        String(row.versesSelected),
        String(row.runtimeErrors),
        formatNumber(row.errorRate),
        formatNumber(row.errorRateDelta)
      ])
    )
  );
  lines.push("");

  lines.push("## PinnedCount Distribution Change");
  lines.push("");
  lines.push(
    ...markdownTable(
      ["run", "mode", "mean", "p90", "max", "meanDelta", "p90Delta"],
      report.tables.pinnedCountDistributionChange.map((row) => [
        row.label,
        row.mode,
        formatNumber(row.pinnedMean),
        formatNumber(row.pinnedP90),
        formatNumber(row.pinnedMax),
        formatNumber(row.pinnedMeanDelta),
        formatNumber(row.pinnedP90Delta)
      ])
    )
  );
  lines.push("");

  lines.push("## Plateau Level Change (Handles/Links Ratios)");
  lines.push("");
  lines.push(
    ...markdownTable(
      [
        "run",
        "mode",
        "stateHandlesPlateauRate",
        "deltaPlateau",
        "linksPerHandleMean",
        "deltaLinksMean",
        "linksPerHandleP90",
        "deltaLinksP90"
      ],
      report.tables.plateauLevelChange.map((row) => [
        row.label,
        row.mode,
        formatNumber(row.stateHandlesPlateauRate),
        formatNumber(row.stateHandlesPlateauRateDelta),
        formatNumber(row.linksPerHandleMean),
        formatNumber(row.linksPerHandleMeanDelta),
        formatNumber(row.linksPerHandleP90),
        formatNumber(row.linksPerHandleP90Delta)
      ])
    )
  );
  lines.push("");

  lines.push("## Continuity Mismatch Change");
  lines.push("");
  lines.push(
    ...markdownTable(
      [
        "run",
        "mode",
        "transitions",
        "mismatchCount",
        "mismatchRate",
        "deltaMismatchRate",
        "omegaRate",
        "focusRate",
        "domainRate"
      ],
      report.tables.continuityMismatchChange.map((row) => [
        row.label,
        row.mode,
        String(row.transitionCount),
        String(row.mismatchCount),
        formatNumber(row.mismatchRate),
        formatNumber(row.mismatchRateDelta),
        formatNumber(row.omegaMismatchRate),
        formatNumber(row.focusMismatchRate),
        formatNumber(row.domainMismatchRate)
      ])
    )
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function runSummaryCompare(opts: SummaryCompareOptions): Promise<{
  report: CompareReport;
  outDir: string;
  jsonPath: string | null;
  markdownPath: string | null;
}> {
  const summaryPaths = await resolveSummaryPaths(opts);
  const workspaceRootResolved = opts.workspaceRoot
    ? path.resolve(opts.workspaceRoot)
    : process.cwd();

  const rows: RunRow[] = [];
  for (let index = 0; index < summaryPaths.length; index += 1) {
    const summaryPath = summaryPaths[index];
    const summary = loadSummary(summaryPath);
    const insights = buildInsightsReport({
      summary,
      summaryPath,
      format: "json",
      topN: 25,
      includeJoins: false,
      joinLimit: 1,
      workspaceRoot: workspaceRootResolved
    });
    rows.push(
      runRow({
        index,
        summaryPath,
        summary,
        report: insights
      })
    );
  }

  const report = buildCompareReport({
    summaryPaths,
    rows
  });

  const outDir = path.resolve(opts.outDir);
  await fs.mkdir(outDir, { recursive: true });

  let jsonPath: string | null = null;
  let markdownPath: string | null = null;
  if (opts.format === "json" || opts.format === "both") {
    jsonPath = path.join(outDir, "compare.json");
    await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (opts.format === "md" || opts.format === "both") {
    markdownPath = path.join(outDir, "compare.md");
    await fs.writeFile(markdownPath, renderCompareMarkdown(report), "utf8");
  }

  return {
    report,
    outDir,
    jsonPath,
    markdownPath
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const result = await runSummaryCompare(opts);
  const outputs = [result.jsonPath, result.markdownPath]
    .filter((value): value is string => Boolean(value))
    .map((value) => workspaceRelativePath(value))
    .join(", ");
  console.log(
    [
      `summary-compare: outDir=${workspaceRelativePath(result.outDir)}`,
      `format=${opts.format}`,
      `outputs=[${outputs}]`
    ].join(" ")
  );
}
