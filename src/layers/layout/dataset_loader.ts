import fs from "node:fs/promises";
import {
  assertLayoutDataset,
  compareRefKeysStable,
  type LayoutDataset,
  type LayoutDatasetEventType
} from "./schema";
import { getGapId, type GapProjectionIndex } from "./spine_adapter";

export type ResolvedLayoutDatasetEvent = {
  gapid: string;
  ref_key: string;
  gap_index: number;
  type: LayoutDatasetEventType;
  meta: {
    dataset_id: string;
    note?: string;
  };
};

export type ResolvedLayoutDataset = {
  dataset: LayoutDataset;
  events: ResolvedLayoutDatasetEvent[];
  eventsByGapid: Map<string, ResolvedLayoutDatasetEvent[]>;
};

type ResolveLayoutDatasetEventsArgs = {
  dataset: LayoutDataset;
  spineProjection: GapProjectionIndex;
};

const DATASET_EVENT_TYPE_ORDER: Readonly<Record<LayoutDatasetEventType, number>> = {
  SETUMA: 0,
  PETUCHA: 1,
  BOOK_BREAK: 2
};

function compareResolvedEvent(
  left: ResolvedLayoutDatasetEvent,
  right: ResolvedLayoutDatasetEvent
): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.gap_index !== right.gap_index) {
    return left.gap_index - right.gap_index;
  }
  const leftTypeRank = DATASET_EVENT_TYPE_ORDER[left.type];
  const rightTypeRank = DATASET_EVENT_TYPE_ORDER[right.type];
  if (leftTypeRank !== rightTypeRank) {
    return leftTypeRank - rightTypeRank;
  }
  if (left.gapid !== right.gapid) {
    return left.gapid < right.gapid ? -1 : 1;
  }
  return 0;
}

function outOfRangeError(ref_key: string, gap_index: number, max: number): Error {
  return new Error(
    `layout dataset event invalid: ${ref_key} gap_index=${String(gap_index)} out of range (max=${String(max)})`
  );
}

function buildEventsByGapid(
  events: readonly ResolvedLayoutDatasetEvent[]
): Map<string, ResolvedLayoutDatasetEvent[]> {
  const out = new Map<string, ResolvedLayoutDatasetEvent[]>();
  for (const event of events) {
    const existing = out.get(event.gapid);
    if (existing) {
      existing.push(event);
      continue;
    }
    out.set(event.gapid, [event]);
  }
  return out;
}

export async function loadLayoutDatasetFromFile(datasetPath: string): Promise<LayoutDataset> {
  const raw = await fs.readFile(datasetPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`layout dataset parse error (${datasetPath}): ${message}`);
  }

  assertLayoutDataset(parsed);
  return parsed;
}

export function resolveLayoutDatasetEvents(
  args: ResolveLayoutDatasetEventsArgs
): ResolvedLayoutDatasetEvent[] {
  const { dataset, spineProjection } = args;
  const out: ResolvedLayoutDatasetEvent[] = [];
  const seen = new Set<string>();

  for (const event of dataset.events) {
    const ref_key = event.ref_key;
    const gap_index = event.anchor.gap_index;

    const maxGapIndex = spineProjection.maxGapIndexByRef.get(ref_key);
    if (maxGapIndex === undefined) {
      throw outOfRangeError(ref_key, gap_index, -1);
    }
    if (gap_index > maxGapIndex) {
      throw outOfRangeError(ref_key, gap_index, maxGapIndex);
    }

    const gapid = getGapId(spineProjection, ref_key, gap_index);
    if (!gapid) {
      throw outOfRangeError(ref_key, gap_index, maxGapIndex);
    }

    const duplicateKey = `${gapid}\u0000${event.type}`;
    if (seen.has(duplicateKey)) {
      throw new Error(
        `layout dataset event invalid: duplicate event for gapid=${gapid} type=${event.type}`
      );
    }
    seen.add(duplicateKey);

    out.push({
      gapid,
      ref_key,
      gap_index,
      type: event.type,
      meta: {
        dataset_id: dataset.dataset_id,
        ...(event.note ? { note: event.note } : {})
      }
    });
  }

  out.sort(compareResolvedEvent);
  return out;
}

export async function loadAndResolveLayoutDataset(
  datasetPath: string,
  spineProjection: GapProjectionIndex
): Promise<ResolvedLayoutDataset> {
  const dataset = await loadLayoutDatasetFromFile(datasetPath);
  const events = resolveLayoutDatasetEvents({ dataset, spineProjection });

  return {
    dataset,
    events,
    eventsByGapid: buildEventsByGapid(events)
  };
}
