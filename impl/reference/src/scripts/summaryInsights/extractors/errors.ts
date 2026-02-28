import { describe, groupBy, topN, type DescriptiveStats } from "../stats";
import { parseRefKey, type Summary } from "../model";

const DEFAULT_TOP_N = 25;
const MESSAGE_PREFIX_TOKENS = 8;

type StateMetricName =
  | "handles"
  | "links"
  | "boundaries"
  | "rules"
  | "cont"
  | "aliasEdges"
  | "pinnedCountStart"
  | "pinnedCountEnd";

export type ErrorVerse = {
  sequence: number;
  ref_key: string;
  runtimeError: string;
  normalizedMessage: string;
  messagePrefix: string;
};

export type ErrorCluster = {
  messagePrefix: string;
  normalizedMessageSample: string;
  count: number;
  sequences: number[];
  refs: string[];
  sampleMessages: string[];
};

export type ErrorDensityRow = {
  key: string;
  book: string;
  chapter: number;
  verseCount: number;
  errorCount: number;
  errorRate: number;
};

export type ErrorMetricComparison = {
  errorDescribe: DescriptiveStats;
  nonErrorDescribe: DescriptiveStats;
  meanDelta: number | null;
  meanRatio: number | null;
};

export type ErrorMetricOutlier = {
  metric: StateMetricName;
  sequence: number;
  ref_key: string;
  value: number;
  nonErrorMean: number | null;
  deltaFromNonErrorMean: number | null;
  zScore: number | null;
};

export type ErrorsReport = {
  verses: number;
  errorCount: number;
  errorRate: number | null;
  errorVerses: ErrorVerse[];
  clustering: {
    byMessagePrefix: ErrorCluster[];
  };
  density: {
    byBookChapter: ErrorDensityRow[];
  };
  preErrorSignature: {
    metricComparisons: Record<StateMetricName, ErrorMetricComparison>;
    outlierErrorVerses: Record<StateMetricName, ErrorMetricOutlier[]>;
    topAcrossMetrics: ErrorMetricOutlier[];
  };
};

type ErrorAugmentedVerse = {
  sequence: number;
  ref_key: string;
  runtimeError: string;
  normalizedMessage: string;
  messagePrefix: string;
  book: string;
  chapter: number;
  metrics: Record<StateMetricName, number>;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function normalizeErrorMessage(message: string): string {
  return String(message ?? "")
    .toLowerCase()
    .replace(/0x[0-9a-f]+/gu, "0x#")
    .replace(/\b[a-f0-9]{10,}\b/gu, "#")
    .replace(/\b([a-z_]+)\d+\b/gu, "$1#")
    .replace(/\b\d+\b/gu, "#")
    .replace(/["'`]+/gu, "")
    .replace(/[^a-z0-9#\s:_./-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function prefixBucket(normalized: string): string {
  const tokens = normalized.split(/\s+/u).filter(Boolean);
  return tokens.slice(0, MESSAGE_PREFIX_TOKENS).join(" ");
}

function errorVerse(summary: Summary, index: number): ErrorAugmentedVerse | null {
  const row = summary.verses[index];
  if (!row || row.runtimeError === null) {
    return null;
  }
  const normalizedMessage = normalizeErrorMessage(row.runtimeError);
  const messagePrefix = prefixBucket(normalizedMessage);
  let book = "unknown";
  let chapter = 0;
  try {
    const parsed = parseRefKey(row.ref_key);
    book = parsed.book;
    chapter = parsed.chapter;
  } catch {
    book = "unknown";
    chapter = 0;
  }

  return {
    sequence: row.sequence,
    ref_key: row.ref_key,
    runtimeError: row.runtimeError,
    normalizedMessage,
    messagePrefix,
    book,
    chapter,
    metrics: {
      handles: row.stateSize.handles,
      links: row.stateSize.links,
      boundaries: row.stateSize.boundaries,
      rules: row.stateSize.rules,
      cont: row.stateSize.cont,
      aliasEdges: row.stateSize.aliasEdges,
      pinnedCountStart: row.carryIn.pinnedCount,
      pinnedCountEnd: row.carryOut.pinnedCount
    }
  };
}

function metricSeries(verses: readonly ErrorAugmentedVerse[], metric: StateMetricName): number[] {
  return verses.map((row) => row.metrics[metric]);
}

function meanDeltaAndRatio(
  errorDescribe: DescriptiveStats,
  nonErrorDescribe: DescriptiveStats
): {
  meanDelta: number | null;
  meanRatio: number | null;
} {
  const errorMean = errorDescribe.mean;
  const nonErrorMean = nonErrorDescribe.mean;
  const meanDelta = errorMean !== null && nonErrorMean !== null ? errorMean - nonErrorMean : null;
  const meanRatio =
    errorMean !== null && nonErrorMean !== null && nonErrorMean !== 0
      ? errorMean / nonErrorMean
      : null;
  return {
    meanDelta,
    meanRatio
  };
}

function compareDensity(left: ErrorDensityRow, right: ErrorDensityRow): number {
  if (left.book !== right.book) {
    return compareText(left.book, right.book);
  }
  if (left.chapter !== right.chapter) {
    return left.chapter - right.chapter;
  }
  return compareText(left.key, right.key);
}

export function extractErrors(summary: Summary): ErrorsReport {
  const errors: ErrorAugmentedVerse[] = summary.verses
    .map((_, index) => errorVerse(summary, index))
    .filter((value): value is ErrorAugmentedVerse => value !== null)
    .sort(
      (left, right) => left.sequence - right.sequence || compareText(left.ref_key, right.ref_key)
    );

  const errorVerseRows: ErrorVerse[] = errors.map((row) => ({
    sequence: row.sequence,
    ref_key: row.ref_key,
    runtimeError: row.runtimeError,
    normalizedMessage: row.normalizedMessage,
    messagePrefix: row.messagePrefix
  }));

  const errorCount = errors.length;
  const totalVerses = summary.verses.length;
  const errorRate = totalVerses > 0 ? errorCount / totalVerses : null;

  const clustered = groupBy(errors, (row) => row.messagePrefix);
  const byMessagePrefix: ErrorCluster[] = Array.from(clustered.entries())
    .map(([prefix, rows]) => {
      const sampleMessages = Array.from(new Set(rows.map((row) => row.runtimeError))).slice(0, 3);
      return {
        messagePrefix: prefix,
        normalizedMessageSample: rows[0]?.normalizedMessage ?? "",
        count: rows.length,
        sequences: rows.map((row) => row.sequence).sort((left, right) => left - right),
        refs: rows.map((row) => row.ref_key).sort((left, right) => compareText(left, right)),
        sampleMessages
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count || compareText(left.messagePrefix, right.messagePrefix)
    );

  const byBookChapterGroup = groupBy(summary.verses, (row) => {
    try {
      const parsed = parseRefKey(row.ref_key);
      return `${parsed.book}/${parsed.chapter}`;
    } catch {
      return "unknown/0";
    }
  });
  const byBookChapter: ErrorDensityRow[] = Array.from(byBookChapterGroup.entries())
    .map(([key, rows]) => {
      let book = "unknown";
      let chapter = 0;
      try {
        const parsed = parseRefKey(rows[0]?.ref_key ?? key);
        book = parsed.book;
        chapter = parsed.chapter;
      } catch {
        book = "unknown";
        chapter = 0;
      }
      const errorRows = rows.filter((row) => row.runtimeError !== null);
      return {
        key,
        book,
        chapter,
        verseCount: rows.length,
        errorCount: errorRows.length,
        errorRate: rows.length > 0 ? errorRows.length / rows.length : 0
      };
    })
    .sort(compareDensity);

  const nonErrorRows: ErrorAugmentedVerse[] = summary.verses
    .filter((row) => row.runtimeError === null)
    .map((row) => {
      let book = "unknown";
      let chapter = 0;
      try {
        const parsed = parseRefKey(row.ref_key);
        book = parsed.book;
        chapter = parsed.chapter;
      } catch {
        book = "unknown";
        chapter = 0;
      }
      return {
        sequence: row.sequence,
        ref_key: row.ref_key,
        runtimeError: "",
        normalizedMessage: "",
        messagePrefix: "",
        book,
        chapter,
        metrics: {
          handles: row.stateSize.handles,
          links: row.stateSize.links,
          boundaries: row.stateSize.boundaries,
          rules: row.stateSize.rules,
          cont: row.stateSize.cont,
          aliasEdges: row.stateSize.aliasEdges,
          pinnedCountStart: row.carryIn.pinnedCount,
          pinnedCountEnd: row.carryOut.pinnedCount
        }
      };
    });

  const metrics = [
    "handles",
    "links",
    "boundaries",
    "rules",
    "cont",
    "aliasEdges",
    "pinnedCountStart",
    "pinnedCountEnd"
  ] as const;

  const metricComparisons = Object.fromEntries(
    metrics.map((metric) => {
      const errorDescribe = describe(metricSeries(errors, metric));
      const nonErrorDescribe = describe(metricSeries(nonErrorRows, metric));
      const deltaRatio = meanDeltaAndRatio(errorDescribe, nonErrorDescribe);
      return [
        metric,
        {
          errorDescribe,
          nonErrorDescribe,
          meanDelta: deltaRatio.meanDelta,
          meanRatio: deltaRatio.meanRatio
        }
      ];
    })
  ) as ErrorsReport["preErrorSignature"]["metricComparisons"];

  const outlierErrorVerses = Object.fromEntries(
    metrics.map((metric) => {
      const nonErrorStats = metricComparisons[metric].nonErrorDescribe;
      const nonErrorMean = nonErrorStats.mean;
      const nonErrorStdev = nonErrorStats.stdev;
      const enriched = errors.map((row) => {
        const value = row.metrics[metric];
        const delta = nonErrorMean !== null ? value - nonErrorMean : null;
        const zScore =
          delta !== null && nonErrorStdev !== null && nonErrorStdev > 0
            ? delta / nonErrorStdev
            : null;
        return {
          metric,
          sequence: row.sequence,
          ref_key: row.ref_key,
          value,
          nonErrorMean,
          deltaFromNonErrorMean: delta,
          zScore,
          score: zScore !== null ? Math.abs(zScore) : Math.abs(delta ?? 0)
        };
      });
      const top = topN(
        enriched.map((row) => ({ ...row, refKey: row.ref_key })),
        DEFAULT_TOP_N,
        (row) => row.score
      ).map(({ refKey: _refKey, score: _score, ...row }) => row);
      return [metric, top];
    })
  ) as ErrorsReport["preErrorSignature"]["outlierErrorVerses"];

  const topAcrossMetrics = topN(
    metrics
      .flatMap((metric) => outlierErrorVerses[metric])
      .map((row) => ({
        ...row,
        refKey: row.ref_key,
        score: Math.abs(row.zScore ?? row.deltaFromNonErrorMean ?? 0)
      })),
    DEFAULT_TOP_N,
    (row) => row.score
  ).map(({ refKey: _refKey, score: _score, ...row }) => row);

  return {
    verses: totalVerses,
    errorCount,
    errorRate,
    errorVerses: errorVerseRows,
    clustering: {
      byMessagePrefix
    },
    density: {
      byBookChapter
    },
    preErrorSignature: {
      metricComparisons,
      outlierErrorVerses,
      topAcrossMetrics
    }
  };
}
