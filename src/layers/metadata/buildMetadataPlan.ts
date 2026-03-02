import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  METADATA_PLAN_CYCLE,
  METADATA_PLAN_IR_VERSION,
  METADATA_PLAN_REF_ORDER_SOURCE,
  METADATA_PLAN_SCOPE,
  formatMetadataCheckpointId,
  type MetadataPlanCheckpoint,
  type MetadataPlanIR,
  type MetadataPlanRangeSegment
} from "../../ir/metadata_ir";
import { compareRefKeysCanonical, type RefKey } from "../../ir/refkey";
import { extractRefOrder } from "./extractRefOrder";
import { normalizePlanDataset } from "./normalizePlanDataset";
import { ALIYOT_PER_PARASHA, type Torah1YPlanDataset } from "./validatePlanDataset";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export type BuildMetadataPlanArgs = {
  dataset?: unknown;
  datasetPath?: string;
  refOrder?: readonly RefKey[];
  generatedAt?: Date | string;
  includeParashot?: boolean;
  includeRanges?: boolean;
};

export const DEFAULT_METADATA_DATASET_PATH = path.resolve(
  process.cwd(),
  "src",
  "layers",
  "metadata",
  "datasets",
  "torah_1y_plan.v1.json"
);

function fail(pathLabel: string, message: string): never {
  throw new Error(`metadata plan build invalid at ${pathLabel}: ${message}`);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function toCanonicalJsonValue(value: unknown): CanonicalJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = toCanonicalJsonValue(entry);
      return normalized === undefined ? null : normalized;
    });
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(source).sort(compareText)) {
      const normalized = toCanonicalJsonValue(source[key]);
      if (normalized !== undefined) {
        out[key] = normalized;
      }
    }
    return out;
  }
  return undefined;
}

function canonicalStringify(value: unknown): string {
  const normalized = toCanonicalJsonValue(value);
  return JSON.stringify(normalized === undefined ? null : normalized);
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeGeneratedAt(value: Date | string | undefined): string {
  if (value === undefined) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    if (Number.isNaN(Date.parse(iso))) {
      fail("$.generated_at", "expected valid Date");
    }
    return iso;
  }
  if (typeof value === "string") {
    if (Number.isNaN(Date.parse(value))) {
      fail("$.generated_at", `expected valid ISO date-time string, got ${JSON.stringify(value)}`);
    }
    return new Date(value).toISOString();
  }
  fail("$.generated_at", `unsupported type ${typeof value}`);
}

function compareNumber(left: number, right: number): number {
  return left - right;
}

function buildRefOrderIndex(refOrder: readonly RefKey[]): {
  indexByRef: Map<RefKey, number>;
  refs: RefKey[];
} {
  if (refOrder.length === 0) {
    fail("$.refOrder", "expected non-empty ref order");
  }

  const indexByRef = new Map<RefKey, number>();
  const refs: RefKey[] = [];
  let previous: RefKey | null = null;

  for (let i = 0; i < refOrder.length; i += 1) {
    const ref = refOrder[i];
    if (indexByRef.has(ref)) {
      fail("$.refOrder", `duplicate ref '${ref}' at index ${String(i)}`);
    }
    if (previous && compareRefKeysCanonical(previous, ref) >= 0) {
      fail(
        "$.refOrder",
        `ref order must be strict canonical corpus order; saw '${ref}' after '${previous}'`
      );
    }
    indexByRef.set(ref, i);
    refs.push(ref);
    previous = ref;
  }

  return { indexByRef, refs };
}

function getOrdinal(
  indexByRef: ReadonlyMap<RefKey, number>,
  ref: RefKey,
  pathLabel: string
): number {
  const ordinal = indexByRef.get(ref);
  if (ordinal === undefined) {
    fail(pathLabel, `ref '${ref}' not found in corpus ref order`);
  }
  return ordinal;
}

function validateParashaCoverage(
  dataset: Torah1YPlanDataset,
  indexByRef: ReadonlyMap<RefKey, number>,
  refsByOrdinal: readonly RefKey[]
): void {
  const coveredByParasha = new Array<boolean>(refsByOrdinal.length).fill(false);

  for (let parashaIndex = 0; parashaIndex < dataset.parashot.length; parashaIndex += 1) {
    const parasha = dataset.parashot[parashaIndex];
    const parashaPath = `$.parashot[${String(parashaIndex)}]`;
    const parashaStart = getOrdinal(indexByRef, parasha.range.start, `${parashaPath}.range.start`);
    const parashaEnd = getOrdinal(indexByRef, parasha.range.end, `${parashaPath}.range.end`);

    if (parashaStart > parashaEnd) {
      fail(
        `${parashaPath}.range`,
        `range goes backwards in corpus order: '${parasha.range.start}'..'${parasha.range.end}'`
      );
    }

    const coveredByAliyah = new Array<boolean>(parashaEnd - parashaStart + 1).fill(false);

    const sortedAliyot = [...parasha.aliyot].sort((left, right) =>
      compareNumber(left.aliyah_index, right.aliyah_index)
    );
    if (sortedAliyot.length !== ALIYOT_PER_PARASHA) {
      fail(
        `${parashaPath}.aliyot`,
        `expected ${String(ALIYOT_PER_PARASHA)} aliyot, got ${String(sortedAliyot.length)}`
      );
    }

    for (let aliyahIndex = 0; aliyahIndex < sortedAliyot.length; aliyahIndex += 1) {
      const aliyah = sortedAliyot[aliyahIndex];
      const aliyahPath = `${parashaPath}.aliyot[aliyah_index=${String(aliyah.aliyah_index)}]`;

      const startOrdinal = getOrdinal(indexByRef, aliyah.range.start, `${aliyahPath}.range.start`);
      const endOrdinal = getOrdinal(indexByRef, aliyah.range.end, `${aliyahPath}.range.end`);

      if (startOrdinal > endOrdinal) {
        fail(
          `${aliyahPath}.range`,
          `range goes backwards in corpus order: '${aliyah.range.start}'..'${aliyah.range.end}'`
        );
      }
      if (startOrdinal < parashaStart || endOrdinal > parashaEnd) {
        fail(
          `${aliyahPath}.range`,
          `range '${aliyah.range.start}'..'${aliyah.range.end}' is outside parasha range ` +
            `'${parasha.range.start}'..'${parasha.range.end}'`
        );
      }

      for (
        let absoluteOrdinal = startOrdinal;
        absoluteOrdinal <= endOrdinal;
        absoluteOrdinal += 1
      ) {
        const localOrdinal = absoluteOrdinal - parashaStart;
        if (coveredByAliyah[localOrdinal]) {
          const ref = refsByOrdinal[absoluteOrdinal];
          fail(
            `${aliyahPath}.range`,
            `aliyot overlap inside parasha '${parasha.parasha_id}' at ordinal ${String(absoluteOrdinal)}${
              ref ? ` (${ref})` : ""
            }`
          );
        }
        coveredByAliyah[localOrdinal] = true;
      }
    }

    for (let localOrdinal = 0; localOrdinal < coveredByAliyah.length; localOrdinal += 1) {
      if (!coveredByAliyah[localOrdinal]) {
        const absoluteOrdinal = parashaStart + localOrdinal;
        const ref = refsByOrdinal[absoluteOrdinal];
        fail(
          `${parashaPath}.aliyot`,
          `aliyot do not fully partition parasha range; missing coverage at ordinal ` +
            `${String(absoluteOrdinal)}${ref ? ` (${ref})` : ""}`
        );
      }
    }

    for (let absoluteOrdinal = parashaStart; absoluteOrdinal <= parashaEnd; absoluteOrdinal += 1) {
      if (coveredByParasha[absoluteOrdinal]) {
        const ref = refsByOrdinal[absoluteOrdinal];
        fail(
          `${parashaPath}.range`,
          `parasha ranges overlap at ordinal ${String(absoluteOrdinal)}${ref ? ` (${ref})` : ""}`
        );
      }
      coveredByParasha[absoluteOrdinal] = true;
    }
  }

  for (let ordinal = 0; ordinal < coveredByParasha.length; ordinal += 1) {
    if (!coveredByParasha[ordinal]) {
      const ref = refsByOrdinal[ordinal];
      fail(
        "$.parashot",
        `parashot do not cover full corpus ref order; missing ref at ordinal ${String(ordinal)}${
          ref ? ` (${ref})` : ""
        }`
      );
    }
  }
}

function buildCheckpoints(
  dataset: Torah1YPlanDataset,
  indexByRef: ReadonlyMap<RefKey, number>
): MetadataPlanCheckpoint[] {
  const checkpoints: MetadataPlanCheckpoint[] = [];

  for (const parasha of dataset.parashot) {
    for (const aliyah of parasha.aliyot) {
      const ref_key_end = aliyah.range.end;
      const ordinal = getOrdinal(
        indexByRef,
        ref_key_end,
        `$.parashot[${parasha.parasha_id}].aliyot[${String(aliyah.aliyah_index)}].range.end`
      );
      checkpoints.push({
        checkpoint_id: formatMetadataCheckpointId({
          kind: "ALIYAH_END",
          parasha_id: parasha.parasha_id,
          aliyah_index: aliyah.aliyah_index,
          ref_key_end
        }),
        kind: "ALIYAH_END",
        parasha_id: parasha.parasha_id,
        aliyah_index: aliyah.aliyah_index as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        ref_key_end,
        ordinal
      });
    }

    const parashaRefEnd = parasha.range.end;
    const parashaOrdinal = getOrdinal(
      indexByRef,
      parashaRefEnd,
      `$.parashot[${parasha.parasha_id}].range.end`
    );
    checkpoints.push({
      checkpoint_id: formatMetadataCheckpointId({
        kind: "PARASHA_END",
        parasha_id: parasha.parasha_id,
        aliyah_index: null,
        ref_key_end: parashaRefEnd
      }),
      kind: "PARASHA_END",
      parasha_id: parasha.parasha_id,
      aliyah_index: null,
      ref_key_end: parashaRefEnd,
      ordinal: parashaOrdinal
    });
  }

  checkpoints.sort((left, right) => {
    if (left.ordinal !== right.ordinal) {
      return left.ordinal - right.ordinal;
    }

    if (left.kind !== right.kind) {
      return left.kind === "ALIYAH_END" ? -1 : 1;
    }

    const parashaCmp = compareText(left.parasha_id, right.parasha_id);
    if (parashaCmp !== 0) {
      return parashaCmp;
    }

    const leftAliyah = left.aliyah_index ?? 0;
    const rightAliyah = right.aliyah_index ?? 0;
    if (leftAliyah !== rightAliyah) {
      return leftAliyah - rightAliyah;
    }

    return compareText(left.ref_key_end, right.ref_key_end);
  });

  for (let i = 1; i < checkpoints.length; i += 1) {
    const prev = checkpoints[i - 1];
    const curr = checkpoints[i];

    if (curr.ordinal < prev.ordinal) {
      fail("$.checkpoints", `non-monotone ordinals at indexes ${String(i - 1)} and ${String(i)}`);
    }

    if (curr.ordinal === prev.ordinal) {
      const validTie =
        prev.kind === "ALIYAH_END" &&
        prev.aliyah_index === 7 &&
        curr.kind === "PARASHA_END" &&
        curr.parasha_id === prev.parasha_id &&
        curr.ref_key_end === prev.ref_key_end &&
        curr.aliyah_index === null;

      if (!validTie) {
        fail(
          "$.checkpoints",
          `duplicate ordinal ${String(curr.ordinal)} is only allowed for ` +
            `ALIYAH_END(7) + PARASHA_END at same parasha/ref`
        );
      }
    }
  }

  return checkpoints;
}

function buildRanges(
  dataset: Torah1YPlanDataset,
  indexByRef: ReadonlyMap<RefKey, number>
): MetadataPlanRangeSegment[] {
  const out: MetadataPlanRangeSegment[] = [];

  for (const parasha of dataset.parashot) {
    for (const aliyah of parasha.aliyot) {
      out.push({
        segment_id: `ALIYAH:${parasha.parasha_id}:${String(aliyah.aliyah_index)}`,
        kind: "ALIYAH",
        parasha_id: parasha.parasha_id,
        aliyah_index: aliyah.aliyah_index as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        start: aliyah.range.start,
        end: aliyah.range.end,
        ordinal_start: getOrdinal(indexByRef, aliyah.range.start, "$.ranges"),
        ordinal_end: getOrdinal(indexByRef, aliyah.range.end, "$.ranges")
      });
    }

    out.push({
      segment_id: `PARASHA:${parasha.parasha_id}`,
      kind: "PARASHA",
      parasha_id: parasha.parasha_id,
      aliyah_index: null,
      start: parasha.range.start,
      end: parasha.range.end,
      ordinal_start: getOrdinal(indexByRef, parasha.range.start, "$.ranges"),
      ordinal_end: getOrdinal(indexByRef, parasha.range.end, "$.ranges")
    });
  }

  out.sort((left, right) => {
    if (left.ordinal_start !== right.ordinal_start) {
      return left.ordinal_start - right.ordinal_start;
    }
    if (left.kind !== right.kind) {
      return left.kind === "ALIYAH" ? -1 : 1;
    }
    const parashaCmp = compareText(left.parasha_id, right.parasha_id);
    if (parashaCmp !== 0) {
      return parashaCmp;
    }
    const leftAliyah = left.aliyah_index ?? 0;
    const rightAliyah = right.aliyah_index ?? 0;
    if (leftAliyah !== rightAliyah) {
      return leftAliyah - rightAliyah;
    }
    return compareText(left.segment_id, right.segment_id);
  });

  return out;
}

async function loadDatasetFromPath(datasetPath: string): Promise<unknown> {
  const text = await fs.readFile(datasetPath, "utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`metadata plan build invalid at ${datasetPath}: invalid JSON (${message})`);
  }
}

function buildPlanDigest(dataset: Torah1YPlanDataset, refOrder: readonly RefKey[]): string {
  const digestPayload = {
    ir_version: METADATA_PLAN_IR_VERSION,
    ref_order_source: METADATA_PLAN_REF_ORDER_SOURCE,
    dataset,
    ref_order: refOrder
  };
  return sha256Hex(canonicalStringify(digestPayload));
}

export async function buildMetadataPlan(args: BuildMetadataPlanArgs = {}): Promise<MetadataPlanIR> {
  const includeParashot = args.includeParashot ?? true;
  const includeRanges = args.includeRanges ?? false;

  const datasetRaw =
    args.dataset === undefined
      ? await loadDatasetFromPath(args.datasetPath ?? DEFAULT_METADATA_DATASET_PATH)
      : args.dataset;

  const normalizedDataset = normalizePlanDataset(datasetRaw);

  const refOrder = args.refOrder ? [...args.refOrder] : await extractRefOrder();
  const { indexByRef, refs } = buildRefOrderIndex(refOrder);

  validateParashaCoverage(normalizedDataset, indexByRef, refs);

  const checkpoints = buildCheckpoints(normalizedDataset, indexByRef);
  const generated_at = normalizeGeneratedAt(args.generatedAt);
  const plan_digest = buildPlanDigest(normalizedDataset, refs);

  const out: MetadataPlanIR = {
    ir_version: METADATA_PLAN_IR_VERSION,
    dataset_id: normalizedDataset.dataset_id,
    scope: METADATA_PLAN_SCOPE,
    cycle: METADATA_PLAN_CYCLE,
    ref_order_source: METADATA_PLAN_REF_ORDER_SOURCE,
    generated_at,
    plan_digest,
    checkpoints
  };

  if (includeParashot) {
    out.parashot = normalizedDataset.parashot.map((parasha) => ({
      parasha_id: parasha.parasha_id,
      parasha_name_he: parasha.parasha_name_he,
      parasha_name_en: parasha.parasha_name_en,
      range: parasha.range,
      aliyot: parasha.aliyot.map((aliyah) => ({
        aliyah_index: aliyah.aliyah_index as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        range: aliyah.range
      }))
    }));
  }

  if (includeRanges) {
    out.ranges = buildRanges(normalizedDataset, indexByRef);
  }

  return out;
}
