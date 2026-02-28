import type { Summary } from "../model";
import { deltas, describe, topN, type DescriptiveStats } from "../stats";

const DEFAULT_TOP_N = 25;
const RATIO_EPSILON = 1e-9;

export type StateMetricName = "handles" | "links" | "boundaries" | "rules" | "cont" | "aliasEdges";

export type RatioMetricName =
  | "linksPerHandle"
  | "boundariesPerHandle"
  | "rulesPerHandle"
  | "aliasEdgesPerHandle"
  | "contPerHandle";

export type StateShapeRatioRow = {
  sequence: number;
  ref_key: string;
  handles: number;
  linksPerHandle: number | null;
  boundariesPerHandle: number | null;
  rulesPerHandle: number | null;
  aliasEdgesPerHandle: number | null;
  contPerHandle: number | null;
};

export type StateShapeDeltaRow = {
  metric: StateMetricName;
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  ref_key: string;
  prevValue: number;
  value: number;
  delta: number;
  absDelta: number;
};

export type StateShapeReport = {
  verses: number;
  metrics: Record<
    StateMetricName,
    {
      series: number[];
      describe: DescriptiveStats;
    }
  >;
  ratios: {
    perVerse: StateShapeRatioRow[];
    describe: Record<RatioMetricName, DescriptiveStats>;
    trend: {
      linksPerHandleDeltaDescribe: DescriptiveStats;
      boundariesPerHandleDeltaDescribe: DescriptiveStats;
      rulesPerHandleDeltaDescribe: DescriptiveStats;
      aliasEdgesPerHandleDeltaDescribe: DescriptiveStats;
      contPerHandleDeltaDescribe: DescriptiveStats;
      densitySignal: "denser" | "sparser" | "stable" | "mixed";
    };
  };
  deltas: {
    perMetric: Record<
      StateMetricName,
      {
        series: number[];
        describe: DescriptiveStats;
        absDescribe: DescriptiveStats;
        transitions: StateShapeDeltaRow[];
        topAbsDelta: StateShapeDeltaRow[];
      }
    >;
    topAcrossMetrics: StateShapeDeltaRow[];
  };
  regimeChange: {
    method: "abs(Δhandles) > p99(abs(Δhandles))";
    threshold: number | null;
    events: StateShapeDeltaRow[];
  };
};

function metricSeries(summary: Summary, metric: StateMetricName): number[] {
  return summary.verses.map((row) => row.stateSize[metric]);
}

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function densitySignalFromMeans(means: number[]): "denser" | "sparser" | "stable" | "mixed" {
  if (means.length === 0) {
    return "stable";
  }
  const positives = means.filter((value) => value > RATIO_EPSILON).length;
  const negatives = means.filter((value) => value < -RATIO_EPSILON).length;
  if (positives === means.length) {
    return "denser";
  }
  if (negatives === means.length) {
    return "sparser";
  }
  if (positives === 0 && negatives === 0) {
    return "stable";
  }
  return "mixed";
}

function buildMetricDeltaRows(summary: Summary, metric: StateMetricName): StateShapeDeltaRow[] {
  const out: StateShapeDeltaRow[] = [];
  for (let index = 1; index < summary.verses.length; index += 1) {
    const prev = summary.verses[index - 1];
    const curr = summary.verses[index];
    const prevValue = prev.stateSize[metric];
    const value = curr.stateSize[metric];
    const delta = value - prevValue;
    out.push({
      metric,
      prevSequence: prev.sequence,
      sequence: curr.sequence,
      prevRefKey: prev.ref_key,
      ref_key: curr.ref_key,
      prevValue,
      value,
      delta,
      absDelta: Math.abs(delta)
    });
  }
  return out;
}

function topAbs(rows: StateShapeDeltaRow[]): StateShapeDeltaRow[] {
  return topN(
    rows.map((row) => ({ ...row, refKey: row.ref_key })),
    DEFAULT_TOP_N,
    (row) => row.absDelta
  );
}

export function extractStateShape(summary: Summary): StateShapeReport {
  const handlesSeries = metricSeries(summary, "handles");
  const linksSeries = metricSeries(summary, "links");
  const boundariesSeries = metricSeries(summary, "boundaries");
  const rulesSeries = metricSeries(summary, "rules");
  const contSeries = metricSeries(summary, "cont");
  const aliasEdgesSeries = metricSeries(summary, "aliasEdges");

  const ratioRows: StateShapeRatioRow[] = summary.verses.map((row) => ({
    sequence: row.sequence,
    ref_key: row.ref_key,
    handles: row.stateSize.handles,
    linksPerHandle: ratio(row.stateSize.links, row.stateSize.handles),
    boundariesPerHandle: ratio(row.stateSize.boundaries, row.stateSize.handles),
    rulesPerHandle: ratio(row.stateSize.rules, row.stateSize.handles),
    aliasEdgesPerHandle: ratio(row.stateSize.aliasEdges, row.stateSize.handles),
    contPerHandle: ratio(row.stateSize.cont, row.stateSize.handles)
  }));

  const linksPerHandleSeries = ratioRows
    .map((row) => row.linksPerHandle)
    .filter((value): value is number => value !== null);
  const boundariesPerHandleSeries = ratioRows
    .map((row) => row.boundariesPerHandle)
    .filter((value): value is number => value !== null);
  const rulesPerHandleSeries = ratioRows
    .map((row) => row.rulesPerHandle)
    .filter((value): value is number => value !== null);
  const aliasEdgesPerHandleSeries = ratioRows
    .map((row) => row.aliasEdgesPerHandle)
    .filter((value): value is number => value !== null);
  const contPerHandleSeries = ratioRows
    .map((row) => row.contPerHandle)
    .filter((value): value is number => value !== null);

  const ratioDeltas = {
    linksPerHandle: deltas(linksPerHandleSeries),
    boundariesPerHandle: deltas(boundariesPerHandleSeries),
    rulesPerHandle: deltas(rulesPerHandleSeries),
    aliasEdgesPerHandle: deltas(aliasEdgesPerHandleSeries),
    contPerHandle: deltas(contPerHandleSeries)
  };
  const ratioDeltaMeans = [
    describe(ratioDeltas.linksPerHandle).mean,
    describe(ratioDeltas.boundariesPerHandle).mean,
    describe(ratioDeltas.rulesPerHandle).mean,
    describe(ratioDeltas.aliasEdgesPerHandle).mean,
    describe(ratioDeltas.contPerHandle).mean
  ].filter((value): value is number => value !== null);

  const metricDeltas = {
    handles: buildMetricDeltaRows(summary, "handles"),
    links: buildMetricDeltaRows(summary, "links"),
    boundaries: buildMetricDeltaRows(summary, "boundaries"),
    rules: buildMetricDeltaRows(summary, "rules"),
    cont: buildMetricDeltaRows(summary, "cont"),
    aliasEdges: buildMetricDeltaRows(summary, "aliasEdges")
  };

  const handlesAbsDescribe = describe(metricDeltas.handles.map((row) => row.absDelta));
  const regimeThreshold = handlesAbsDescribe.p99;
  const regimeEvents =
    regimeThreshold === null
      ? []
      : metricDeltas.handles.filter((row) => row.absDelta > regimeThreshold);

  const topAcrossMetrics = topAbs([
    ...metricDeltas.handles,
    ...metricDeltas.links,
    ...metricDeltas.boundaries,
    ...metricDeltas.rules,
    ...metricDeltas.cont,
    ...metricDeltas.aliasEdges
  ]);

  return {
    verses: summary.verses.length,
    metrics: {
      handles: {
        series: handlesSeries,
        describe: describe(handlesSeries)
      },
      links: {
        series: linksSeries,
        describe: describe(linksSeries)
      },
      boundaries: {
        series: boundariesSeries,
        describe: describe(boundariesSeries)
      },
      rules: {
        series: rulesSeries,
        describe: describe(rulesSeries)
      },
      cont: {
        series: contSeries,
        describe: describe(contSeries)
      },
      aliasEdges: {
        series: aliasEdgesSeries,
        describe: describe(aliasEdgesSeries)
      }
    },
    ratios: {
      perVerse: ratioRows,
      describe: {
        linksPerHandle: describe(linksPerHandleSeries),
        boundariesPerHandle: describe(boundariesPerHandleSeries),
        rulesPerHandle: describe(rulesPerHandleSeries),
        aliasEdgesPerHandle: describe(aliasEdgesPerHandleSeries),
        contPerHandle: describe(contPerHandleSeries)
      },
      trend: {
        linksPerHandleDeltaDescribe: describe(ratioDeltas.linksPerHandle),
        boundariesPerHandleDeltaDescribe: describe(ratioDeltas.boundariesPerHandle),
        rulesPerHandleDeltaDescribe: describe(ratioDeltas.rulesPerHandle),
        aliasEdgesPerHandleDeltaDescribe: describe(ratioDeltas.aliasEdgesPerHandle),
        contPerHandleDeltaDescribe: describe(ratioDeltas.contPerHandle),
        densitySignal: densitySignalFromMeans(ratioDeltaMeans)
      }
    },
    deltas: {
      perMetric: {
        handles: {
          series: metricDeltas.handles.map((row) => row.delta),
          describe: describe(metricDeltas.handles.map((row) => row.delta)),
          absDescribe: handlesAbsDescribe,
          transitions: metricDeltas.handles,
          topAbsDelta: topAbs(metricDeltas.handles)
        },
        links: {
          series: metricDeltas.links.map((row) => row.delta),
          describe: describe(metricDeltas.links.map((row) => row.delta)),
          absDescribe: describe(metricDeltas.links.map((row) => row.absDelta)),
          transitions: metricDeltas.links,
          topAbsDelta: topAbs(metricDeltas.links)
        },
        boundaries: {
          series: metricDeltas.boundaries.map((row) => row.delta),
          describe: describe(metricDeltas.boundaries.map((row) => row.delta)),
          absDescribe: describe(metricDeltas.boundaries.map((row) => row.absDelta)),
          transitions: metricDeltas.boundaries,
          topAbsDelta: topAbs(metricDeltas.boundaries)
        },
        rules: {
          series: metricDeltas.rules.map((row) => row.delta),
          describe: describe(metricDeltas.rules.map((row) => row.delta)),
          absDescribe: describe(metricDeltas.rules.map((row) => row.absDelta)),
          transitions: metricDeltas.rules,
          topAbsDelta: topAbs(metricDeltas.rules)
        },
        cont: {
          series: metricDeltas.cont.map((row) => row.delta),
          describe: describe(metricDeltas.cont.map((row) => row.delta)),
          absDescribe: describe(metricDeltas.cont.map((row) => row.absDelta)),
          transitions: metricDeltas.cont,
          topAbsDelta: topAbs(metricDeltas.cont)
        },
        aliasEdges: {
          series: metricDeltas.aliasEdges.map((row) => row.delta),
          describe: describe(metricDeltas.aliasEdges.map((row) => row.delta)),
          absDescribe: describe(metricDeltas.aliasEdges.map((row) => row.absDelta)),
          transitions: metricDeltas.aliasEdges,
          topAbsDelta: topAbs(metricDeltas.aliasEdges)
        }
      },
      topAcrossMetrics
    },
    regimeChange: {
      method: "abs(Δhandles) > p99(abs(Δhandles))",
      threshold: regimeThreshold,
      events: regimeEvents
    }
  };
}
