import fs from "node:fs/promises";
import path from "node:path";
import { type NiqqudClass } from "./classes";

export type NiqqudWarningType = "MALFORMED_MARKS" | "UNHANDLED_MARK" | "AMBIGUOUS_COMBO";

export type NiqqudWarning = {
  gid: string;
  ref_key: string;
  g_index: number;
  type: NiqqudWarningType;
  detail: string;
};

export type NiqqudStats = {
  totalGraphemes: number;
  graphemesWithNiqqud: number;
  perClassFrequency: Partial<Record<NiqqudClass, number>>;
  unhandledFrequency: Record<string, number>;
  ambiguityCount: number;
  warningCount: number;
  warningTypeFrequency: Record<NiqqudWarningType, number>;
};

export type NiqqudStatsAccumulator = {
  stats: NiqqudStats;
  warnings: NiqqudWarning[];
};

export type RecordNiqqudRowArgs = {
  gid: string;
  ref_key: string;
  g_index: number;
  rawNiqqud: string[];
  classes: readonly NiqqudClass[];
  unhandled: readonly string[];
  ambiguous: boolean;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function incrementCount(counter: Record<string, number>, key: string, by = 1): void {
  counter[key] = (counter[key] ?? 0) + by;
}

export function createNiqqudStats(): NiqqudStats {
  return {
    totalGraphemes: 0,
    graphemesWithNiqqud: 0,
    perClassFrequency: {},
    unhandledFrequency: {},
    ambiguityCount: 0,
    warningCount: 0,
    warningTypeFrequency: {
      MALFORMED_MARKS: 0,
      UNHANDLED_MARK: 0,
      AMBIGUOUS_COMBO: 0
    }
  };
}

export function createNiqqudStatsAccumulator(): NiqqudStatsAccumulator {
  return {
    stats: createNiqqudStats(),
    warnings: []
  };
}

export function createNiqqudWarning(args: {
  gid: string;
  ref_key: string;
  g_index: number;
  type: NiqqudWarningType;
  detail: string;
}): NiqqudWarning {
  return {
    gid: args.gid,
    ref_key: args.ref_key,
    g_index: args.g_index,
    type: args.type,
    detail: args.detail
  };
}

export function recordNiqqudWarning(
  accumulator: NiqqudStatsAccumulator,
  warning: NiqqudWarning
): void {
  accumulator.warnings.push(warning);
  accumulator.stats.warningCount += 1;
  accumulator.stats.warningTypeFrequency[warning.type] += 1;
}

export function recordNiqqudRow(
  accumulator: NiqqudStatsAccumulator,
  args: RecordNiqqudRowArgs
): void {
  accumulator.stats.totalGraphemes += 1;
  if (args.rawNiqqud.length > 0) {
    accumulator.stats.graphemesWithNiqqud += 1;
  }

  for (const klass of args.classes) {
    incrementCount(accumulator.stats.perClassFrequency as Record<string, number>, klass);
  }

  for (const mark of args.unhandled) {
    incrementCount(accumulator.stats.unhandledFrequency, mark);
    recordNiqqudWarning(
      accumulator,
      createNiqqudWarning({
        gid: args.gid,
        ref_key: args.ref_key,
        g_index: args.g_index,
        type: "UNHANDLED_MARK",
        detail: `unhandled_mark=${JSON.stringify(mark)}`
      })
    );
  }

  if (args.ambiguous) {
    accumulator.stats.ambiguityCount += 1;
    recordNiqqudWarning(
      accumulator,
      createNiqqudWarning({
        gid: args.gid,
        ref_key: args.ref_key,
        g_index: args.g_index,
        type: "AMBIGUOUS_COMBO",
        detail: `classes=${JSON.stringify(args.classes)}`
      })
    );
  }
}

function sortedCounts(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(input).sort(compareText)) {
    out[key] = input[key] ?? 0;
  }
  return out;
}

export function normalizeNiqqudStats(stats: NiqqudStats): NiqqudStats {
  return {
    totalGraphemes: stats.totalGraphemes,
    graphemesWithNiqqud: stats.graphemesWithNiqqud,
    perClassFrequency: sortedCounts(stats.perClassFrequency as Record<string, number>),
    unhandledFrequency: sortedCounts(stats.unhandledFrequency),
    ambiguityCount: stats.ambiguityCount,
    warningCount: stats.warningCount,
    warningTypeFrequency: {
      MALFORMED_MARKS: stats.warningTypeFrequency.MALFORMED_MARKS,
      UNHANDLED_MARK: stats.warningTypeFrequency.UNHANDLED_MARK,
      AMBIGUOUS_COMBO: stats.warningTypeFrequency.AMBIGUOUS_COMBO
    }
  };
}

export function formatNiqqudWarningsJsonl(warnings: readonly NiqqudWarning[]): string {
  if (warnings.length === 0) {
    return "";
  }
  const lines = warnings.map((warning) =>
    JSON.stringify({
      gid: warning.gid,
      ref_key: warning.ref_key,
      g_index: warning.g_index,
      type: warning.type,
      detail: warning.detail
    })
  );
  return `${lines.join("\n")}\n`;
}

export async function writeNiqqudWarningsJsonl(
  outputDir: string,
  warnings: readonly NiqqudWarning[]
): Promise<string> {
  const outputPath = path.join(outputDir, "warnings.jsonl");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, formatNiqqudWarningsJsonl(warnings), "utf8");
  return outputPath;
}

export async function writeNiqqudStatsJson(outputDir: string, stats: NiqqudStats): Promise<string> {
  const outputPath = path.join(outputDir, "niqqud.stats.json");
  await fs.mkdir(outputDir, { recursive: true });
  const normalized = normalizeNiqqudStats(stats);
  await fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function writeNiqqudQualityArtifacts(args: {
  outputDir: string;
  stats: NiqqudStats;
  warnings: readonly NiqqudWarning[];
  writeWarningsJsonl?: boolean;
}): Promise<{ statsPath: string; warningsPath?: string }> {
  const statsPath = await writeNiqqudStatsJson(args.outputDir, args.stats);
  if (args.writeWarningsJsonl === false) {
    return { statsPath };
  }
  const warningsPath = await writeNiqqudWarningsJsonl(args.outputDir, args.warnings);
  return { statsPath, warningsPath };
}
