import { type CantillationMarkCoverage, type TropeClass } from "./marks";
import { compareRefKeysStable } from "./schema";

export type CantillationTopMark = {
  mark: string;
  codepoint: string;
  count: number;
  mapped: boolean;
  name: string;
  class: TropeClass | "UNKNOWN";
};

export type CantillationRefCoverage = {
  ref_key: string;
  graphemes: number;
  marks_seen: number;
  marks_mapped: number;
  marks_unknown: number;
  gap_events: number;
  events_emitted: number;
};

export type CantillationStatsConfigSnapshot = {
  strict: boolean;
  emit_unknown: boolean;
  sof_pasuk_rank: number;
  dump_stats: boolean;
  top_marks_limit: number;
  top_refs_limit: number;
};

export type CantillationStatsRefTally = {
  graphemes: number;
  marks_seen: number;
  marks_mapped: number;
  marks_unknown: number;
  gap_events: number;
  events_emitted: number;
  sof_pasuk_events: number;
};

export type CantillationStatsMarkTally = {
  mark: string;
  codepoint: string;
  count: number;
  mapped: boolean;
  name: string;
  class: TropeClass | "UNKNOWN";
};

export type CantillationStatsEventType = "TROPE_MARK" | "UNKNOWN_MARK" | "BOUNDARY";

export type CantillationEventTypeCounts = Record<CantillationStatsEventType, number>;

export type CantillationStats = {
  layer: "cantillation";
  marks_total: number;
  marks_mapped: number;
  marks_unknown: number;
  unknown_marks: Record<string, number>;
  mapped_marks: Record<string, number>;
  events_total: number;
  events_by_type: CantillationEventTypeCounts;
  refs_with_sof_pasuk: number;
  top_refs_by_event_count: Array<{ ref_key: string; event_count: number }>;
  totals: {
    graphemes: number;
    marks_seen: number;
    marks_mapped: number;
    marks_unknown: number;
    gap_events: number;
    events_emitted: number;
    gid_events: number;
  };
  top_marks: CantillationTopMark[];
  ref_key_coverage: {
    refs_seen: number;
    refs_with_marks: number;
    refs_with_gap_events: number;
    refs: CantillationRefCoverage[];
  };
  config: CantillationStatsConfigSnapshot;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function cloneEventTypeCounts(counts: CantillationEventTypeCounts): CantillationEventTypeCounts {
  return {
    TROPE_MARK: counts.TROPE_MARK,
    UNKNOWN_MARK: counts.UNKNOWN_MARK,
    BOUNDARY: counts.BOUNDARY
  };
}

export function createCantillationEventTypeCounts(): CantillationEventTypeCounts {
  return {
    TROPE_MARK: 0,
    UNKNOWN_MARK: 0,
    BOUNDARY: 0
  };
}

export function incrementCantillationEventType(
  counts: CantillationEventTypeCounts,
  type: CantillationStatsEventType
): void {
  counts[type] += 1;
}

export function initializeCantillationStats(
  config: CantillationStatsConfigSnapshot
): CantillationStats {
  return {
    layer: "cantillation",
    marks_total: 0,
    marks_mapped: 0,
    marks_unknown: 0,
    unknown_marks: {},
    mapped_marks: {},
    events_total: 0,
    events_by_type: createCantillationEventTypeCounts(),
    refs_with_sof_pasuk: 0,
    top_refs_by_event_count: [],
    totals: {
      graphemes: 0,
      marks_seen: 0,
      marks_mapped: 0,
      marks_unknown: 0,
      gap_events: 0,
      events_emitted: 0,
      gid_events: 0
    },
    top_marks: [],
    ref_key_coverage: {
      refs_seen: 0,
      refs_with_marks: 0,
      refs_with_gap_events: 0,
      refs: []
    },
    config
  };
}

export function finalizeCantillationStats(args: {
  stats: CantillationStats;
  coverage: CantillationMarkCoverage;
  markTallies: ReadonlyMap<string, CantillationStatsMarkTally>;
  refTallies: ReadonlyMap<string, CantillationStatsRefTally>;
  eventTypeCounts: CantillationEventTypeCounts;
}): CantillationStats {
  const refs: CantillationRefCoverage[] = [...args.refTallies.entries()]
    .sort((left, right) => compareRefKeysStable(left[0], right[0]))
    .map(([ref_key, tally]) => ({
      ref_key,
      graphemes: tally.graphemes,
      marks_seen: tally.marks_seen,
      marks_mapped: tally.marks_mapped,
      marks_unknown: tally.marks_unknown,
      gap_events: tally.gap_events,
      events_emitted: tally.events_emitted
    }));

  const refs_with_marks = refs.filter((entry) => entry.marks_seen > 0).length;
  const refs_with_gap_events = refs.filter((entry) => entry.gap_events > 0).length;
  const refs_with_sof_pasuk = [...args.refTallies.values()].filter(
    (entry) => entry.sof_pasuk_events > 0
  ).length;

  const topMarks = [...args.markTallies.values()]
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return compareText(left.codepoint, right.codepoint);
    })
    .slice(0, args.stats.config.top_marks_limit)
    .map((entry) => ({ ...entry }));

  const mapped_marks: Record<string, number> = {};
  const unknown_marks: Record<string, number> = {};
  for (const entry of args.markTallies.values()) {
    if (entry.mapped) {
      mapped_marks[entry.name] = (mapped_marks[entry.name] ?? 0) + entry.count;
      continue;
    }
    unknown_marks[entry.codepoint] = (unknown_marks[entry.codepoint] ?? 0) + entry.count;
  }

  const top_refs_by_event_count = [...refs]
    .sort((left, right) => {
      if (left.events_emitted !== right.events_emitted) {
        return right.events_emitted - left.events_emitted;
      }
      return compareRefKeysStable(left.ref_key, right.ref_key);
    })
    .slice(0, args.stats.config.top_refs_limit)
    .map((entry) => ({
      ref_key: entry.ref_key,
      event_count: entry.events_emitted
    }));

  const events_by_type = cloneEventTypeCounts(args.eventTypeCounts);
  const events_total =
    events_by_type.TROPE_MARK + events_by_type.UNKNOWN_MARK + events_by_type.BOUNDARY;
  const graphemes = refs.reduce((sum, entry) => sum + entry.graphemes, 0);

  return {
    ...args.stats,
    marks_total: args.coverage.marks_seen,
    marks_mapped: args.coverage.marks_mapped,
    marks_unknown: args.coverage.marks_unknown,
    unknown_marks,
    mapped_marks,
    events_total,
    events_by_type,
    refs_with_sof_pasuk,
    top_refs_by_event_count,
    totals: {
      graphemes,
      marks_seen: args.coverage.marks_seen,
      marks_mapped: args.coverage.marks_mapped,
      marks_unknown: args.coverage.marks_unknown,
      gap_events: events_by_type.BOUNDARY,
      events_emitted: events_total,
      gid_events: events_by_type.TROPE_MARK + events_by_type.UNKNOWN_MARK
    },
    top_marks: topMarks,
    ref_key_coverage: {
      refs_seen: refs.length,
      refs_with_marks,
      refs_with_gap_events,
      refs
    }
  };
}
