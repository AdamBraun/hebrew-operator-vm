import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createSpineManifest, type SpineManifest } from "./manifest";
import { normalizeOptions, type NormalizationOptions } from "./options";
import { assertSpineRecord, type SpineRecord } from "./schema";

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
  const records = await collectRecords(args.records);
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
