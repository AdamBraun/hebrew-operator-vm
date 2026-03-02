import { type SpineRecord } from "../../spine/schema";
import { compareRefKeysStable, resolveCantillationAnchor } from "./schema";

export const CANTILLATION_PLACEMENT_POLICY_VERSION = 1;

export type DisjMarkPlacementInput = {
  gid: string;
  ref_key: string;
  rank: number;
  mark: string;
};

export type GapCutPlacementTarget = {
  kind: "gap";
  id: string;
  gap_index: number;
};

export type RefEndCutPlacementTarget = {
  kind: "ref_end_gap";
  id: string;
  after_g_index: number;
};

export type DisjCutPlacement = {
  ref_key: string;
  source_gid: string;
  source_mark: string;
  rank: number;
  target: GapCutPlacementTarget | RefEndCutPlacementTarget;
};

type ParsedGid = {
  ref_key: string;
  g_index: number;
};

type IndexedGap = {
  gapid: string;
  gap_index: number;
};

type RefGapIndex = Map<string, IndexedGap[]>;

const REF_END_GAP_SUFFIX = "#ref_end_gap";

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`cantillation placement: ${label} must be non-empty string`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`cantillation placement: ${label} must be integer >= 1`);
  }
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function refEndGapId(ref_key: string): string {
  assertNonEmptyString(ref_key, "ref_key");
  return `${ref_key}${REF_END_GAP_SUFFIX}`;
}

function parseGid(gid: string): ParsedGid {
  const resolved = resolveCantillationAnchor({ kind: "gid", id: gid });
  if (!resolved) {
    throw new Error(`cantillation placement: invalid gid '${gid}'`);
  }
  return {
    ref_key: resolved.ref_key,
    g_index: resolved.index
  };
}

function buildRefGapIndex(spineRecords: readonly SpineRecord[]): RefGapIndex {
  const byRef = new Map<string, Map<number, string>>();

  for (const row of spineRecords) {
    if (row.kind !== "gap") {
      continue;
    }

    const gapsByIndex = byRef.get(row.ref_key) ?? new Map<number, string>();
    const existing = gapsByIndex.get(row.gap_index);
    if (existing !== undefined) {
      throw new Error(
        `cantillation placement: duplicate gap_index=${String(row.gap_index)} in ref_key='${row.ref_key}'`
      );
    }
    gapsByIndex.set(row.gap_index, row.gapid);
    byRef.set(row.ref_key, gapsByIndex);
  }

  const out: RefGapIndex = new Map();
  for (const [ref_key, gapsByIndex] of byRef.entries()) {
    const gaps = [...gapsByIndex.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([gap_index, gapid]) => ({ gap_index, gapid }));
    out.set(ref_key, gaps);
  }
  return out;
}

function placeToNextGap(args: {
  ref_key: string;
  g_index: number;
  refGapIndex: RefGapIndex;
}): GapCutPlacementTarget | RefEndCutPlacementTarget {
  const gaps = args.refGapIndex.get(args.ref_key) ?? [];
  for (const gap of gaps) {
    if (gap.gap_index > args.g_index) {
      return {
        kind: "gap",
        id: gap.gapid,
        gap_index: gap.gap_index
      };
    }
  }
  return {
    kind: "ref_end_gap",
    id: refEndGapId(args.ref_key),
    after_g_index: args.g_index
  };
}

function compareInputsStable(left: DisjMarkPlacementInput, right: DisjMarkPlacementInput): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }

  const leftParsed = parseGid(left.gid);
  const rightParsed = parseGid(right.gid);
  if (leftParsed.g_index !== rightParsed.g_index) {
    return leftParsed.g_index - rightParsed.g_index;
  }

  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  const markCmp = compareText(left.mark, right.mark);
  if (markCmp !== 0) {
    return markCmp;
  }

  return compareText(left.gid, right.gid);
}

function comparePlacementsStable(left: DisjCutPlacement, right: DisjCutPlacement): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }

  const leftTargetOrder = left.target.kind === "gap" ? 0 : 1;
  const rightTargetOrder = right.target.kind === "gap" ? 0 : 1;
  if (leftTargetOrder !== rightTargetOrder) {
    return leftTargetOrder - rightTargetOrder;
  }

  const leftIndex =
    left.target.kind === "gap" ? left.target.gap_index : left.target.after_g_index + 1;
  const rightIndex =
    right.target.kind === "gap" ? right.target.gap_index : right.target.after_g_index + 1;
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  const markCmp = compareText(left.source_mark, right.source_mark);
  if (markCmp !== 0) {
    return markCmp;
  }

  return compareText(left.source_gid, right.source_gid);
}

export function placeDisjCutBoundary(args: {
  input: DisjMarkPlacementInput;
  spineRecords: readonly SpineRecord[];
}): DisjCutPlacement {
  const refGapIndex = buildRefGapIndex(args.spineRecords);
  const [placement] = placeDisjCutBoundaries({
    inputs: [args.input],
    spineRecords: args.spineRecords,
    refGapIndexOverride: refGapIndex
  });
  if (!placement) {
    throw new Error("cantillation placement: internal error producing placement");
  }
  return placement;
}

export function placeDisjCutBoundaries(args: {
  inputs: readonly DisjMarkPlacementInput[];
  spineRecords: readonly SpineRecord[];
  refGapIndexOverride?: RefGapIndex;
}): DisjCutPlacement[] {
  const refGapIndex = args.refGapIndexOverride ?? buildRefGapIndex(args.spineRecords);
  const normalizedInputs = [...args.inputs];

  for (let i = 0; i < normalizedInputs.length; i += 1) {
    const row = normalizedInputs[i];
    assertNonEmptyString(row.gid, `inputs[${String(i)}].gid`);
    assertNonEmptyString(row.ref_key, `inputs[${String(i)}].ref_key`);
    assertPositiveInteger(row.rank, `inputs[${String(i)}].rank`);
    assertNonEmptyString(row.mark, `inputs[${String(i)}].mark`);

    const parsed = parseGid(row.gid);
    if (parsed.ref_key !== row.ref_key) {
      throw new Error(
        `cantillation placement: gid '${row.gid}' must match ref_key='${row.ref_key}'`
      );
    }
  }

  normalizedInputs.sort(compareInputsStable);

  const out: DisjCutPlacement[] = [];
  for (const row of normalizedInputs) {
    const parsed = parseGid(row.gid);
    const target = placeToNextGap({
      ref_key: row.ref_key,
      g_index: parsed.g_index,
      refGapIndex
    });
    out.push({
      ref_key: row.ref_key,
      source_gid: row.gid,
      source_mark: row.mark,
      rank: row.rank,
      target
    });
  }

  return out.sort(comparePlacementsStable);
}
