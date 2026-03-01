import type { NormalizationOptions } from "./options";

export const SPINE_MANIFEST_LAYER = "spine";
export const SPINE_MANIFEST_VERSION = "1.0.0";
export const SPINE_RECORD_VERSION = "1.0.0";

export type SpineManifest = {
  layer: "spine";
  version: string;
  created_at: string;
  input: {
    path: string;
    sha256: string;
  };
  options: NormalizationOptions;
  stats: {
    refs: number;
    graphemes: number;
    gaps: number;
    bytes_out: number;
  };
  digests: {
    spineDigest: string;
  };
  schema: {
    spine_record_version: string;
  };
};

export type CreateSpineManifestArgs = {
  version?: string;
  createdAt?: Date | string;
  input: {
    path: string;
    sha256: string;
  };
  options: NormalizationOptions;
  stats: {
    refs: number;
    graphemes: number;
    gaps: number;
    bytes_out: number;
  };
  digests: {
    spineDigest: string;
  };
  schema?: {
    spine_record_version: string;
  };
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`createSpineManifest: ${label} must be non-empty string`);
  }
}

function assertSha256(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  if (!SHA256_HEX.test(value)) {
    throw new Error(`createSpineManifest: ${label} must be lowercase sha256 hex`);
  }
}

function assertNonNegativeInt(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`createSpineManifest: ${label} must be non-negative integer`);
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
      throw new Error("createSpineManifest: created_at must be valid ISO date-time");
    }
    return parsed.toISOString();
  }
  throw new Error("createSpineManifest: created_at must be Date | string");
}

export function createSpineManifest(args: CreateSpineManifestArgs): SpineManifest {
  assertNonEmptyString(args.input.path, "input.path");
  assertSha256(args.input.sha256, "input.sha256");

  assertNonNegativeInt(args.stats.refs, "stats.refs");
  assertNonNegativeInt(args.stats.graphemes, "stats.graphemes");
  assertNonNegativeInt(args.stats.gaps, "stats.gaps");
  assertNonNegativeInt(args.stats.bytes_out, "stats.bytes_out");

  assertSha256(args.digests.spineDigest, "digests.spineDigest");

  const version = args.version ?? SPINE_MANIFEST_VERSION;
  assertNonEmptyString(version, "version");

  const spineRecordVersion = args.schema?.spine_record_version ?? SPINE_RECORD_VERSION;
  assertNonEmptyString(spineRecordVersion, "schema.spine_record_version");

  return {
    layer: SPINE_MANIFEST_LAYER,
    version,
    created_at: toIsoString(args.createdAt),
    input: {
      path: args.input.path,
      sha256: args.input.sha256
    },
    options: args.options,
    stats: {
      refs: args.stats.refs,
      graphemes: args.stats.graphemes,
      gaps: args.stats.gaps,
      bytes_out: args.stats.bytes_out
    },
    digests: {
      spineDigest: args.digests.spineDigest
    },
    schema: {
      spine_record_version: spineRecordVersion
    }
  };
}
