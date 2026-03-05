import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  LayerAnchorOrderingAccumulator,
  createLayerManifestCore,
  type LayerManifestCore,
  type LayerManifestCoreOrdering
} from "../../ir/layer_manifest_core";
import { extractLayoutIRRecords, type ResolvedLayoutEventsByGapid } from "./extract";
import { computeLayoutDigest, type LayoutConfig } from "./hash";
import { compareLayoutIRRecords, serializeLayoutIRRecord, type LayoutIRRecord } from "./schema";
import { type GapDescriptor } from "./spine_adapter";

export const LAYOUT_MANIFEST_LAYER = "layout";
export const LAYOUT_MANIFEST_VERSION = "1.0.0";

export type LayoutCounts = {
  gapsSeen: number;
  recordsEmitted: number;
  spaceCount: number;
  setumaCount: number;
  petuchaCount: number;
  bookBreakCount: number;
};

export type LayoutManifest = {
  layer: "layout";
  version: string;
  created_at: string;
  digest: string;
  inputs: {
    spineDigest: string;
    layoutDatasetDigest: string;
  };
  code: {
    layoutLayerCodeDigest: string;
  };
  config: LayoutConfig;
  dataset: {
    dataset_id: string;
    version: string;
  };
  counts: LayoutCounts;
  cache_manifest: LayerManifestCore;
};

export type EmitLayoutArgs = {
  gaps: AsyncIterable<GapDescriptor> | Iterable<GapDescriptor>;
  eventsByGapid: ResolvedLayoutEventsByGapid;
  spineDigest: string;
  layoutDatasetDigest: string;
  layoutLayerCodeDigest: string;
  layoutConfig?: LayoutConfig;
  dataset: {
    dataset_id: string;
    version: string;
  };
  outCacheDir?: string;
  digest?: string;
  force?: boolean;
  createdAt?: Date | string;
  manifestVersion?: string;
};

export type EmitLayoutResult = {
  digest: string;
  outputDir: string;
  layoutIrPath: string;
  manifestPath: string;
  manifest: LayoutManifest;
  counts: LayoutCounts;
  cacheHit: boolean;
  forced: boolean;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

function defaultCacheDir(): string {
  return path.resolve(process.cwd(), "outputs", "cache", "layout");
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`emitLayout: ${label} must be lowercase sha256 hex`);
  }
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`emitLayout: ${label} must be non-empty string`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`emitLayout: ${label} must be non-negative integer`);
  }
}

function assertLayoutConfig(value: unknown): asserts value is LayoutConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("emitLayout: layoutConfig must be an object");
  }
}

function toIsoString(value: Date | string | undefined): string {
  if (value === undefined) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("emitLayout: createdAt must be valid ISO date-time");
    }
    return parsed.toISOString();
  }
  throw new Error("emitLayout: createdAt must be Date | string");
}

function initializeCounts(): LayoutCounts {
  return {
    gapsSeen: 0,
    recordsEmitted: 0,
    spaceCount: 0,
    setumaCount: 0,
    petuchaCount: 0,
    bookBreakCount: 0
  };
}

function countRecordType(counts: LayoutCounts, eventType: string): void {
  if (eventType === "SPACE") {
    counts.spaceCount += 1;
    return;
  }
  if (eventType === "SETUMA") {
    counts.setumaCount += 1;
    return;
  }
  if (eventType === "PETUCHA") {
    counts.petuchaCount += 1;
    return;
  }
  if (eventType === "BOOK_BREAK") {
    counts.bookBreakCount += 1;
    return;
  }
}

function assertCounts(counts: LayoutCounts): void {
  assertNonNegativeInteger(counts.gapsSeen, "counts.gapsSeen");
  assertNonNegativeInteger(counts.recordsEmitted, "counts.recordsEmitted");
  assertNonNegativeInteger(counts.spaceCount, "counts.spaceCount");
  assertNonNegativeInteger(counts.setumaCount, "counts.setumaCount");
  assertNonNegativeInteger(counts.petuchaCount, "counts.petuchaCount");
  assertNonNegativeInteger(counts.bookBreakCount, "counts.bookBreakCount");
}

function createLayoutManifest(args: {
  digest: string;
  spineDigest: string;
  layoutDatasetDigest: string;
  layoutLayerCodeDigest: string;
  layoutConfig: LayoutConfig;
  dataset: { dataset_id: string; version: string };
  counts: LayoutCounts;
  outputDigest: string;
  ordering: LayerManifestCoreOrdering;
  createdAt?: Date | string;
  version?: string;
}): LayoutManifest {
  assertSha256Hex(args.digest, "digest");
  assertSha256Hex(args.spineDigest, "inputs.spineDigest");
  assertSha256Hex(args.layoutDatasetDigest, "inputs.layoutDatasetDigest");
  assertNonEmptyString(args.layoutLayerCodeDigest, "code.layoutLayerCodeDigest");
  assertLayoutConfig(args.layoutConfig);
  assertNonEmptyString(args.dataset.dataset_id, "dataset.dataset_id");
  assertNonEmptyString(args.dataset.version, "dataset.version");
  assertCounts(args.counts);
  assertSha256Hex(args.outputDigest, "outputDigest");

  const version = args.version ?? LAYOUT_MANIFEST_VERSION;
  assertNonEmptyString(version, "version");
  const createdAtIso = toIsoString(args.createdAt);

  return {
    layer: LAYOUT_MANIFEST_LAYER,
    version,
    created_at: createdAtIso,
    digest: args.digest,
    inputs: {
      spineDigest: args.spineDigest,
      layoutDatasetDigest: args.layoutDatasetDigest
    },
    code: {
      layoutLayerCodeDigest: args.layoutLayerCodeDigest
    },
    config: args.layoutConfig,
    dataset: {
      dataset_id: args.dataset.dataset_id,
      version: args.dataset.version
    },
    counts: args.counts,
    cache_manifest: createLayerManifestCore({
      layer_name: LAYOUT_MANIFEST_LAYER,
      layer_semver: version,
      input_digests: {
        spineDigest: args.spineDigest,
        datasetDigest: args.layoutDatasetDigest,
        configDigest: sha256Hex(JSON.stringify(args.layoutConfig))
      },
      output_digest: args.outputDigest,
      ir_schema_version: version,
      stats: {
        record_count: args.counts.recordsEmitted,
        gcount: args.counts.recordsEmitted,
        gapcount: args.counts.gapsSeen,
        event_counts: {
          SPACE: args.counts.spaceCount,
          SETUMA: args.counts.setumaCount,
          PETUCHA: args.counts.petuchaCount,
          BOOK_BREAK: args.counts.bookBreakCount
        }
      },
      ordering: args.ordering,
      timestamp: createdAtIso
    })
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readManifestCounts(value: unknown): LayoutCounts {
  if (!isRecord(value)) {
    throw new Error("emitLayout: manifest counts must be an object");
  }
  const counts: LayoutCounts = {
    gapsSeen: Number(value.gapsSeen),
    recordsEmitted: Number(value.recordsEmitted),
    spaceCount: Number(value.spaceCount),
    setumaCount: Number(value.setumaCount),
    petuchaCount: Number(value.petuchaCount),
    bookBreakCount: Number(value.bookBreakCount)
  };
  assertCounts(counts);
  return counts;
}

async function readLayoutManifest(filePath: string): Promise<LayoutManifest> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("emitLayout: manifest must be an object");
  }
  if (parsed.layer !== LAYOUT_MANIFEST_LAYER) {
    throw new Error(`emitLayout: expected manifest.layer='${LAYOUT_MANIFEST_LAYER}'`);
  }
  assertNonEmptyString(parsed.version, "manifest.version");
  assertNonEmptyString(parsed.created_at, "manifest.created_at");
  assertSha256Hex(parsed.digest, "manifest.digest");

  if (!isRecord(parsed.inputs)) {
    throw new Error("emitLayout: manifest.inputs must be an object");
  }
  assertSha256Hex(parsed.inputs.spineDigest, "manifest.inputs.spineDigest");
  assertSha256Hex(parsed.inputs.layoutDatasetDigest, "manifest.inputs.layoutDatasetDigest");

  if (!isRecord(parsed.code)) {
    throw new Error("emitLayout: manifest.code must be an object");
  }
  assertNonEmptyString(parsed.code.layoutLayerCodeDigest, "manifest.code.layoutLayerCodeDigest");

  assertLayoutConfig(parsed.config);
  if (!isRecord(parsed.dataset)) {
    throw new Error("emitLayout: manifest.dataset must be an object");
  }
  assertNonEmptyString(parsed.dataset.dataset_id, "manifest.dataset.dataset_id");
  assertNonEmptyString(parsed.dataset.version, "manifest.dataset.version");
  if (!isRecord(parsed.cache_manifest)) {
    throw new Error("emitLayout: manifest.cache_manifest must be an object");
  }

  return {
    layer: LAYOUT_MANIFEST_LAYER,
    version: parsed.version,
    created_at: parsed.created_at,
    digest: parsed.digest,
    inputs: {
      spineDigest: parsed.inputs.spineDigest,
      layoutDatasetDigest: parsed.inputs.layoutDatasetDigest
    },
    code: {
      layoutLayerCodeDigest: parsed.code.layoutLayerCodeDigest
    },
    config: parsed.config,
    dataset: {
      dataset_id: parsed.dataset.dataset_id,
      version: parsed.dataset.version
    },
    counts: readManifestCounts(parsed.counts),
    cache_manifest: parsed.cache_manifest as LayerManifestCore
  };
}

export async function emitLayout(args: EmitLayoutArgs): Promise<EmitLayoutResult> {
  const layoutConfig = args.layoutConfig ?? {};
  assertLayoutConfig(layoutConfig);

  const digest =
    args.digest ??
    computeLayoutDigest({
      spineDigest: args.spineDigest,
      layoutDatasetDigest: args.layoutDatasetDigest,
      layoutLayerCodeDigest: args.layoutLayerCodeDigest,
      layoutConfig
    });
  assertSha256Hex(digest, "digest");

  const force = args.force === true;
  const cacheDir = args.outCacheDir ?? defaultCacheDir();
  const outputDir = path.join(cacheDir, digest);
  const layoutIrPath = path.join(outputDir, "layout.ir.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");

  const hasCache = (await pathExists(layoutIrPath)) && (await pathExists(manifestPath));
  if (hasCache && !force) {
    try {
      const manifest = await readLayoutManifest(manifestPath);
      return {
        digest,
        outputDir,
        layoutIrPath,
        manifestPath,
        manifest,
        counts: manifest.counts,
        cacheHit: true,
        forced: false
      };
    } catch {
      // Invalid/stale manifest: rebuild and overwrite cache entry.
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  const counts = initializeCounts();
  const orderingAccumulator = new LayerAnchorOrderingAccumulator();
  let previousOutputRecord: LayoutIRRecord | null = null;
  const countGaps = async function* (): AsyncGenerator<GapDescriptor> {
    for await (const gap of args.gaps) {
      counts.gapsSeen += 1;
      yield gap;
    }
  };

  const handle = await fs.open(layoutIrPath, "w");
  try {
    for await (const record of extractLayoutIRRecords({
      gaps: countGaps(),
      eventsByGapid: args.eventsByGapid
    })) {
      if (previousOutputRecord && compareLayoutIRRecords(previousOutputRecord, record) >= 0) {
        throw new Error(
          "emitLayout: non-canonical output ordering at " +
            `gapid='${record.gapid}' after gapid='${previousOutputRecord.gapid}'`
        );
      }
      await handle.write(`${serializeLayoutIRRecord(record)}\n`);
      orderingAccumulator.push(`gap:${record.gapid}`);
      previousOutputRecord = record;
      counts.recordsEmitted += 1;
      countRecordType(counts, record.layout_event.type);
    }
  } finally {
    await handle.close();
  }

  const manifest = createLayoutManifest({
    digest,
    spineDigest: args.spineDigest,
    layoutDatasetDigest: args.layoutDatasetDigest,
    layoutLayerCodeDigest: args.layoutLayerCodeDigest,
    layoutConfig,
    dataset: args.dataset,
    counts,
    outputDigest: sha256Hex(await fs.readFile(layoutIrPath)),
    ordering: orderingAccumulator.finalize(),
    createdAt: args.createdAt,
    version: args.manifestVersion
  });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    digest,
    outputDir,
    layoutIrPath,
    manifestPath,
    manifest,
    counts,
    cacheHit: false,
    forced: force
  };
}
