import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CANTILLATION_LAYER_VERSION, stringifyCantillationManifestDigestInputs } from "./manifest";

export type CantillationDigestPlacementPolicy = {
  derived_boundaries_from_trope_marks: "wrapper" | "layer";
  gid_disj_cut_placement: "next_gap_or_ref_end_gap";
  anchoring_version: number;
  placement_version: number;
};

export type CantillationDigestConfig = {
  strict: boolean;
  emit_unknown: boolean;
  sof_pasuk_rank: number;
  dump_stats: boolean;
  top_marks_limit: number;
  placement_policy: CantillationDigestPlacementPolicy;
};

export type ComputeCantillationDigestArgs = {
  spine_digest: string;
  config_hash: string;
  code_hash: string;
  layer_version?: number;
};

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const SHA256_HEX = /^[a-f0-9]{64}$/;

export const DEFAULT_CANTILLATION_CODE_PATHS: readonly string[] = [
  "src/layers/cantillation/anchoring.ts",
  "src/layers/cantillation/placement.ts",
  "src/layers/cantillation/schema.ts",
  "src/layers/cantillation/marks.ts",
  "src/layers/cantillation/manifest.ts",
  "src/layers/cantillation/validate.ts",
  "src/layers/cantillation/extract.ts",
  "src/layers/cantillation/hash.ts"
];

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`cantillation hash: ${label} must be non-empty string`);
  }
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`cantillation hash: ${label} must be lowercase sha256 hex`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`cantillation hash: ${label} must be integer >= 1`);
  }
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

export function computeCantillationConfigHash(config: CantillationDigestConfig): string {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("cantillation hash: config must be object");
  }
  if (typeof config.strict !== "boolean") {
    throw new Error("cantillation hash: config.strict must be boolean");
  }
  if (typeof config.emit_unknown !== "boolean") {
    throw new Error("cantillation hash: config.emit_unknown must be boolean");
  }
  assertPositiveInteger(config.sof_pasuk_rank, "config.sof_pasuk_rank");
  if (typeof config.dump_stats !== "boolean") {
    throw new Error("cantillation hash: config.dump_stats must be boolean");
  }
  assertPositiveInteger(config.top_marks_limit, "config.top_marks_limit");
  if (typeof config.placement_policy !== "object" || config.placement_policy === null) {
    throw new Error("cantillation hash: config.placement_policy must be object");
  }
  if (
    config.placement_policy.derived_boundaries_from_trope_marks !== "wrapper" &&
    config.placement_policy.derived_boundaries_from_trope_marks !== "layer"
  ) {
    throw new Error(
      "cantillation hash: config.placement_policy.derived_boundaries_from_trope_marks must be wrapper|layer"
    );
  }
  if (config.placement_policy.gid_disj_cut_placement !== "next_gap_or_ref_end_gap") {
    throw new Error(
      "cantillation hash: config.placement_policy.gid_disj_cut_placement must be next_gap_or_ref_end_gap"
    );
  }
  assertPositiveInteger(
    config.placement_policy.anchoring_version,
    "placement_policy.anchoring_version"
  );
  assertPositiveInteger(
    config.placement_policy.placement_version,
    "placement_policy.placement_version"
  );

  return crypto.createHash("sha256").update(canonicalStringify(config), "utf8").digest("hex");
}

export function computeCantillationDigest(args: ComputeCantillationDigestArgs): string {
  assertSha256Hex(args.spine_digest, "spine_digest");
  assertSha256Hex(args.config_hash, "config_hash");
  assertSha256Hex(args.code_hash, "code_hash");
  const layer_version = args.layer_version ?? CANTILLATION_LAYER_VERSION;
  assertPositiveInteger(layer_version, "layer_version");

  const digestInputs = {
    layer: "cantillation" as const,
    layer_version,
    spine_digest: args.spine_digest,
    config_hash: args.config_hash,
    code_hash: args.code_hash
  };
  const basis = stringifyCantillationManifestDigestInputs(digestInputs);
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}

export async function computeCantillationCodeHash(
  codePaths: readonly string[] = DEFAULT_CANTILLATION_CODE_PATHS,
  cwd = process.cwd()
): Promise<string> {
  if (!Array.isArray(codePaths) || codePaths.length === 0) {
    throw new Error("cantillation hash: codePaths must be non-empty array");
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
