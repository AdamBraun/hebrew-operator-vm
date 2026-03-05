import { assertRefKey, type RefKey } from "../../ir/refkey";
import type { RefPlanIndexRange, SpineTraversalPlan } from "./spinePlan";

type UnknownRecord = Record<string, unknown>;

export type AttachedMetadataCheckpoint = {
  kind: string;
  parasha_id: string | null;
  aliyah_index: number | null;
  plan_index_end: number;
  ref_key_end: RefKey;
  checkpoint_id?: string;
};

export type AttachedMetadataCheckpointIndex = {
  checkpoints: AttachedMetadataCheckpoint[];
  checkpointsByRefEnd: Record<string, AttachedMetadataCheckpoint[]>;
  checkpointsByIndex: Record<string, AttachedMetadataCheckpoint[]>;
  refIndexByRef: Record<string, RefPlanIndexRange>;
};

function fail(pathLabel: string, message: string): never {
  throw new Error(`metadata attach invalid at ${pathLabel}: ${message}`);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function getCheckpointRefEnd(checkpoint: UnknownRecord, pathLabel: string): RefKey {
  const maybeRef = checkpoint.ref_key_end ?? checkpoint.ref_end;
  if (typeof maybeRef !== "string") {
    fail(pathLabel, "checkpoint must include string ref_key_end (or legacy ref_end)");
  }

  try {
    assertRefKey(maybeRef, `${pathLabel}.ref_key_end`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(pathLabel, message);
  }

  return maybeRef;
}

function getCheckpointKind(checkpoint: UnknownRecord): string {
  return typeof checkpoint.kind === "string" ? checkpoint.kind : "CHECKPOINT";
}

function getCheckpointParashaId(checkpoint: UnknownRecord): string | null {
  return typeof checkpoint.parasha_id === "string" ? checkpoint.parasha_id : null;
}

function getCheckpointAliyahIndex(checkpoint: UnknownRecord): number | null {
  if (checkpoint.aliyah_index === null || checkpoint.aliyah_index === undefined) {
    return null;
  }
  if (
    typeof checkpoint.aliyah_index === "number" &&
    Number.isInteger(checkpoint.aliyah_index) &&
    checkpoint.aliyah_index >= 0
  ) {
    return checkpoint.aliyah_index;
  }
  return null;
}

function getCheckpointId(checkpoint: UnknownRecord): string | undefined {
  return typeof checkpoint.checkpoint_id === "string" ? checkpoint.checkpoint_id : undefined;
}

function normalizeRefIndex(
  refIndexByRef: ReadonlyMap<string, RefPlanIndexRange>
): Record<string, RefPlanIndexRange> {
  const out: Record<string, RefPlanIndexRange> = {};
  const sortedKeys = [...refIndexByRef.keys()].sort(compareText);

  for (const refKey of sortedKeys) {
    const range = refIndexByRef.get(refKey);
    if (!range) {
      continue;
    }
    out[refKey] = {
      startPlanIndex: range.startPlanIndex,
      endPlanIndex: range.endPlanIndex
    };
  }

  return out;
}

function compareAttachedCheckpoint(
  left: AttachedMetadataCheckpoint,
  right: AttachedMetadataCheckpoint
): number {
  if (left.plan_index_end !== right.plan_index_end) {
    return left.plan_index_end - right.plan_index_end;
  }

  const kindCmp = compareText(left.kind, right.kind);
  if (kindCmp !== 0) {
    return kindCmp;
  }

  const leftParasha = left.parasha_id ?? "";
  const rightParasha = right.parasha_id ?? "";
  const parashaCmp = compareText(leftParasha, rightParasha);
  if (parashaCmp !== 0) {
    return parashaCmp;
  }

  const leftAliyah = left.aliyah_index ?? 0;
  const rightAliyah = right.aliyah_index ?? 0;
  if (leftAliyah !== rightAliyah) {
    return leftAliyah - rightAliyah;
  }

  const refCmp = compareText(left.ref_key_end, right.ref_key_end);
  if (refCmp !== 0) {
    return refCmp;
  }

  return compareText(left.checkpoint_id ?? "", right.checkpoint_id ?? "");
}

export function attachMetadataCheckpoints(args: {
  spinePlan: SpineTraversalPlan;
  metadataPlan: unknown;
}): AttachedMetadataCheckpointIndex {
  const refIndexByRef = normalizeRefIndex(args.spinePlan.refIndexByRef);
  const metadataPlan = args.metadataPlan;

  if (!isRecord(metadataPlan)) {
    fail("$.metadataPlan", "expected metadata plan object");
  }

  const checkpointsRaw = Array.isArray(metadataPlan.checkpoints) ? metadataPlan.checkpoints : [];
  const checkpoints: AttachedMetadataCheckpoint[] = [];

  for (let i = 0; i < checkpointsRaw.length; i += 1) {
    const pathLabel = `$.metadataPlan.checkpoints[${String(i)}]`;
    const rawCheckpoint = checkpointsRaw[i];
    if (!isRecord(rawCheckpoint)) {
      fail(pathLabel, "checkpoint must be object");
    }

    const refKeyEnd = getCheckpointRefEnd(rawCheckpoint, pathLabel);
    const refRange = refIndexByRef[refKeyEnd];
    if (!refRange) {
      fail(pathLabel, `checkpoint ref '${refKeyEnd}' does not exist in spine ref index`);
    }

    checkpoints.push({
      kind: getCheckpointKind(rawCheckpoint),
      parasha_id: getCheckpointParashaId(rawCheckpoint),
      aliyah_index: getCheckpointAliyahIndex(rawCheckpoint),
      plan_index_end: refRange.endPlanIndex,
      ref_key_end: refKeyEnd,
      ...(getCheckpointId(rawCheckpoint) ? { checkpoint_id: getCheckpointId(rawCheckpoint) } : {})
    });
  }

  checkpoints.sort(compareAttachedCheckpoint);

  const checkpointsByRefEnd: Record<string, AttachedMetadataCheckpoint[]> = {};
  const checkpointsByIndex: Record<string, AttachedMetadataCheckpoint[]> = {};

  for (const checkpoint of checkpoints) {
    const byRef = checkpointsByRefEnd[checkpoint.ref_key_end] ?? [];
    byRef.push(checkpoint);
    checkpointsByRefEnd[checkpoint.ref_key_end] = byRef;

    const indexKey = String(checkpoint.plan_index_end);
    const byIndex = checkpointsByIndex[indexKey] ?? [];
    byIndex.push(checkpoint);
    checkpointsByIndex[indexKey] = byIndex;
  }

  return {
    checkpoints,
    checkpointsByRefEnd,
    checkpointsByIndex,
    refIndexByRef
  };
}
