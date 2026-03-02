import fs from "node:fs/promises";
import path from "node:path";
import { type ResolvedLayoutDatasetEvent } from "./dataset_loader";
import {
  expectedLayoutSource,
  expectedLayoutStrength,
  serializeLayoutIRRecord,
  type LayoutDatasetEventType,
  type LayoutIRRecord
} from "./schema";
import { type GapDescriptor } from "./spine_adapter";

export type ResolvedLayoutEventsByGapid = ReadonlyMap<
  string,
  readonly ResolvedLayoutDatasetEvent[]
>;

export type ExtractLayoutIRArgs = {
  gaps: AsyncIterable<GapDescriptor> | Iterable<GapDescriptor>;
  eventsByGapid: ResolvedLayoutEventsByGapid;
};

export type WriteLayoutIRArgs = ExtractLayoutIRArgs & {
  outputPath: string;
};

export type WriteLayoutIRResult = {
  outputPath: string;
  recordsWritten: number;
};

const DATASET_EVENT_TYPE_ORDER: Readonly<Record<LayoutDatasetEventType, number>> = {
  SETUMA: 0,
  PETUCHA: 1,
  BOOK_BREAK: 2
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareDatasetEventsAtGap(
  left: ResolvedLayoutDatasetEvent,
  right: ResolvedLayoutDatasetEvent
): number {
  const leftRank = DATASET_EVENT_TYPE_ORDER[left.type];
  const rightRank = DATASET_EVENT_TYPE_ORDER[right.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const datasetCmp = compareText(left.meta.dataset_id, right.meta.dataset_id);
  if (datasetCmp !== 0) {
    return datasetCmp;
  }

  const leftNote = left.meta.note ?? "";
  const rightNote = right.meta.note ?? "";
  return compareText(leftNote, rightNote);
}

function assertCanonicalGapOrdering(
  previous: GapDescriptor | null,
  current: GapDescriptor,
  seenRefs: Set<string>
): void {
  if (!previous) {
    seenRefs.add(current.ref_key);
    return;
  }

  if (current.ref_key === previous.ref_key) {
    if (current.gap_index > previous.gap_index) {
      return;
    }
    throw new Error(
      `layout extractor: input gaps must be in canonical ascending order; ` +
        `saw ${current.gapid} after ${previous.gapid}`
    );
  }

  if (!seenRefs.has(current.ref_key)) {
    seenRefs.add(current.ref_key);
    return;
  }

  throw new Error(
    `layout extractor: input gaps must be in canonical ascending order; ` +
      `saw ${current.gapid} after ${previous.gapid}`
  );
}

function assertDatasetEventMatchesGap(event: ResolvedLayoutDatasetEvent, gap: GapDescriptor): void {
  if (
    event.gapid !== gap.gapid ||
    event.ref_key !== gap.ref_key ||
    event.gap_index !== gap.gap_index
  ) {
    throw new Error(
      `layout dataset event invalid: event anchor mismatch for gapid=${event.gapid} ` +
        `(event ${event.ref_key}#${String(event.gap_index)} vs spine ${gap.ref_key}#${String(
          gap.gap_index
        )})`
    );
  }
}

function normalizeAndValidateDatasetEvents(
  gapid: string,
  events: readonly ResolvedLayoutDatasetEvent[]
): ResolvedLayoutDatasetEvent[] {
  if (events.length <= 1) {
    return events.length === 0 ? [] : [events[0]];
  }

  const normalized = [...events].sort(compareDatasetEventsAtGap);
  const seenTypes = new Set<LayoutDatasetEventType>();
  let hasSetuma = false;
  let hasPetucha = false;
  let hasBookBreak = false;

  for (const event of normalized) {
    if (seenTypes.has(event.type)) {
      throw new Error(
        `layout dataset event invalid: duplicate event for gapid=${gapid} type=${event.type}`
      );
    }
    seenTypes.add(event.type);

    if (event.type === "SETUMA") {
      hasSetuma = true;
      continue;
    }
    if (event.type === "PETUCHA") {
      hasPetucha = true;
      continue;
    }
    hasBookBreak = true;
  }

  if (hasSetuma && hasPetucha) {
    throw new Error(`layout dataset event invalid: gapid=${gapid} has both SETUMA and PETUCHA`);
  }
  if (hasBookBreak && (hasSetuma || hasPetucha)) {
    throw new Error(
      `layout dataset event invalid: gapid=${gapid} mixes BOOK_BREAK with SETUMA/PETUCHA`
    );
  }

  return normalized;
}

function spaceRecord(gap: GapDescriptor): LayoutIRRecord {
  return {
    gapid: gap.gapid,
    ref_key: gap.ref_key,
    gap_index: gap.gap_index,
    layout_event: {
      type: "SPACE",
      strength: expectedLayoutStrength("SPACE"),
      source: expectedLayoutSource("SPACE")
    }
  };
}

function datasetRecord(gap: GapDescriptor, event: ResolvedLayoutDatasetEvent): LayoutIRRecord {
  return {
    gapid: gap.gapid,
    ref_key: gap.ref_key,
    gap_index: gap.gap_index,
    layout_event: {
      type: event.type,
      strength: expectedLayoutStrength(event.type),
      source: expectedLayoutSource(event.type),
      meta: {
        dataset_id: event.meta.dataset_id,
        ...(event.meta.note !== undefined ? { note: event.meta.note } : {})
      }
    }
  };
}

export async function* extractLayoutIRRecords(
  args: ExtractLayoutIRArgs
): AsyncGenerator<LayoutIRRecord> {
  const pendingGapids = new Set<string>(args.eventsByGapid.keys());
  let previousGap: GapDescriptor | null = null;
  const seenRefs = new Set<string>();

  for await (const gap of args.gaps) {
    assertCanonicalGapOrdering(previousGap, gap, seenRefs);
    previousGap = gap;
    pendingGapids.delete(gap.gapid);

    const rawEvents = args.eventsByGapid.get(gap.gapid) ?? [];
    const datasetEvents = normalizeAndValidateDatasetEvents(gap.gapid, rawEvents);

    if (gap.whitespace) {
      yield spaceRecord(gap);
    }

    for (const event of datasetEvents) {
      assertDatasetEventMatchesGap(event, gap);
      yield datasetRecord(gap, event);
    }
  }

  if (pendingGapids.size > 0) {
    const firstMissingGapid = [...pendingGapids].sort(compareText)[0] ?? "";
    throw new Error(
      `layout dataset event invalid: gapid=${firstMissingGapid} missing from spine gaps input`
    );
  }
}

export async function writeExtractedLayoutIRJsonl(
  args: WriteLayoutIRArgs
): Promise<WriteLayoutIRResult> {
  await fs.mkdir(path.dirname(args.outputPath), { recursive: true });

  const handle = await fs.open(args.outputPath, "w");
  let recordsWritten = 0;

  try {
    for await (const record of extractLayoutIRRecords(args)) {
      await handle.write(`${serializeLayoutIRRecord(record)}\n`);
      recordsWritten += 1;
    }
  } finally {
    await handle.close();
  }

  return {
    outputPath: args.outputPath,
    recordsWritten
  };
}
