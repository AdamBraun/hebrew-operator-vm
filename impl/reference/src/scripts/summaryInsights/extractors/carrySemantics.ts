import type { Summary } from "../model";
import { describe, runLengths, topN, type DescriptiveStats } from "../stats";

const DEFAULT_TOP_N = 25;

type CarryField = "omega" | "focus" | "domain";
type CarryPhase = "carryIn" | "carryOut";

export type CarryRunRow = {
  id: string | null;
  phase: CarryPhase;
  field: CarryField;
  startSeq: number;
  endSeq: number;
  startRefKey: string;
  endRefKey: string;
  length: number;
  avgPinnedCount: number;
  avgHandles: number;
  errorCount: number;
  errorRate: number | null;
};

export type ErrorMeanComparison = {
  errorMean: number | null;
  nonErrorMean: number | null;
  delta: number | null;
  ratio: number | null;
};

export type CarrySemanticsReport = {
  verses: number;
  runs: {
    startOfVerse: Record<
      CarryField,
      {
        table: CarryRunRow[];
        runLengthDescribe: DescriptiveStats;
        longest: CarryRunRow[];
      }
    >;
    endOfVerse: Record<
      CarryField,
      {
        table: CarryRunRow[];
        runLengthDescribe: DescriptiveStats;
        longest: CarryRunRow[];
      }
    >;
  };
  stickyFocus: {
    thresholdLength: number;
    segments: CarryRunRow[];
    coupling: {
      avgPinnedCountDescribe: DescriptiveStats;
      avgHandlesDescribe: DescriptiveStats;
      errorRateDescribe: DescriptiveStats;
    };
  };
  rankings: {
    longestFocusRuns: CarryRunRow[];
    longestDomainRuns: CarryRunRow[];
  };
  errorCorrelation: {
    counts: {
      errorVerses: number;
      nonErrorVerses: number;
    };
    means: {
      handles: ErrorMeanComparison;
      aliasEdges: ErrorMeanComparison;
      pinnedCountStart: ErrorMeanComparison;
      pinnedCountEnd: ErrorMeanComparison;
    };
  };
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compareMeans(
  errorValues: readonly number[],
  nonErrorValues: readonly number[]
): ErrorMeanComparison {
  const errorMean = errorValues.length > 0 ? mean(errorValues) : null;
  const nonErrorMean = nonErrorValues.length > 0 ? mean(nonErrorValues) : null;
  const delta = errorMean !== null && nonErrorMean !== null ? errorMean - nonErrorMean : null;
  const ratio =
    errorMean !== null && nonErrorMean !== null && nonErrorMean !== 0
      ? errorMean / nonErrorMean
      : null;
  return {
    errorMean,
    nonErrorMean,
    delta,
    ratio
  };
}

function runRowsFor(summary: Summary, phase: CarryPhase, field: CarryField): CarryRunRow[] {
  const ids = summary.verses.map((row) => row[phase][field]);
  const baseRuns = runLengths(ids);
  const rows: CarryRunRow[] = [];

  for (const run of baseRuns) {
    const startIndex = run.startSeq - 1;
    const endIndex = run.endSeq - 1;
    const verseSlice = summary.verses.slice(startIndex, endIndex + 1);
    const startVerse = summary.verses[startIndex];
    const endVerse = summary.verses[endIndex];
    if (!startVerse || !endVerse) {
      continue;
    }
    const avgPinnedCount = mean(verseSlice.map((row) => row[phase].pinnedCount));
    const avgHandles = mean(verseSlice.map((row) => row.stateSize.handles));
    const errorCount = verseSlice.filter((row) => row.runtimeError !== null).length;

    rows.push({
      id: run.id,
      phase,
      field,
      startSeq: startVerse.sequence,
      endSeq: endVerse.sequence,
      startRefKey: startVerse.ref_key,
      endRefKey: endVerse.ref_key,
      length: run.length,
      avgPinnedCount,
      avgHandles,
      errorCount,
      errorRate: run.length > 0 ? errorCount / run.length : null
    });
  }

  rows.sort(
    (left, right) =>
      left.startSeq - right.startSeq ||
      left.endSeq - right.endSeq ||
      compareText(String(left.id), String(right.id))
  );
  return rows;
}

function runBundle(summary: Summary, phase: CarryPhase, field: CarryField) {
  const table = runRowsFor(summary, phase, field);
  const longest = topN(
    table.map((row) => ({ ...row, sequence: row.startSeq, ref_key: row.startRefKey })),
    DEFAULT_TOP_N,
    (row) => row.length
  );
  return {
    table,
    runLengthDescribe: describe(table.map((row) => row.length)),
    longest
  };
}

function stickyFocusFromStartRuns(startFocusRuns: CarryRunRow[]): {
  thresholdLength: number;
  segments: CarryRunRow[];
  coupling: {
    avgPinnedCountDescribe: DescriptiveStats;
    avgHandlesDescribe: DescriptiveStats;
    errorRateDescribe: DescriptiveStats;
  };
} {
  const lengthDescribe = describe(startFocusRuns.map((row) => row.length));
  const thresholdLength = Math.max(3, Math.ceil(lengthDescribe.p90 ?? 0));
  const segments = startFocusRuns.filter((row) => row.length >= thresholdLength);
  return {
    thresholdLength,
    segments,
    coupling: {
      avgPinnedCountDescribe: describe(segments.map((row) => row.avgPinnedCount)),
      avgHandlesDescribe: describe(segments.map((row) => row.avgHandles)),
      errorRateDescribe: describe(segments.map((row) => row.errorRate ?? 0))
    }
  };
}

export function extractCarrySemantics(summary: Summary): CarrySemanticsReport {
  const startOmega = runBundle(summary, "carryIn", "omega");
  const startFocus = runBundle(summary, "carryIn", "focus");
  const startDomain = runBundle(summary, "carryIn", "domain");
  const endOmega = runBundle(summary, "carryOut", "omega");
  const endFocus = runBundle(summary, "carryOut", "focus");
  const endDomain = runBundle(summary, "carryOut", "domain");

  const stickyFocus = stickyFocusFromStartRuns(startFocus.table);
  const longestFocusRuns = topN(
    startFocus.table.map((row) => ({ ...row, sequence: row.startSeq, ref_key: row.startRefKey })),
    DEFAULT_TOP_N,
    (row) => row.length
  );
  const longestDomainRuns = topN(
    startDomain.table.map((row) => ({ ...row, sequence: row.startSeq, ref_key: row.startRefKey })),
    DEFAULT_TOP_N,
    (row) => row.length
  );

  const errorVerses = summary.verses.filter((row) => row.runtimeError !== null);
  const nonErrorVerses = summary.verses.filter((row) => row.runtimeError === null);

  return {
    verses: summary.verses.length,
    runs: {
      startOfVerse: {
        omega: startOmega,
        focus: startFocus,
        domain: startDomain
      },
      endOfVerse: {
        omega: endOmega,
        focus: endFocus,
        domain: endDomain
      }
    },
    stickyFocus,
    rankings: {
      longestFocusRuns,
      longestDomainRuns
    },
    errorCorrelation: {
      counts: {
        errorVerses: errorVerses.length,
        nonErrorVerses: nonErrorVerses.length
      },
      means: {
        handles: compareMeans(
          errorVerses.map((row) => row.stateSize.handles),
          nonErrorVerses.map((row) => row.stateSize.handles)
        ),
        aliasEdges: compareMeans(
          errorVerses.map((row) => row.stateSize.aliasEdges),
          nonErrorVerses.map((row) => row.stateSize.aliasEdges)
        ),
        pinnedCountStart: compareMeans(
          errorVerses.map((row) => row.carryIn.pinnedCount),
          nonErrorVerses.map((row) => row.carryIn.pinnedCount)
        ),
        pinnedCountEnd: compareMeans(
          errorVerses.map((row) => row.carryOut.pinnedCount),
          nonErrorVerses.map((row) => row.carryOut.pinnedCount)
        )
      }
    }
  };
}
