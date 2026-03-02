import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export type ComputeNiqqudDigestArgs = {
  spineDigest: string;
  config: object;
  codeFingerprint: string;
  layerVersion: number;
};

export const DEFAULT_NIQQUD_CODE_PATHS: readonly string[] = [
  "src/layers/niqqud/classes.ts",
  "src/layers/niqqud/map.ts",
  "src/layers/niqqud/mods.ts",
  "src/layers/niqqud/normalize_marks.ts",
  "src/layers/niqqud/schema.ts",
  "src/layers/niqqud/spine_view.ts",
  "src/layers/niqqud/stats.ts",
  "src/layers/niqqud/hash.ts"
];

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
    throw new Error(`computeNiqqudDigest: ${label} must be lowercase sha256 hex`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`computeNiqqudDigest: ${label} must be non-empty string`);
  }
}

function assertConfig(value: unknown): asserts value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("computeNiqqudDigest: config must be object");
  }
}

function assertLayerVersion(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("computeNiqqudDigest: layerVersion must be non-negative integer");
  }
}

export function computeNiqqudConfigDigest(config: object): string {
  assertConfig(config);
  const basis = canonicalStringify(config);
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}

export function computeNiqqudDigest(args: ComputeNiqqudDigestArgs): string {
  assertSha256Hex(args.spineDigest, "spineDigest");
  assertConfig(args.config);
  assertNonEmptyString(args.codeFingerprint, "codeFingerprint");
  assertLayerVersion(args.layerVersion);

  const payload = {
    layer: "niqqud",
    spineDigest: args.spineDigest,
    config: args.config,
    codeFingerprint: args.codeFingerprint,
    layerVersion: args.layerVersion
  };
  const basis = canonicalStringify(payload);
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}

export async function computeNiqqudLayerCodeFingerprint(
  codePaths: readonly string[] = DEFAULT_NIQQUD_CODE_PATHS,
  cwd = process.cwd()
): Promise<string> {
  if (!Array.isArray(codePaths) || codePaths.length === 0) {
    throw new Error("computeNiqqudLayerCodeFingerprint: codePaths must be non-empty array");
  }

  const hash = crypto.createHash("sha256");
  for (const relPath of [...codePaths].sort(compareText)) {
    assertNonEmptyString(relPath, "codePath");
    const absPath = path.resolve(cwd, relPath);
    const content = await fs.readFile(absPath);
    hash.update(relPath);
    hash.update("\u0000");
    hash.update(content);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}
