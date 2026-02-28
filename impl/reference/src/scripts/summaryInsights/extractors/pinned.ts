import { describe, deltas, jaccard, runLengths, topN, type DescriptiveStats } from "../stats";
import type { Summary, VerseRow } from "../model";

const DEFAULT_TOP_N = 25;
const IMMORTAL_THRESHOLD_PCT = 0.6;

export type PinnedHistogram = {
  "0": number;
  "1": number;
  "2-3": number;
  "4-7": number;
  "8+": number;
};

export type PinnedChurnTransition = {
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  refKey: string;
  prevCount: number;
  currCount: number;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  netCountChange: number;
  jaccard: number;
};

export type PinnedLongevityRow = {
  id: string;
  firstSeq: number;
  lastSeq: number;
  lifespan: number;
  presenceCount: number;
  presenceRatio: number;
};

export type FocusPinnedRun = {
  focusId: string | null;
  startSeq: number;
  endSeq: number;
  length: number;
  transitionCount: number;
  stableTransitions: number;
  stabilityRate: number | null;
};

export type PinnedReport = {
  verses: number;
  pinnedCount: {
    series: number[];
    describe: DescriptiveStats;
    histogram: PinnedHistogram;
    deltas: {
      series: number[];
      describe: DescriptiveStats;
      positive: number;
      negative: number;
      zero: number;
      net: number;
      nonDecreasingTransitions: number;
      nonDecreasingRate: number | null;
    };
    accumulation: {
      start: number | null;
      end: number | null;
      netGrowth: number | null;
    };
  };
  churn: {
    transitions: number;
    perTransition: PinnedChurnTransition[];
    totals: {
      added: number;
      removed: number;
      zeroChurnTransitions: number;
      jaccardMean: number | null;
    };
    addedDescribe: DescriptiveStats;
    removedDescribe: DescriptiveStats;
    jaccardDescribe: DescriptiveStats;
    topAdded: PinnedChurnTransition[];
    topRemoved: PinnedChurnTransition[];
  };
  longevity: {
    handlesTracked: number;
    table: PinnedLongevityRow[];
    topByLifespan: PinnedLongevityRow[];
    topByPresence: PinnedLongevityRow[];
    immortals: {
      thresholdPct: number;
      minLifespan: number;
      handles: PinnedLongevityRow[];
    };
  };
  coupling: {
    focusRuns: FocusPinnedRun[];
    runLengthDescribe: DescriptiveStats;
    stabilityDescribe: DescriptiveStats;
    pearsonLike: number | null;
    heuristic: "insufficient_data" | "stable_with_longer_focus_runs" | "brittle" | "mixed";
  };
  qualitySignals: {
    accumulationRisk: "low" | "medium" | "high";
    brittlenessRisk: "low" | "medium" | "high";
  };
};

type LongevityAccumulator = {
  id: string;
  firstSeq: number;
  lastSeq: number;
  presenceCount: number;
  presenceBySequence: boolean[];
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareLongevity(left: PinnedLongevityRow, right: PinnedLongevityRow): number {
  if (left.lifespan !== right.lifespan) {
    return right.lifespan - left.lifespan;
  }
  if (left.presenceCount !== right.presenceCount) {
    return right.presenceCount - left.presenceCount;
  }
  if (left.firstSeq !== right.firstSeq) {
    return left.firstSeq - right.firstSeq;
  }
  return compareText(left.id, right.id);
}

function normalizePinned(ids: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const id of ids) {
    const text = String(id ?? "").trim();
    if (!text) {
      continue;
    }
    unique.add(text);
  }
  return Array.from(unique).sort(compareText);
}

function bucketPinnedCount(count: number): keyof PinnedHistogram {
  if (count <= 0) {
    return "0";
  }
  if (count === 1) {
    return "1";
  }
  if (count <= 3) {
    return "2-3";
  }
  if (count <= 7) {
    return "4-7";
  }
  return "8+";
}

function emptyHistogram(): PinnedHistogram {
  return {
    "0": 0,
    "1": 0,
    "2-3": 0,
    "4-7": 0,
    "8+": 0
  };
}

function buildHistogram(counts: readonly number[]): PinnedHistogram {
  const histogram = emptyHistogram();
  for (const count of counts) {
    histogram[bucketPinnedCount(count)] += 1;
  }
  return histogram;
}

function setDifference(source: ReadonlySet<string>, exclude: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const item of source) {
    if (exclude.has(item)) {
      continue;
    }
    out.push(item);
  }
  return out.sort(compareText);
}

function calculatePearsonLike(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) {
    return null;
  }

  const count = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / count;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / count;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let index = 0; index < count; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) {
    return null;
  }
  return cov / Math.sqrt(varX * varY);
}

function chooseAccumulationRisk(report: PinnedReport): "low" | "medium" | "high" {
  const netGrowth = report.pinnedCount.accumulation.netGrowth ?? 0;
  const nonDecreasingRate = report.pinnedCount.deltas.nonDecreasingRate ?? 0;
  if (netGrowth >= 10 || (netGrowth >= 5 && nonDecreasingRate >= 0.9)) {
    return "high";
  }
  if (netGrowth >= 3 || (netGrowth > 0 && nonDecreasingRate >= 0.9)) {
    return "medium";
  }
  return "low";
}

function chooseBrittlenessRisk(report: PinnedReport): "low" | "medium" | "high" {
  const jaccardMean = report.churn.totals.jaccardMean ?? 1;
  const removedMean = report.churn.removedDescribe.mean ?? 0;
  const couplingHeuristic = report.coupling.heuristic;
  if (jaccardMean < 0.5 || removedMean >= 2) {
    return "high";
  }
  if (couplingHeuristic === "brittle" && (jaccardMean < 0.8 || removedMean >= 0.5)) {
    return "high";
  }
  if (couplingHeuristic === "brittle") {
    return "medium";
  }
  if (jaccardMean < 0.8 || removedMean >= 0.5) {
    return "medium";
  }
  return "low";
}

function toTopRankableLongevity(
  rows: readonly PinnedLongevityRow[]
): Array<PinnedLongevityRow & { sequence: number; ref_key: string }> {
  return rows.map((row) => ({
    ...row,
    sequence: row.firstSeq,
    ref_key: row.id
  }));
}

function buildCoupling(
  verses: readonly VerseRow[],
  pinnedCountSeries: readonly number[]
): PinnedReport["coupling"] {
  const focusIds = verses.map((row) => row.carryIn.focus);
  const runs = runLengths(focusIds);
  const focusRuns: FocusPinnedRun[] = runs.map((run) => {
    const startIndex = run.startSeq - 1;
    const endIndex = run.endSeq - 1;
    let stableTransitions = 0;
    let transitionCount = 0;
    for (let index = startIndex; index < endIndex; index += 1) {
      transitionCount += 1;
      if (pinnedCountSeries[index] === pinnedCountSeries[index + 1]) {
        stableTransitions += 1;
      }
    }
    return {
      focusId: run.id,
      startSeq: verses[startIndex]?.sequence ?? run.startSeq,
      endSeq: verses[endIndex]?.sequence ?? run.endSeq,
      length: run.length,
      transitionCount,
      stableTransitions,
      stabilityRate: transitionCount > 0 ? stableTransitions / transitionCount : null
    };
  });

  const runLengthsSeries = focusRuns.map((run) => run.length);
  const stabilitySeries = focusRuns
    .map((run) => run.stabilityRate)
    .filter((value): value is number => value !== null);
  const runsWithTransitions = focusRuns.filter((run) => run.transitionCount > 0);
  const pearsonLike = calculatePearsonLike(
    runsWithTransitions.map((run) => run.length),
    runsWithTransitions.map((run) => run.stabilityRate ?? 0)
  );

  const meanStability = describe(stabilitySeries).mean ?? 0;
  let heuristic: PinnedReport["coupling"]["heuristic"] = "mixed";
  if (runsWithTransitions.length === 0) {
    heuristic = "insufficient_data";
  } else if (meanStability <= 0.3) {
    heuristic = "brittle";
  } else if ((pearsonLike ?? 0) >= 0.3 && meanStability >= 0.7) {
    heuristic = "stable_with_longer_focus_runs";
  } else {
    heuristic = "mixed";
  }

  return {
    focusRuns,
    runLengthDescribe: describe(runLengthsSeries),
    stabilityDescribe: describe(stabilitySeries),
    pearsonLike,
    heuristic
  };
}

export function extractPinned(summary: Summary): PinnedReport {
  const verses = summary.verses;
  const pinnedCountSeries = verses.map((row) => row.carryOut.pinnedCount);
  const countDeltas = deltas(pinnedCountSeries);
  const positiveDeltas = countDeltas.filter((value) => value > 0).length;
  const negativeDeltas = countDeltas.filter((value) => value < 0).length;
  const zeroDeltas = countDeltas.filter((value) => value === 0).length;
  const nonDecreasingTransitions = countDeltas.filter((value) => value >= 0).length;

  const transitions: PinnedChurnTransition[] = [];
  for (let index = 1; index < verses.length; index += 1) {
    const prev = verses[index - 1];
    const curr = verses[index];
    const prevSet = new Set(normalizePinned(prev.carryOut.pinned));
    const currSet = new Set(normalizePinned(curr.carryIn.pinned));
    const added = setDifference(currSet, prevSet);
    const removed = setDifference(prevSet, currSet);

    transitions.push({
      prevSequence: prev.sequence,
      sequence: curr.sequence,
      prevRefKey: prev.ref_key,
      refKey: curr.ref_key,
      prevCount: prevSet.size,
      currCount: currSet.size,
      added,
      removed,
      addedCount: added.length,
      removedCount: removed.length,
      netCountChange: currSet.size - prevSet.size,
      jaccard: jaccard(prevSet, currSet)
    });
  }
  transitions.sort(
    (left, right) =>
      left.sequence - right.sequence ||
      left.prevSequence - right.prevSequence ||
      compareText(left.refKey, right.refKey)
  );

  const addedSeries = transitions.map((row) => row.addedCount);
  const removedSeries = transitions.map((row) => row.removedCount);
  const jaccardSeries = transitions.map((row) => row.jaccard);
  const zeroChurnTransitions = transitions.filter(
    (row) => row.addedCount === 0 && row.removedCount === 0
  ).length;

  const verseCount = verses.length;
  const presenceMap = new Map<string, LongevityAccumulator>();
  for (let index = 0; index < verseCount; index += 1) {
    const verse = verses[index];
    const seqNumber = verse.sequence;
    const presentNow = new Set(normalizePinned(verse.carryOut.pinned));

    for (const accumulator of presenceMap.values()) {
      accumulator.presenceBySequence.push(false);
    }

    for (const id of presentNow) {
      const existing = presenceMap.get(id);
      if (!existing) {
        const presenceBySequence = Array.from({ length: verseCount }, () => false);
        presenceBySequence[index] = true;
        presenceMap.set(id, {
          id,
          firstSeq: seqNumber,
          lastSeq: seqNumber,
          presenceCount: 1,
          presenceBySequence
        });
        continue;
      }
      existing.lastSeq = seqNumber;
      existing.presenceCount += 1;
      existing.presenceBySequence[index] = true;
    }
  }

  const longevityRows: PinnedLongevityRow[] = Array.from(presenceMap.values())
    .map((row) => {
      const lifespan = row.lastSeq - row.firstSeq + 1;
      return {
        id: row.id,
        firstSeq: row.firstSeq,
        lastSeq: row.lastSeq,
        lifespan,
        presenceCount: row.presenceCount,
        presenceRatio: lifespan > 0 ? row.presenceCount / lifespan : 0
      };
    })
    .sort(compareLongevity);

  const minLifespan = verseCount > 0 ? Math.floor(verseCount * IMMORTAL_THRESHOLD_PCT) + 1 : 0;
  const immortals = longevityRows
    .filter((row) => row.lifespan >= minLifespan)
    .sort(compareLongevity);

  const topLongevityRankable = toTopRankableLongevity(longevityRows);
  const topByLifespan = topN(topLongevityRankable, DEFAULT_TOP_N, (row) => row.lifespan).map(
    ({ sequence: _sequence, ref_key: _refKey, ...row }) => row
  );
  const topByPresence = topN(topLongevityRankable, DEFAULT_TOP_N, (row) => row.presenceCount).map(
    ({ sequence: _sequence, ref_key: _refKey, ...row }) => row
  );

  const transitionRankable = transitions.map((row) => ({
    ...row,
    sequence: row.sequence,
    ref_key: row.refKey
  }));
  const topAdded = topN(transitionRankable, DEFAULT_TOP_N, (row) => row.addedCount).map(
    ({ ref_key: _refKey, ...row }) => row
  );
  const topRemoved = topN(transitionRankable, DEFAULT_TOP_N, (row) => row.removedCount).map(
    ({ ref_key: _refKey, ...row }) => row
  );

  const report: PinnedReport = {
    verses: verseCount,
    pinnedCount: {
      series: pinnedCountSeries,
      describe: describe(pinnedCountSeries),
      histogram: buildHistogram(pinnedCountSeries),
      deltas: {
        series: countDeltas,
        describe: describe(countDeltas),
        positive: positiveDeltas,
        negative: negativeDeltas,
        zero: zeroDeltas,
        net: countDeltas.reduce((sum, value) => sum + value, 0),
        nonDecreasingTransitions,
        nonDecreasingRate:
          countDeltas.length > 0 ? nonDecreasingTransitions / countDeltas.length : null
      },
      accumulation: {
        start: pinnedCountSeries.length > 0 ? pinnedCountSeries[0] : null,
        end: pinnedCountSeries.length > 0 ? pinnedCountSeries[pinnedCountSeries.length - 1] : null,
        netGrowth:
          pinnedCountSeries.length > 0
            ? pinnedCountSeries[pinnedCountSeries.length - 1] - pinnedCountSeries[0]
            : null
      }
    },
    churn: {
      transitions: transitions.length,
      perTransition: transitions,
      totals: {
        added: addedSeries.reduce((sum, value) => sum + value, 0),
        removed: removedSeries.reduce((sum, value) => sum + value, 0),
        zeroChurnTransitions,
        jaccardMean: describe(jaccardSeries).mean
      },
      addedDescribe: describe(addedSeries),
      removedDescribe: describe(removedSeries),
      jaccardDescribe: describe(jaccardSeries),
      topAdded,
      topRemoved
    },
    longevity: {
      handlesTracked: longevityRows.length,
      table: longevityRows,
      topByLifespan,
      topByPresence,
      immortals: {
        thresholdPct: IMMORTAL_THRESHOLD_PCT,
        minLifespan,
        handles: immortals
      }
    },
    coupling: buildCoupling(verses, pinnedCountSeries),
    qualitySignals: {
      accumulationRisk: "low",
      brittlenessRisk: "low"
    }
  };

  report.qualitySignals.accumulationRisk = chooseAccumulationRisk(report);
  report.qualitySignals.brittlenessRisk = chooseBrittlenessRisk(report);

  return report;
}
