import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createSpineManifest, type SpineManifest } from "./manifest";
import { normalizeOptions, type NormalizationOptions } from "./options";
import { assertSpineRecord, type SpineRecord } from "./schema";
import { LayerAnchorOrderingAccumulator } from "../ir/layer_manifest_core";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export type EmitSpineArgs = {
  records: Iterable<SpineRecord> | AsyncIterable<SpineRecord>;
  input: {
    path: string;
    sha256: string;
  };
  options: Partial<NormalizationOptions>;
  spineDigest?: string;
  outCacheDir?: string;
  createdAt?: Date | string;
  manifestVersion?: string;
  spineRecordVersion?: string;
};

export type EmitSpineResult = {
  spineDigest: string;
  outputDir: string;
  spinePath: string;
  manifestPath: string;
  manifest: SpineManifest;
  stats: {
    refs: number;
    graphemes: number;
    gaps: number;
    bytes_out: number;
  };
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function normalizeRefSegment(
  segment: string
): { kind: "int"; value: number } | { kind: "text"; value: string } {
  if (/^[0-9]+$/.test(segment)) {
    return { kind: "int", value: Number(segment) };
  }
  return { kind: "text", value: segment };
}

const TORAH_BOOK_ORDER: Readonly<Record<string, number>> = {
  Genesis: 0,
  Exodus: 1,
  Leviticus: 2,
  Numbers: 3,
  Deuteronomy: 4
};

function compareTorahBookSegment(left: string, right: string): number | null {
  const leftOrder = TORAH_BOOK_ORDER[left];
  const rightOrder = TORAH_BOOK_ORDER[right];
  if (leftOrder === undefined || rightOrder === undefined) {
    return null;
  }
  if (leftOrder === rightOrder) {
    return 0;
  }
  return leftOrder - rightOrder;
}

function compareRefKeysStable(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftParts = left.split("/");
  const rightParts = right.split("/");
  const len = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < len; i += 1) {
    const l = leftParts[i];
    const r = rightParts[i];
    if (l === undefined) {
      return -1;
    }
    if (r === undefined) {
      return 1;
    }
    if (l === r) {
      continue;
    }
    if (i === 0) {
      const bookCmp = compareTorahBookSegment(l, r);
      if (bookCmp !== null) {
        if (bookCmp !== 0) {
          return bookCmp;
        }
        continue;
      }
    }

    const ln = normalizeRefSegment(l);
    const rn = normalizeRefSegment(r);
    if (ln.kind === "int" && rn.kind === "int") {
      if (ln.value !== rn.value) {
        return ln.value - rn.value;
      }
      continue;
    }
    if (ln.kind !== rn.kind) {
      return ln.kind === "text" ? -1 : 1;
    }
    return compareText(String(ln.value), String(rn.value));
  }
  return 0;
}

function compareSpineRecords(left: SpineRecord, right: SpineRecord): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }

  const leftIndex = left.kind === "g" ? left.g_index : left.gap_index;
  const rightIndex = right.kind === "g" ? right.g_index : right.gap_index;
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  if (left.kind !== right.kind) {
    return left.kind === "gap" ? -1 : 1;
  }
  if (left.kind === "gap" && right.kind === "gap") {
    return compareText(left.gapid, right.gapid);
  }
  if (left.kind === "g" && right.kind === "g") {
    return compareText(left.gid, right.gid);
  }
  throw new Error("emitSpine: unexpected mixed spine kinds after canonical ordering check");
}

function spineAnchor(record: SpineRecord): string {
  if (record.kind === "gap") {
    return `gap:${record.gapid}`;
  }
  return `gid:${record.gid}`;
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

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertSha256Hex(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`emitSpine: ${label} must be lowercase sha256 hex`);
  }
}

function defaultCacheDir(): string {
  return path.resolve(process.cwd(), "outputs", "cache", "spine");
}

function toJsonl(records: readonly SpineRecord[]): string {
  if (records.length === 0) {
    return "";
  }
  return `${records.map((record) => canonicalStringify(record)).join("\n")}\n`;
}

async function collectRecords(
  source: Iterable<SpineRecord> | AsyncIterable<SpineRecord>
): Promise<SpineRecord[]> {
  const out: SpineRecord[] = [];
  for await (const record of source) {
    assertSpineRecord(record);
    out.push(record);
  }
  return out;
}

function collectStats(records: readonly SpineRecord[], bytesOut: number): EmitSpineResult["stats"] {
  const refs = new Set<string>();
  let graphemes = 0;
  let gaps = 0;
  for (const record of records) {
    refs.add(record.ref_key);
    if (record.kind === "g") {
      graphemes += 1;
    } else {
      gaps += 1;
    }
  }
  return {
    refs: refs.size,
    graphemes,
    gaps,
    bytes_out: bytesOut
  };
}

export async function emitSpine(args: EmitSpineArgs): Promise<EmitSpineResult> {
  const options = normalizeOptions(args.options);
  const configDigest = sha256Hex(Buffer.from(canonicalStringify(options), "utf8"));
  const records = await collectRecords(args.records);
  records.sort(compareSpineRecords);

  const orderingAccumulator = new LayerAnchorOrderingAccumulator();
  for (const record of records) {
    orderingAccumulator.push(spineAnchor(record));
  }
  const ordering = orderingAccumulator.finalize();

  const jsonl = toJsonl(records);
  const bytesOut = Buffer.byteLength(jsonl, "utf8");
  const computedDigest = sha256Hex(Buffer.from(jsonl, "utf8"));
  const spineDigest = args.spineDigest ?? computedDigest;
  assertSha256Hex(spineDigest, "spineDigest");

  const cacheDir = args.outCacheDir ?? defaultCacheDir();
  const outputDir = path.join(cacheDir, spineDigest);
  await fs.mkdir(outputDir, { recursive: true });

  const spinePath = path.join(outputDir, "spine.jsonl");
  await fs.writeFile(spinePath, jsonl, "utf8");

  const stats = collectStats(records, bytesOut);
  const manifest = createSpineManifest({
    version: args.manifestVersion,
    createdAt: args.createdAt,
    input: args.input,
    options,
    stats,
    digests: { spineDigest },
    configDigest,
    ordering,
    schema: args.spineRecordVersion ? { spine_record_version: args.spineRecordVersion } : undefined
  });

  const manifestPath = path.join(outputDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    spineDigest,
    outputDir,
    spinePath,
    manifestPath,
    manifest,
    stats
  };
}
