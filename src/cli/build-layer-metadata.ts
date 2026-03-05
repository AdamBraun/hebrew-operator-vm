import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createLayerManifestCore, type LayerManifestCore } from "../ir/layer_manifest_core";
import { METADATA_PLAN_IR_VERSION, METADATA_PLAN_REF_ORDER_SOURCE } from "../ir/metadata_ir";
import {
  buildMetadataPlan,
  DEFAULT_METADATA_DATASET_PATH
} from "../layers/metadata/buildMetadataPlan";
import { DEFAULT_TORAH_JSON_PATH, extractRefOrder } from "../layers/metadata/extractRefOrder";
import { normalizePlanDataset } from "../layers/metadata/normalizePlanDataset";
import { writeRunManifestSymlinks } from "./run_manifest_symlinks";

type BuildMetadataCliOptions = {
  datasetPath: string;
  torahJsonPath: string;
  outRoot: string;
  includeParashot: boolean;
  includeRanges: boolean;
  force: boolean;
  createdAt?: string;
  codeFingerprintOverride?: string;
};

type MetadataLayerConfig = {
  ref_order_source: typeof METADATA_PLAN_REF_ORDER_SOURCE;
  include_parashot: boolean;
  include_ranges: boolean;
};

export type MetadataLayerManifest = {
  layer: "metadata";
  layer_version: string;
  dataset_id: string;
  dataset_digest: string;
  ref_order_digest: string;
  output_digest: string;
  code_fingerprint: string;
  config_digest: string;
  created_at: string;
  inputs: {
    dataset_path: string;
    dataset_digest: string;
    ref_order_path: string;
    ref_order_digest: string;
    code_fingerprint: string;
    config: MetadataLayerConfig;
    config_digest: string;
  };
  artifacts: string[];
  cache_manifest: LayerManifestCore;
};

export type BuildMetadataCliResult = {
  layer: "metadata";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  metadataPlanPath: string;
  manifestPath: string;
};

type UnknownRecord = Record<string, unknown>;

type CacheInputDigests = {
  datasetDigest: string;
  refOrderDigest: string;
  codeFingerprint: string;
  configDigest: string;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;
const METADATA_LAYER = "metadata";
const METADATA_LAYER_VERSION = "1.0.0";
const DEFAULT_OUT_ROOT = path.resolve(process.cwd(), "outputs", "cache", "metadata");

const METADATA_CODE_PATHS: readonly string[] = [
  "src/cli/build-layer-metadata.ts",
  "src/layers/metadata/buildMetadataPlan.ts",
  "src/layers/metadata/normalizePlanDataset.ts",
  "src/layers/metadata/validatePlanDataset.ts",
  "src/layers/metadata/extractRefOrder.ts",
  "src/ir/metadata_ir.ts",
  "src/ir/refkey.ts"
];

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`build-layer-metadata: ${label} must be lowercase sha256 hex`);
  }
}

function asBoolean(value: string, label: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (lowered === "true" || lowered === "1" || lowered === "yes") {
    return true;
  }
  if (lowered === "false" || lowered === "0" || lowered === "no") {
    return false;
  }
  throw new Error(`build-layer-metadata: invalid ${label} value '${value}', expected true|false`);
}

function readOptionValue(
  argv: string[],
  index: number,
  flag: string
): { value: string; next: number } | null {
  const arg = argv[index];
  if (arg === flag) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`build-layer-metadata: missing value for ${flag}`);
    }
    return { value, next: index + 2 };
  }
  if (arg.startsWith(`${flag}=`)) {
    return { value: arg.slice(`${flag}=`.length), next: index + 1 };
  }
  return null;
}

function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node src/cli/build-layer-metadata.ts --dataset <plan.json> --torah-json <data/torah.json> --out <outputs/cache/metadata>"
  );
  console.log("");
  console.log("Options:");
  console.log(`  --dataset=path (default ${DEFAULT_METADATA_DATASET_PATH})`);
  console.log(`  --torah-json=path (default ${DEFAULT_TORAH_JSON_PATH})`);
  console.log(`  --out=path (default ${DEFAULT_OUT_ROOT})`);
  console.log("  --include-parashot=true|false (default true)");
  console.log("  --include-ranges=true|false (default false)");
  console.log("  --created-at=<ISO datetime> (optional)");
  console.log("  --code-fingerprint=<sha256> (optional override)");
  console.log("  --force");
}

export function parseArgs(argv: string[]): BuildMetadataCliOptions {
  let datasetPath = DEFAULT_METADATA_DATASET_PATH;
  let torahJsonPath = DEFAULT_TORAH_JSON_PATH;
  let outRoot = DEFAULT_OUT_ROOT;
  let includeParashot = true;
  let includeRanges = false;
  let force = false;
  let createdAt: string | undefined;
  let codeFingerprintOverride: string | undefined;

  for (let i = 0; i < argv.length; ) {
    const arg = argv[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--force") {
      force = true;
      i += 1;
      continue;
    }
    if (arg === "--include-parashot") {
      includeParashot = true;
      i += 1;
      continue;
    }
    if (arg === "--no-include-parashot") {
      includeParashot = false;
      i += 1;
      continue;
    }
    if (arg === "--include-ranges") {
      includeRanges = true;
      i += 1;
      continue;
    }
    if (arg === "--no-include-ranges") {
      includeRanges = false;
      i += 1;
      continue;
    }

    const datasetOpt = readOptionValue(argv, i, "--dataset");
    if (datasetOpt) {
      datasetPath = path.resolve(datasetOpt.value);
      i = datasetOpt.next;
      continue;
    }
    const torahOpt = readOptionValue(argv, i, "--torah-json");
    if (torahOpt) {
      torahJsonPath = path.resolve(torahOpt.value);
      i = torahOpt.next;
      continue;
    }
    const outOpt = readOptionValue(argv, i, "--out");
    if (outOpt) {
      outRoot = path.resolve(outOpt.value);
      i = outOpt.next;
      continue;
    }
    const includeParashotOpt = readOptionValue(argv, i, "--include-parashot");
    if (includeParashotOpt) {
      includeParashot = asBoolean(includeParashotOpt.value, "--include-parashot");
      i = includeParashotOpt.next;
      continue;
    }
    const includeRangesOpt = readOptionValue(argv, i, "--include-ranges");
    if (includeRangesOpt) {
      includeRanges = asBoolean(includeRangesOpt.value, "--include-ranges");
      i = includeRangesOpt.next;
      continue;
    }
    const createdAtOpt = readOptionValue(argv, i, "--created-at");
    if (createdAtOpt) {
      const parsed = new Date(createdAtOpt.value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("build-layer-metadata: --created-at must be valid ISO date-time");
      }
      createdAt = parsed.toISOString();
      i = createdAtOpt.next;
      continue;
    }
    const codeFingerprintOpt = readOptionValue(argv, i, "--code-fingerprint");
    if (codeFingerprintOpt) {
      assertSha256Hex(codeFingerprintOpt.value, "--code-fingerprint");
      codeFingerprintOverride = codeFingerprintOpt.value;
      i = codeFingerprintOpt.next;
      continue;
    }
    const forceOpt = readOptionValue(argv, i, "--force");
    if (forceOpt) {
      force = asBoolean(forceOpt.value, "--force");
      i = forceOpt.next;
      continue;
    }

    throw new Error(`build-layer-metadata: unknown argument '${arg}'`);
  }

  return {
    datasetPath,
    torahJsonPath,
    outRoot,
    includeParashot,
    includeRanges,
    force,
    ...(createdAt ? { createdAt } : {}),
    ...(codeFingerprintOverride ? { codeFingerprintOverride } : {})
  };
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

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareText)) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return null;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`build-layer-metadata: ${filePath} invalid JSON (${message})`);
  }
}

async function sha256File(filePath: string): Promise<string> {
  return sha256Hex(await fs.readFile(filePath));
}

async function computeMetadataLayerCodeFingerprint(override?: string): Promise<string> {
  if (override) {
    assertSha256Hex(override, "--code-fingerprint");
    return override;
  }

  const entries = await Promise.all(
    METADATA_CODE_PATHS.map(async (relativePath) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const text = await fs.readFile(absolutePath, "utf8");
      return {
        path: relativePath,
        sha256: sha256Hex(text)
      };
    })
  );

  entries.sort((left, right) => compareText(left.path, right.path));
  return sha256Hex(canonicalStringify(entries));
}

function buildLayerDigest(args: CacheInputDigests): string {
  return sha256Hex(
    canonicalStringify({
      dataset_digest: args.datasetDigest,
      ref_order_digest: args.refOrderDigest,
      code_fingerprint: args.codeFingerprint,
      config_digest: args.configDigest
    })
  );
}

function buildConfig(args: {
  includeParashot: boolean;
  includeRanges: boolean;
}): MetadataLayerConfig {
  return {
    ref_order_source: METADATA_PLAN_REF_ORDER_SOURCE,
    include_parashot: args.includeParashot,
    include_ranges: args.includeRanges
  };
}

function resolveOutputRoots(outArg: string): { outRoot: string; cacheDir: string } {
  const resolved = path.resolve(outArg);
  const parts = resolved.split(path.sep).filter((segment) => segment.length > 0);
  const parsed = path.parse(resolved);
  const isCacheLayer =
    parts.length >= 2 &&
    parts[parts.length - 2] === "cache" &&
    parts[parts.length - 1] === "metadata";

  if (isCacheLayer) {
    const rootParts = parts.slice(0, -2);
    const outRoot =
      rootParts.length > 0 ? path.join(parsed.root, ...rootParts) : parsed.root || resolved;
    return { outRoot, cacheDir: resolved };
  }

  return { outRoot: resolved, cacheDir: path.join(resolved, "cache", "metadata") };
}

function isManifest(value: unknown): value is MetadataLayerManifest {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.layer === METADATA_LAYER &&
    typeof value.layer_version === "string" &&
    typeof value.dataset_id === "string" &&
    typeof value.dataset_digest === "string" &&
    typeof value.ref_order_digest === "string" &&
    typeof value.output_digest === "string" &&
    typeof value.code_fingerprint === "string" &&
    typeof value.config_digest === "string" &&
    typeof value.created_at === "string" &&
    isRecord(value.inputs) &&
    Array.isArray(value.artifacts) &&
    isRecord(value.cache_manifest)
  );
}

async function readManifestSafe(filePath: string): Promise<MetadataLayerManifest | null> {
  try {
    const parsed = await readJsonFile(filePath);
    if (!isManifest(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isCacheManifestMatch(args: {
  manifest: MetadataLayerManifest;
  datasetId: string;
  digests: CacheInputDigests;
  config: MetadataLayerConfig;
  outputDigest: string;
  datasetPath: string;
  torahJsonPath: string;
}): boolean {
  const { manifest } = args;
  if (manifest.layer !== METADATA_LAYER || manifest.layer_version !== METADATA_LAYER_VERSION) {
    return false;
  }
  if (manifest.dataset_id !== args.datasetId) {
    return false;
  }
  if (manifest.dataset_digest !== args.digests.datasetDigest) {
    return false;
  }
  if (manifest.ref_order_digest !== args.digests.refOrderDigest) {
    return false;
  }
  if (manifest.output_digest !== args.outputDigest) {
    return false;
  }
  if (manifest.code_fingerprint !== args.digests.codeFingerprint) {
    return false;
  }
  if (manifest.config_digest !== args.digests.configDigest) {
    return false;
  }
  if (!isRecord(manifest.inputs)) {
    return false;
  }
  if (manifest.inputs.dataset_path !== args.datasetPath) {
    return false;
  }
  if (manifest.inputs.dataset_digest !== args.digests.datasetDigest) {
    return false;
  }
  if (manifest.inputs.ref_order_path !== args.torahJsonPath) {
    return false;
  }
  if (manifest.inputs.ref_order_digest !== args.digests.refOrderDigest) {
    return false;
  }
  if (manifest.inputs.code_fingerprint !== args.digests.codeFingerprint) {
    return false;
  }
  if (manifest.inputs.config_digest !== args.digests.configDigest) {
    return false;
  }
  if (canonicalStringify(manifest.inputs.config) !== canonicalStringify(args.config)) {
    return false;
  }
  if (!isRecord(manifest.cache_manifest)) {
    return false;
  }
  if (manifest.cache_manifest.output_digest !== args.outputDigest) {
    return false;
  }

  const artifacts = [...manifest.artifacts].sort(compareText);
  const expectedArtifacts = ["manifest.json", "metadata.plan.json"];
  if (artifacts.length !== expectedArtifacts.length) {
    return false;
  }
  for (let i = 0; i < expectedArtifacts.length; i += 1) {
    if (artifacts[i] !== expectedArtifacts[i]) {
      return false;
    }
  }

  return true;
}

function formatJsonDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeMetadataManifest(args: {
  datasetId: string;
  digests: CacheInputDigests;
  config: MetadataLayerConfig;
  outputDigest: string;
  stats: {
    checkpointsTotal: number;
    aliyahEndTotal: number;
    parashaEndTotal: number;
  };
  createdAt: string;
  datasetPath: string;
  torahJsonPath: string;
}): MetadataLayerManifest {
  return {
    layer: METADATA_LAYER,
    layer_version: METADATA_LAYER_VERSION,
    dataset_id: args.datasetId,
    dataset_digest: args.digests.datasetDigest,
    ref_order_digest: args.digests.refOrderDigest,
    output_digest: args.outputDigest,
    code_fingerprint: args.digests.codeFingerprint,
    config_digest: args.digests.configDigest,
    created_at: args.createdAt,
    inputs: {
      dataset_path: args.datasetPath,
      dataset_digest: args.digests.datasetDigest,
      ref_order_path: args.torahJsonPath,
      ref_order_digest: args.digests.refOrderDigest,
      code_fingerprint: args.digests.codeFingerprint,
      config: args.config,
      config_digest: args.digests.configDigest
    },
    artifacts: ["metadata.plan.json", "manifest.json"],
    cache_manifest: createLayerManifestCore({
      layer_name: METADATA_LAYER,
      layer_semver: METADATA_LAYER_VERSION,
      input_digests: {
        spineDigest: null,
        datasetDigest: args.digests.datasetDigest,
        configDigest: args.digests.configDigest
      },
      output_digest: args.outputDigest,
      ir_schema_version: METADATA_PLAN_IR_VERSION,
      stats: {
        record_count: args.stats.checkpointsTotal,
        gcount: 0,
        gapcount: 0,
        event_counts: {
          ALIYAH_END: args.stats.aliyahEndTotal,
          PARASHA_END: args.stats.parashaEndTotal
        }
      },
      timestamp: args.createdAt
    })
  };
}

export async function runBuildLayerMetadata(
  rawArgv: string[] = process.argv.slice(2)
): Promise<BuildMetadataCliResult> {
  const parsed = parseArgs(rawArgv);
  const [rawDataset, refOrder, codeFingerprint] = await Promise.all([
    readJsonFile(parsed.datasetPath),
    extractRefOrder({
      torahJsonPath: parsed.torahJsonPath
    }),
    computeMetadataLayerCodeFingerprint(parsed.codeFingerprintOverride)
  ]);

  const normalizedDataset = normalizePlanDataset(rawDataset);
  const datasetDigest = sha256Hex(canonicalStringify(normalizedDataset));
  const refOrderDigest = sha256Hex(canonicalStringify(refOrder));
  const config = buildConfig({
    includeParashot: parsed.includeParashot,
    includeRanges: parsed.includeRanges
  });
  const configDigest = sha256Hex(canonicalStringify(config));

  const inputDigests: CacheInputDigests = {
    datasetDigest,
    refOrderDigest,
    codeFingerprint,
    configDigest
  };

  const digest = buildLayerDigest(inputDigests);
  const { outRoot, cacheDir } = resolveOutputRoots(parsed.outRoot);
  const outputDir = path.join(cacheDir, digest);
  const metadataPlanPath = path.join(outputDir, "metadata.plan.json");
  const manifestPath = path.join(outputDir, "manifest.json");

  if (!parsed.force && (await pathExists(metadataPlanPath)) && (await pathExists(manifestPath))) {
    const [manifest, outputDigest] = await Promise.all([
      readManifestSafe(manifestPath),
      sha256File(metadataPlanPath)
    ]);
    if (
      manifest &&
      isCacheManifestMatch({
        manifest,
        datasetId: normalizedDataset.dataset_id,
        digests: inputDigests,
        config,
        outputDigest,
        datasetPath: parsed.datasetPath,
        torahJsonPath: parsed.torahJsonPath
      })
    ) {
      await writeRunManifestSymlinks({
        outRoot,
        layer: METADATA_LAYER,
        digest,
        manifestPath
      });
      return {
        layer: METADATA_LAYER,
        digest,
        cacheHit: true,
        forced: parsed.force,
        outputDir,
        metadataPlanPath,
        manifestPath
      };
    }
  }

  const plan = await buildMetadataPlan({
    dataset: normalizedDataset,
    refOrder,
    includeParashot: parsed.includeParashot,
    includeRanges: parsed.includeRanges,
    ...(parsed.createdAt ? { generatedAt: parsed.createdAt } : {})
  });
  const planText = formatJsonDocument(plan);
  const outputDigest = sha256Hex(planText);
  const createdAt = parsed.createdAt ?? plan.generated_at;
  const aliyahEndTotal = plan.checkpoints.filter(
    (checkpoint) => checkpoint.kind === "ALIYAH_END"
  ).length;
  const parashaEndTotal = plan.checkpoints.length - aliyahEndTotal;
  const manifest = normalizeMetadataManifest({
    datasetId: normalizedDataset.dataset_id,
    digests: inputDigests,
    config,
    outputDigest,
    stats: {
      checkpointsTotal: plan.checkpoints.length,
      aliyahEndTotal,
      parashaEndTotal
    },
    createdAt,
    datasetPath: parsed.datasetPath,
    torahJsonPath: parsed.torahJsonPath
  });

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(metadataPlanPath, planText, "utf8"),
    fs.writeFile(manifestPath, formatJsonDocument(manifest), "utf8")
  ]);
  await writeRunManifestSymlinks({
    outRoot,
    layer: METADATA_LAYER,
    digest,
    manifestPath
  });

  return {
    layer: METADATA_LAYER,
    digest,
    cacheHit: false,
    forced: parsed.force,
    outputDir,
    metadataPlanPath,
    manifestPath
  };
}

if (require.main === module) {
  runBuildLayerMetadata().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(`${mode}: metadataDigest=${result.digest} out=${result.outputDir}`);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`build-layer-metadata failed: ${message}`);
      process.exit(1);
    }
  );
}
