import crypto from "node:crypto";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export type LayoutConfig = Record<string, unknown>;

export type ComputeLayoutDigestArgs = {
  spineDigest: string;
  layoutDatasetDigest: string;
  layoutLayerCodeDigest: string;
  layoutConfig: LayoutConfig;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

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

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`computeLayoutDigest: ${label} must be lowercase sha256 hex`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`computeLayoutDigest: ${label} must be non-empty string`);
  }
}

function assertLayoutConfig(value: unknown): asserts value is LayoutConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("computeLayoutDigest: layoutConfig must be an object");
  }
}

export function computeLayoutDatasetDigest(datasetBytes: string | Buffer): string {
  return crypto.createHash("sha256").update(datasetBytes).digest("hex");
}

export function computeLayoutDigest(args: ComputeLayoutDigestArgs): string {
  assertSha256Hex(args.spineDigest, "spineDigest");
  assertSha256Hex(args.layoutDatasetDigest, "layoutDatasetDigest");
  assertNonEmptyString(args.layoutLayerCodeDigest, "layoutLayerCodeDigest");
  assertLayoutConfig(args.layoutConfig);

  const payload = {
    spineDigest: args.spineDigest,
    layoutDatasetDigest: args.layoutDatasetDigest,
    layoutLayerCodeDigest: args.layoutLayerCodeDigest,
    layoutConfig: args.layoutConfig
  };

  const basis = canonicalStringify(payload);
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}
