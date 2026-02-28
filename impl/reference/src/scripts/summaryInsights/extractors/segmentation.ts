import type { Summary, VerseRow } from "../model";
import { describe, topN, type DescriptiveStats } from "../stats";

const DEFAULT_TOP_N = 25;

type CarryField = "omega" | "focus" | "domain";

type VerseRefParts = {
  book: string;
  chapter: number;
  verse: number;
};

type TransitionStat = {
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  ref_key: string;
  prevBook: string;
  prevChapter: number;
  book: string;
  chapter: number;
  mismatchFields: CarryField[];
  mismatchCount: number;
  chapterBoundary: boolean;
};

export type SegmentationAggregate = {
  key: string;
  book: string;
  chapter: number | null;
  verseCount: number;
  transitionCount: number;
  mismatchTransitionCount: number;
  mismatchFieldTotal: number;
  mismatchTransitionRate: number | null;
  mismatchFieldRate: number | null;
  errorCount: number;
  errorRate: number | null;
  handles: {
    describe: DescriptiveStats;
    start: number | null;
    end: number | null;
    growth: number | null;
  };
  dropRate: {
    describe: DescriptiveStats;
    executedCount: number;
    skippedCount: number;
  };
  pinnedCount: {
    describe: DescriptiveStats;
  };
  problematicScore: number | null;
};

export type ChapterBoundaryTransition = {
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  ref_key: string;
  from: string;
  to: string;
  mismatchFields: CarryField[];
  mismatchCount: number;
};

export type ChapterTransitionChecks = {
  totalTransitions: number;
  boundaryTransitions: number;
  nonBoundaryTransitions: number;
  boundaryMismatchTransitions: number;
  nonBoundaryMismatchTransitions: number;
  boundaryMismatchRate: number | null;
  nonBoundaryMismatchRate: number | null;
  boundaryMismatchFieldMean: number | null;
  nonBoundaryMismatchFieldMean: number | null;
  spikeDetected: boolean | null;
  topBoundaryTransitions: ChapterBoundaryTransition[];
};

export type SegmentationReport = {
  verses: number;
  perBook: SegmentationAggregate[];
  perChapter: SegmentationAggregate[];
  chapterTransitionChecks: ChapterTransitionChecks;
};

type SegmentAccumulator = {
  key: string;
  book: string;
  chapter: number | null;
  verses: VerseRow[];
  transitionCount: number;
  mismatchTransitionCount: number;
  mismatchFieldTotal: number;
  dropRates: number[];
  dropExecutedCount: number;
  dropSkippedCount: number;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function parseRefParts(refKey: string): VerseRefParts {
  const parts = String(refKey ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 3) {
    return {
      book: "unknown",
      chapter: 0,
      verse: 0
    };
  }
  const verseRaw = parts.pop() ?? "";
  const chapterRaw = parts.pop() ?? "";
  const book = parts.join("/") || "unknown";
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);
  return {
    book,
    chapter: Number.isInteger(chapter) ? chapter : 0,
    verse: Number.isInteger(verse) ? verse : 0
  };
}

function groupKey(parts: VerseRefParts, by: "book" | "chapter"): string {
  return by === "book" ? parts.book : `${parts.book}/${parts.chapter}`;
}

function createAccumulator(parts: VerseRefParts, by: "book" | "chapter"): SegmentAccumulator {
  return {
    key: groupKey(parts, by),
    book: parts.book,
    chapter: by === "book" ? null : parts.chapter,
    verses: [],
    transitionCount: 0,
    mismatchTransitionCount: 0,
    mismatchFieldTotal: 0,
    dropRates: [],
    dropExecutedCount: 0,
    dropSkippedCount: 0
  };
}

function dropRateFor(row: VerseRow): number | null {
  const kept = row.cleanup.keptCount;
  const dropped = row.cleanup.droppedCount;
  if (kept === null || dropped === null) {
    return null;
  }
  const denominator = kept + dropped;
  if (denominator <= 0) {
    return 0;
  }
  return dropped / denominator;
}

function buildTransitions(summary: Summary): TransitionStat[] {
  const out: TransitionStat[] = [];
  for (let index = 1; index < summary.verses.length; index += 1) {
    const prev = summary.verses[index - 1];
    const curr = summary.verses[index];
    const prevRef = parseRefParts(prev.ref_key);
    const currRef = parseRefParts(curr.ref_key);
    const mismatchFields: CarryField[] = [];
    if (prev.carryOut.omega !== curr.carryIn.omega) {
      mismatchFields.push("omega");
    }
    if (prev.carryOut.focus !== curr.carryIn.focus) {
      mismatchFields.push("focus");
    }
    if (prev.carryOut.domain !== curr.carryIn.domain) {
      mismatchFields.push("domain");
    }

    out.push({
      prevSequence: prev.sequence,
      sequence: curr.sequence,
      prevRefKey: prev.ref_key,
      ref_key: curr.ref_key,
      prevBook: prevRef.book,
      prevChapter: prevRef.chapter,
      book: currRef.book,
      chapter: currRef.chapter,
      mismatchFields,
      mismatchCount: mismatchFields.length,
      chapterBoundary: prevRef.book !== currRef.book || prevRef.chapter !== currRef.chapter
    });
  }
  return out;
}

function toAggregate(acc: SegmentAccumulator): SegmentationAggregate {
  const handles = acc.verses.map((row) => row.stateSize.handles);
  const pinned = acc.verses.map((row) => row.carryOut.pinnedCount);
  const errorCount = acc.verses.filter((row) => row.runtimeError !== null).length;
  const verseCount = acc.verses.length;
  const transitionCount = acc.transitionCount;
  const mismatchTransitionRate =
    transitionCount > 0 ? acc.mismatchTransitionCount / transitionCount : null;
  const mismatchFieldRate =
    transitionCount > 0 ? acc.mismatchFieldTotal / (transitionCount * 3) : null;
  const growth = handles.length > 0 ? handles[handles.length - 1] - handles[0] : null;
  const errorRate = verseCount > 0 ? errorCount / verseCount : null;
  const problematicScore =
    errorRate === null || mismatchTransitionRate === null || growth === null
      ? null
      : errorRate * 10 + mismatchTransitionRate * 5 + Math.max(0, growth) / 100;

  return {
    key: acc.key,
    book: acc.book,
    chapter: acc.chapter,
    verseCount,
    transitionCount,
    mismatchTransitionCount: acc.mismatchTransitionCount,
    mismatchFieldTotal: acc.mismatchFieldTotal,
    mismatchTransitionRate,
    mismatchFieldRate,
    errorCount,
    errorRate,
    handles: {
      describe: describe(handles),
      start: handles.length > 0 ? handles[0] : null,
      end: handles.length > 0 ? handles[handles.length - 1] : null,
      growth
    },
    dropRate: {
      describe: describe(acc.dropRates),
      executedCount: acc.dropExecutedCount,
      skippedCount: acc.dropSkippedCount
    },
    pinnedCount: {
      describe: describe(pinned)
    },
    problematicScore
  };
}

function compareProblematic(left: SegmentationAggregate, right: SegmentationAggregate): number {
  const leftError = left.errorRate ?? Number.NEGATIVE_INFINITY;
  const rightError = right.errorRate ?? Number.NEGATIVE_INFINITY;
  if (leftError !== rightError) {
    return rightError - leftError;
  }

  const leftMismatch = left.mismatchTransitionRate ?? Number.NEGATIVE_INFINITY;
  const rightMismatch = right.mismatchTransitionRate ?? Number.NEGATIVE_INFINITY;
  if (leftMismatch !== rightMismatch) {
    return rightMismatch - leftMismatch;
  }

  const leftGrowth = left.handles.growth ?? Number.NEGATIVE_INFINITY;
  const rightGrowth = right.handles.growth ?? Number.NEGATIVE_INFINITY;
  if (leftGrowth !== rightGrowth) {
    return rightGrowth - leftGrowth;
  }

  if (left.mismatchFieldTotal !== right.mismatchFieldTotal) {
    return right.mismatchFieldTotal - left.mismatchFieldTotal;
  }

  if (left.verseCount !== right.verseCount) {
    return right.verseCount - left.verseCount;
  }

  return compareText(left.key, right.key);
}

function aggregateBy(summary: Summary, by: "book" | "chapter"): SegmentationAggregate[] {
  const accumulators = new Map<string, SegmentAccumulator>();
  const transitions = buildTransitions(summary);

  for (const row of summary.verses) {
    const ref = parseRefParts(row.ref_key);
    const key = groupKey(ref, by);
    const acc = accumulators.get(key) ?? createAccumulator(ref, by);
    acc.verses.push(row);
    const rate = dropRateFor(row);
    if (rate === null) {
      acc.dropSkippedCount += 1;
    } else {
      acc.dropExecutedCount += 1;
      acc.dropRates.push(rate);
    }
    accumulators.set(key, acc);
  }

  for (const transition of transitions) {
    const ref: VerseRefParts = {
      book: transition.book,
      chapter: transition.chapter,
      verse: 0
    };
    const key = groupKey(ref, by);
    const acc = accumulators.get(key);
    if (!acc) {
      continue;
    }
    acc.transitionCount += 1;
    acc.mismatchFieldTotal += transition.mismatchCount;
    if (transition.mismatchCount > 0) {
      acc.mismatchTransitionCount += 1;
    }
  }

  return Array.from(accumulators.values()).map(toAggregate).sort(compareProblematic);
}

function toBoundaryRow(transition: TransitionStat): ChapterBoundaryTransition {
  return {
    prevSequence: transition.prevSequence,
    sequence: transition.sequence,
    prevRefKey: transition.prevRefKey,
    ref_key: transition.ref_key,
    from: `${transition.prevBook}/${transition.prevChapter}`,
    to: `${transition.book}/${transition.chapter}`,
    mismatchFields: transition.mismatchFields,
    mismatchCount: transition.mismatchCount
  };
}

function chapterTransitionChecks(summary: Summary): ChapterTransitionChecks {
  const transitions = buildTransitions(summary);
  const boundary = transitions.filter((row) => row.chapterBoundary);
  const nonBoundary = transitions.filter((row) => !row.chapterBoundary);
  const boundaryMismatchTransitions = boundary.filter((row) => row.mismatchCount > 0);
  const nonBoundaryMismatchTransitions = nonBoundary.filter((row) => row.mismatchCount > 0);

  const boundaryMismatchRate =
    boundary.length > 0 ? boundaryMismatchTransitions.length / boundary.length : null;
  const nonBoundaryMismatchRate =
    nonBoundary.length > 0 ? nonBoundaryMismatchTransitions.length / nonBoundary.length : null;
  const boundaryMismatchFieldMean =
    boundary.length > 0
      ? boundary.reduce((sum, row) => sum + row.mismatchCount, 0) / boundary.length
      : null;
  const nonBoundaryMismatchFieldMean =
    nonBoundary.length > 0
      ? nonBoundary.reduce((sum, row) => sum + row.mismatchCount, 0) / nonBoundary.length
      : null;

  const rankedBoundary = topN(
    boundary.map((row) => ({ ...row, refKey: row.ref_key })),
    DEFAULT_TOP_N,
    (row) => row.mismatchCount
  ).map(toBoundaryRow);

  return {
    totalTransitions: transitions.length,
    boundaryTransitions: boundary.length,
    nonBoundaryTransitions: nonBoundary.length,
    boundaryMismatchTransitions: boundaryMismatchTransitions.length,
    nonBoundaryMismatchTransitions: nonBoundaryMismatchTransitions.length,
    boundaryMismatchRate,
    nonBoundaryMismatchRate,
    boundaryMismatchFieldMean,
    nonBoundaryMismatchFieldMean,
    spikeDetected:
      boundaryMismatchRate !== null && nonBoundaryMismatchRate !== null
        ? boundaryMismatchRate > nonBoundaryMismatchRate
        : null,
    topBoundaryTransitions: rankedBoundary
  };
}

export function extractSegmentation(summary: Summary): SegmentationReport {
  return {
    verses: summary.verses.length,
    perBook: aggregateBy(summary, "book"),
    perChapter: aggregateBy(summary, "chapter"),
    chapterTransitionChecks: chapterTransitionChecks(summary)
  };
}
