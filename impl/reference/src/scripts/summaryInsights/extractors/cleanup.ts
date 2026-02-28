import type { Summary } from "../model";
import { deltas, describe, topN, type DescriptiveStats } from "../stats";

const DEFAULT_TOP_N = 25;
const WINDOW_SIZES = [5, 20];

export type CleanupVerseMetric = {
  sequence: number;
  ref_key: string;
  cleanupExecuted: boolean;
  keptCount: number | null;
  droppedCount: number | null;
  dropRate: number | null;
  stateHandles: number;
  keptHandleDelta: number | null;
};

export type WindowTrendCheck = {
  windowSize: number;
  startSequence: number;
  endSequence: number;
  startValue: number;
  endValue: number;
  delta: number;
  monotonicNonDecreasing: boolean;
  monotonicNonIncreasing: boolean;
  plateau: boolean;
};

export type CleanupInvariantMismatch = {
  sequence: number;
  ref_key: string;
  keptCount: number;
  stateHandles: number;
  delta: number;
};

export type CleanupOutlier = {
  metric: "droppedCount" | "keptCount" | "dropRate";
  value: number;
  sequence: number;
  ref_key: string;
  keptCount: number | null;
  droppedCount: number | null;
  dropRate: number | null;
  stateHandles: number;
  cleanupExecuted: boolean;
};

export type CleanupReport = {
  verses: number;
  perVerse: CleanupVerseMetric[];
  cleanupExecution: {
    executedCount: number;
    skippedCount: number;
    executedRate: number | null;
  };
  dropRate: {
    series: number[];
    describe: DescriptiveStats;
    nonZeroDrops: number;
    zeroDrops: number;
    meanWhenExecuted: number | null;
  };
  keptCount: {
    series: number[];
    describe: DescriptiveStats;
  };
  droppedCount: {
    series: number[];
    describe: DescriptiveStats;
  };
  trend: {
    keptCountWindows: WindowTrendCheck[];
    stateHandlesWindows: WindowTrendCheck[];
    dropRateWindows: WindowTrendCheck[];
    summary: {
      keptPlateauRate: number | null;
      stateHandlesPlateauRate: number | null;
      dropRatePlateauRate: number | null;
    };
  };
  invariants: {
    keptVsStateHandles: {
      checkedCount: number;
      matchingCount: number;
      mismatchCount: number;
      maxAbsDelta: number;
      mismatches: CleanupInvariantMismatch[];
    };
  };
  outliers: {
    topDroppedCount: CleanupOutlier[];
    topKeptCount: CleanupOutlier[];
    topDropRate: CleanupOutlier[];
  };
  qualitySignals: {
    cleanupWork: "active" | "minimal" | "inactive";
    leakRisk: "low" | "medium" | "high";
  };
};

function windowSizesForLength(length: number): number[] {
  if (length < 2) {
    return [];
  }
  const set = new Set<number>();
  for (const size of WINDOW_SIZES) {
    if (size >= 2 && size <= length) {
      set.add(size);
    }
  }
  if (set.size === 0) {
    set.add(length);
  }
  return Array.from(set).sort((left, right) => left - right);
}

function buildWindowTrendChecks(
  values: readonly number[],
  sequences: readonly number[],
  epsilon: number
): WindowTrendCheck[] {
  if (values.length !== sequences.length || values.length < 2) {
    return [];
  }

  const out: WindowTrendCheck[] = [];
  const sizes = windowSizesForLength(values.length);
  for (const windowSize of sizes) {
    for (let start = 0; start + windowSize <= values.length; start += 1) {
      const end = start + windowSize - 1;
      const windowValues = values.slice(start, end + 1);
      const windowDeltas = deltas(windowValues);
      const min = Math.min(...windowValues);
      const max = Math.max(...windowValues);
      out.push({
        windowSize,
        startSequence: sequences[start],
        endSequence: sequences[end],
        startValue: windowValues[0],
        endValue: windowValues[windowValues.length - 1],
        delta: windowValues[windowValues.length - 1] - windowValues[0],
        monotonicNonDecreasing: windowDeltas.every((value) => value >= -epsilon),
        monotonicNonIncreasing: windowDeltas.every((value) => value <= epsilon),
        plateau: max - min <= epsilon
      });
    }
  }

  return out;
}

function plateauRate(windows: readonly WindowTrendCheck[]): number | null {
  if (windows.length === 0) {
    return null;
  }
  const plateauCount = windows.filter((window) => window.plateau).length;
  return plateauCount / windows.length;
}

function chooseCleanupWork(
  executedCount: number,
  droppedDescribe: DescriptiveStats,
  dropRateDescribe: DescriptiveStats
): "active" | "minimal" | "inactive" {
  if (executedCount === 0) {
    return "inactive";
  }
  const meanDropped = droppedDescribe.mean ?? 0;
  const meanDropRate = dropRateDescribe.mean ?? 0;
  if (meanDropped <= 0 || meanDropRate <= 0) {
    return "inactive";
  }
  if (meanDropped < 1 || meanDropRate < 0.1) {
    return "minimal";
  }
  return "active";
}

function chooseLeakRisk(
  keptSeries: readonly number[],
  dropRateDescribe: DescriptiveStats,
  cleanupWork: "active" | "minimal" | "inactive"
): "low" | "medium" | "high" {
  if (keptSeries.length === 0) {
    return cleanupWork === "inactive" ? "high" : "medium";
  }
  const growth = keptSeries[keptSeries.length - 1] - keptSeries[0];
  const meanDropRate = dropRateDescribe.mean ?? 0;
  if (cleanupWork === "inactive") {
    return "high";
  }
  if (growth > 0 && meanDropRate < 0.1) {
    return "high";
  }
  if (growth > 0 && meanDropRate < 0.25) {
    return "medium";
  }
  return "low";
}

function toOutlier(
  metric: CleanupOutlier["metric"],
  row: CleanupVerseMetric,
  value: number
): CleanupOutlier {
  return {
    metric,
    value,
    sequence: row.sequence,
    ref_key: row.ref_key,
    keptCount: row.keptCount,
    droppedCount: row.droppedCount,
    dropRate: row.dropRate,
    stateHandles: row.stateHandles,
    cleanupExecuted: row.cleanupExecuted
  };
}

export function extractCleanup(summary: Summary): CleanupReport {
  const perVerse: CleanupVerseMetric[] = summary.verses.map((row) => {
    const keptCount = row.cleanup.keptCount;
    const droppedCount = row.cleanup.droppedCount;
    const cleanupExecuted = keptCount !== null && droppedCount !== null;
    const executedKept = keptCount ?? 0;
    const executedDropped = droppedCount ?? 0;
    const denominator = cleanupExecuted ? executedKept + executedDropped : null;
    const dropRate =
      denominator && denominator > 0 ? executedDropped / denominator : cleanupExecuted ? 0 : null;
    const keptHandleDelta = keptCount !== null ? keptCount - row.stateSize.handles : null;
    return {
      sequence: row.sequence,
      ref_key: row.ref_key,
      cleanupExecuted,
      keptCount,
      droppedCount,
      dropRate,
      stateHandles: row.stateSize.handles,
      keptHandleDelta
    };
  });

  const executedRows = perVerse.filter((row) => row.cleanupExecuted);
  const executedCount = executedRows.length;
  const skippedCount = perVerse.length - executedCount;
  const keptSeries = executedRows.map((row) => row.keptCount ?? 0);
  const droppedSeries = executedRows.map((row) => row.droppedCount ?? 0);
  const dropRateSeries = executedRows
    .map((row) => row.dropRate)
    .filter((value): value is number => value !== null);

  const invariantChecked = perVerse.filter((row) => row.keptCount !== null);
  const mismatches: CleanupInvariantMismatch[] = invariantChecked
    .filter((row) => row.keptHandleDelta !== 0)
    .map((row) => ({
      sequence: row.sequence,
      ref_key: row.ref_key,
      keptCount: row.keptCount ?? 0,
      stateHandles: row.stateHandles,
      delta: row.keptHandleDelta ?? 0
    }))
    .sort(
      (left, right) =>
        Math.abs(right.delta) - Math.abs(left.delta) ||
        left.sequence - right.sequence ||
        left.ref_key.localeCompare(right.ref_key, "en")
    );

  const droppedRankable = executedRows.map((row) => ({
    ...row,
    refKey: row.ref_key,
    metricValue: row.droppedCount ?? 0
  }));
  const keptRankable = executedRows.map((row) => ({
    ...row,
    refKey: row.ref_key,
    metricValue: row.keptCount ?? 0
  }));
  const dropRateRankable = executedRows.map((row) => ({
    ...row,
    refKey: row.ref_key,
    metricValue: row.dropRate ?? 0
  }));

  const topDroppedCount = topN(droppedRankable, DEFAULT_TOP_N, (row) => row.metricValue).map(
    (row) => toOutlier("droppedCount", row, row.metricValue)
  );
  const topKeptCount = topN(keptRankable, DEFAULT_TOP_N, (row) => row.metricValue).map((row) =>
    toOutlier("keptCount", row, row.metricValue)
  );
  const topDropRate = topN(dropRateRankable, DEFAULT_TOP_N, (row) => row.metricValue).map((row) =>
    toOutlier("dropRate", row, row.metricValue)
  );

  const keptTrend = buildWindowTrendChecks(
    keptSeries,
    executedRows.map((row) => row.sequence),
    0
  );
  const stateHandlesTrend = buildWindowTrendChecks(
    perVerse.map((row) => row.stateHandles),
    perVerse.map((row) => row.sequence),
    0
  );
  const dropRateTrend = buildWindowTrendChecks(
    dropRateSeries,
    executedRows.map((row) => row.sequence),
    1e-12
  );

  const dropRateDescribe = describe(dropRateSeries);
  const droppedDescribe = describe(droppedSeries);
  const cleanupWork = chooseCleanupWork(executedCount, droppedDescribe, dropRateDescribe);
  const leakRisk = chooseLeakRisk(keptSeries, dropRateDescribe, cleanupWork);

  return {
    verses: perVerse.length,
    perVerse,
    cleanupExecution: {
      executedCount,
      skippedCount,
      executedRate: perVerse.length > 0 ? executedCount / perVerse.length : null
    },
    dropRate: {
      series: dropRateSeries,
      describe: dropRateDescribe,
      nonZeroDrops: droppedSeries.filter((value) => value > 0).length,
      zeroDrops: droppedSeries.filter((value) => value === 0).length,
      meanWhenExecuted: dropRateDescribe.mean
    },
    keptCount: {
      series: keptSeries,
      describe: describe(keptSeries)
    },
    droppedCount: {
      series: droppedSeries,
      describe: droppedDescribe
    },
    trend: {
      keptCountWindows: keptTrend,
      stateHandlesWindows: stateHandlesTrend,
      dropRateWindows: dropRateTrend,
      summary: {
        keptPlateauRate: plateauRate(keptTrend),
        stateHandlesPlateauRate: plateauRate(stateHandlesTrend),
        dropRatePlateauRate: plateauRate(dropRateTrend)
      }
    },
    invariants: {
      keptVsStateHandles: {
        checkedCount: invariantChecked.length,
        matchingCount: invariantChecked.length - mismatches.length,
        mismatchCount: mismatches.length,
        maxAbsDelta: mismatches.reduce((max, row) => Math.max(max, Math.abs(row.delta)), 0),
        mismatches
      }
    },
    outliers: {
      topDroppedCount,
      topKeptCount,
      topDropRate
    },
    qualitySignals: {
      cleanupWork,
      leakRisk
    }
  };
}
