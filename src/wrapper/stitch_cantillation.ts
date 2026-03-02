import { type SpineRecord } from "../spine/schema";
import {
  compareCantillationEvents,
  readCantillationIRJsonl,
  type CantillationBoundaryEvent,
  type CantillationEvent,
  type CantillationIRRecord,
  type CantillationTropeMarkEvent
} from "../layers/cantillation/schema";
import { placeDisjCutBoundaries } from "../layers/cantillation/placement";

export type CantEvent = CantillationEvent;

export type CantillationEventIndex = {
  eventsByGid: Map<string, CantEvent[]>;
  eventsByGap: Map<string, CantEvent[]>;
};

export type WrapperCantillationPolicy = {
  sof_pasuk_cut_rank: number;
  derive_boundaries_from_trope_marks: boolean;
  disj_boundary_reason: string;
};

export const DEFAULT_WRAPPER_CANTILLATION_POLICY: Readonly<WrapperCantillationPolicy> =
  Object.freeze({
    sof_pasuk_cut_rank: 3,
    derive_boundaries_from_trope_marks: false,
    disj_boundary_reason: "DISJ_TROPE"
  });

export type WrapperProgramOpRecord = {
  gid: string;
  [key: string]: unknown;
};

export type WrapperBoundaryFrameRecord = {
  gapid: string;
  [key: string]: unknown;
};

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`wrapper cantillation stitch: ${label} must be non-empty string`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`wrapper cantillation stitch: ${label} must be integer >= 1`);
  }
}

function cloneCantEvent(event: CantEvent): CantEvent {
  return JSON.parse(JSON.stringify(event)) as CantEvent;
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function normalizePolicy(
  policy: Partial<WrapperCantillationPolicy> | undefined
): WrapperCantillationPolicy {
  const merged = {
    ...DEFAULT_WRAPPER_CANTILLATION_POLICY,
    ...(policy ?? {})
  };
  assertPositiveInteger(merged.sof_pasuk_cut_rank, "policy.sof_pasuk_cut_rank");
  assertNonEmptyString(merged.disj_boundary_reason, "policy.disj_boundary_reason");
  return merged;
}

function pushEvent(
  eventsByAnchor: Map<string, CantEvent[]>,
  anchorId: string,
  event: CantEvent
): void {
  const existing = eventsByAnchor.get(anchorId) ?? [];
  existing.push(event);
  eventsByAnchor.set(anchorId, existing);
}

function normalizeGapBoundaryEvent(event: CantEvent, policy: WrapperCantillationPolicy): CantEvent {
  if (event.type !== "BOUNDARY") {
    return cloneCantEvent(event);
  }

  if (
    event.reason === "SOF_PASUK" &&
    (event.op !== "CUT" || event.rank !== policy.sof_pasuk_cut_rank)
  ) {
    const normalized: CantillationBoundaryEvent = {
      type: "BOUNDARY",
      op: "CUT",
      rank: policy.sof_pasuk_cut_rank,
      reason: "SOF_PASUK"
    };
    return normalized;
  }

  return cloneCantEvent(event);
}

function maybePlaceDisjunctiveBoundaries(args: {
  records: readonly CantillationIRRecord[];
  spineRecords?: readonly SpineRecord[];
  policy: WrapperCantillationPolicy;
  eventsByGap: Map<string, CantEvent[]>;
}): void {
  if (!args.policy.derive_boundaries_from_trope_marks) {
    return;
  }
  if (!args.spineRecords) {
    throw new Error(
      "wrapper cantillation stitch: spineRecords are required when derive_boundaries_from_trope_marks=true"
    );
  }

  const inputs = args.records
    .filter((row): row is CantillationIRRecord & { event: CantillationTropeMarkEvent } => {
      return (
        row.anchor.kind === "gid" &&
        row.event.type === "TROPE_MARK" &&
        row.event.class === "DISJ" &&
        typeof row.event.rank === "number" &&
        row.event.rank >= 1
      );
    })
    .map((row) => ({
      gid: row.anchor.id,
      ref_key: row.ref_key,
      rank: row.event.rank,
      mark: row.event.mark
    }));

  if (inputs.length === 0) {
    return;
  }

  const placements = placeDisjCutBoundaries({
    inputs,
    spineRecords: args.spineRecords
  });

  for (const placement of placements) {
    const event: CantillationBoundaryEvent = {
      type: "BOUNDARY",
      op: "CUT",
      rank: placement.rank,
      reason: args.policy.disj_boundary_reason
    };
    // Synthetic ref_end_gap targets are kept as gap-keyed events for downstream policy consumers.
    pushEvent(args.eventsByGap, placement.target.id, event);
  }
}

function sortEventMapValues(eventsByAnchor: Map<string, CantEvent[]>): void {
  for (const [anchorId, events] of eventsByAnchor.entries()) {
    const sorted = [...events].sort(compareCantillationEvents);
    eventsByAnchor.set(anchorId, sorted);
  }
}

function sortRecordsDeterministically(
  records: readonly CantillationIRRecord[]
): CantillationIRRecord[] {
  return [...records].sort((left, right) => {
    if (left.ref_key !== right.ref_key) {
      return compareText(left.ref_key, right.ref_key);
    }
    if (left.anchor.kind !== right.anchor.kind) {
      return left.anchor.kind < right.anchor.kind ? -1 : 1;
    }
    if (left.anchor.id !== right.anchor.id) {
      return compareText(left.anchor.id, right.anchor.id);
    }
    return compareCantillationEvents(left.event, right.event);
  });
}

export function indexCantillationEvents(args: {
  records: readonly CantillationIRRecord[];
  spineRecords?: readonly SpineRecord[];
  policy?: Partial<WrapperCantillationPolicy>;
}): CantillationEventIndex {
  const policy = normalizePolicy(args.policy);
  const eventsByGid = new Map<string, CantEvent[]>();
  const eventsByGap = new Map<string, CantEvent[]>();
  const sortedRecords = sortRecordsDeterministically(args.records);

  for (const row of sortedRecords) {
    const event =
      row.anchor.kind === "gap"
        ? normalizeGapBoundaryEvent(row.event, policy)
        : cloneCantEvent(row.event);
    if (row.anchor.kind === "gid") {
      pushEvent(eventsByGid, row.anchor.id, event);
      continue;
    }
    pushEvent(eventsByGap, row.anchor.id, event);
  }

  maybePlaceDisjunctiveBoundaries({
    records: sortedRecords,
    spineRecords: args.spineRecords,
    policy,
    eventsByGap
  });

  sortEventMapValues(eventsByGid);
  sortEventMapValues(eventsByGap);

  return {
    eventsByGid,
    eventsByGap
  };
}

export async function loadCantillationEventIndex(args: {
  cantillationIrPath: string;
  spineRecords?: readonly SpineRecord[];
  policy?: Partial<WrapperCantillationPolicy>;
}): Promise<CantillationEventIndex> {
  const records = await readCantillationIRJsonl(args.cantillationIrPath);
  return indexCantillationEvents({
    records,
    ...(args.spineRecords ? { spineRecords: args.spineRecords } : {}),
    ...(args.policy ? { policy: args.policy } : {})
  });
}

export function attachCantillationToOp<T extends WrapperProgramOpRecord>(
  op: T,
  index: CantillationEventIndex
): T & { cantillation_events: CantEvent[] } {
  assertNonEmptyString(op.gid, "op.gid");
  const events = index.eventsByGid.get(op.gid) ?? [];
  return {
    ...op,
    cantillation_events: [...events]
  };
}

export function attachCantillationToBoundaryFrame<T extends WrapperBoundaryFrameRecord>(
  frame: T,
  index: CantillationEventIndex
): T & { cantillation_events: CantEvent[] } {
  assertNonEmptyString(frame.gapid, "frame.gapid");
  const events = index.eventsByGap.get(frame.gapid) ?? [];
  return {
    ...frame,
    cantillation_events: [...events]
  };
}
