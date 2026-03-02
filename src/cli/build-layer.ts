import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { computeCantillationCodeHash, extractCantillationIR } from "../layers/cantillation/extract";
import { emitLettersFromSpine } from "../layers/letters/extract";
import { computeLettersDigest, computeLettersLayerCodeFingerprint } from "../layers/letters/hash";
import { LETTERS_IR_VERSION } from "../layers/letters/schema";
import { loadAndResolveLayoutDataset } from "../layers/layout/dataset_loader";
import { emitLayout } from "../layers/layout/emit";
import { computeLayoutDatasetDigest, computeLayoutDigest } from "../layers/layout/hash";
import {
  projectSpineGapsFromJsonl,
  readSpineGapDescriptorsFromJsonl
} from "../layers/layout/spine_adapter";

type BuildLayoutCliOptions = {
  layer: "layout";
  spinePath: string;
  datasetPath: string;
  outArg: string;
  force: boolean;
  spineDigestOverride?: string;
  layoutLayerCodeDigestOverride?: string;
};

type BuildLettersCliOptions = {
  layer: "letters";
  spinePath: string;
  outArg: string;
  force: boolean;
  includeWordSegmentation: boolean;
  strictLetters: boolean;
  spineDigestOverride?: string;
  lettersCodeFingerprintOverride?: string;
};

type BuildCantillationCliOptions = {
  layer: "cantillation";
  spinePath: string;
  outArg: string;
  force: boolean;
  strict: boolean;
  emitUnknown: boolean;
  sofPasukRank: number;
  dumpStats: boolean;
  spineDigestOverride?: string;
  cantillationCodeHashOverride?: string;
};

type BuildLayerCliOptions =
  | BuildLayoutCliOptions
  | BuildLettersCliOptions
  | BuildCantillationCliOptions;

export type BuildLayoutCliResult = {
  layer: "layout";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  layoutIrPath: string;
  aliasPath: string;
};

export type BuildLettersCliResult = {
  layer: "letters";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  lettersIrPath: string;
  aliasPath: string;
};

export type BuildCantillationCliResult = {
  layer: "cantillation";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  cantillationIrPath: string;
  statsPath?: string;
  aliasPath: string;
};

export type BuildLayerCliResult =
  | BuildLayoutCliResult
  | BuildLettersCliResult
  | BuildCantillationCliResult;

const SHA256_HEX = /^[a-f0-9]{64}$/;

const LAYOUT_CODE_PATHS: readonly string[] = [
  "src/layers/layout/schema.ts",
  "src/layers/layout/spine_adapter.ts",
  "src/layers/layout/dataset_loader.ts",
  "src/layers/layout/extract.ts",
  "src/layers/layout/hash.ts",
  "src/layers/layout/emit.ts"
];

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`build-layer: ${label} must be non-empty string`);
  }
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`build-layer: ${label} must be lowercase sha256 hex`);
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
  throw new Error(`Invalid ${label} value '${value}', expected true|false`);
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
      throw new Error(`Missing value for ${flag}`);
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
    "  node src/cli/build-layer.ts --layer layout --spine <spine.jsonl|spine_dir|spine_manifest.json> --dataset <dataset.json> --out <outputs|outputs/cache/layout>"
  );
  console.log(
    "  node src/cli/build-layer.ts --layer letters --spine <spine.jsonl|spine_dir|spine_manifest.json> --out <outputs|outputs/cache/letters>"
  );
  console.log(
    "  node src/cli/build-layer.ts --layer cantillation --spine <spine.jsonl|spine_dir|spine_manifest.json> --out <outputs|outputs/cache/cantillation>"
  );
  console.log("");
  console.log("Options:");
  console.log("  --layer=layout|letters|cantillation");
  console.log("  --spine=path");
  console.log("  --dataset=path (required for layout)");
  console.log("  --out=path (defaults to outputs/cache/<layer>)");
  console.log("  --spine-digest=<sha256>");
  console.log("  --layout-code-digest=<sha256> (layout only)");
  console.log("  --letters-code-fingerprint=<string> (letters only)");
  console.log("  --cantillation-code-hash=<sha256> (cantillation only)");
  console.log("  --include-word-segmentation=true|false (letters only, default true)");
  console.log("  --strict-letters=true|false (letters only, default false)");
  console.log("  --strict=true|false (cantillation only, default false)");
  console.log("  --emit-unknown=true|false (cantillation only, default false)");
  console.log("  --sof-pasuk-rank=<int> (cantillation only, default 3)");
  console.log("  --dump-stats=true|false (cantillation only, default false)");
  console.log("  --force");
}

export function parseArgs(argv: string[]): BuildLayerCliOptions {
  let layer: "layout" | "letters" | "cantillation" | null = null;
  let spinePath: string | null = null;
  let datasetPath: string | null = null;
  let outArg: string | null = null;
  let force = false;
  let spineDigestOverride: string | undefined;
  let layoutLayerCodeDigestOverride: string | undefined;
  let lettersCodeFingerprintOverride: string | undefined;
  let cantillationCodeHashOverride: string | undefined;
  let includeWordSegmentation = true;
  let strictLetters = false;
  let strict = false;
  let emitUnknown = false;
  let sofPasukRank = 3;
  let dumpStats = false;

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
    if (arg === "--include-word-segmentation") {
      includeWordSegmentation = true;
      i += 1;
      continue;
    }
    if (arg === "--no-word-segmentation") {
      includeWordSegmentation = false;
      i += 1;
      continue;
    }
    if (arg === "--strict-letters") {
      strictLetters = true;
      i += 1;
      continue;
    }
    if (arg === "--no-strict-letters") {
      strictLetters = false;
      i += 1;
      continue;
    }
    if (arg === "--strict") {
      strict = true;
      i += 1;
      continue;
    }
    if (arg === "--no-strict") {
      strict = false;
      i += 1;
      continue;
    }
    if (arg === "--emit-unknown") {
      emitUnknown = true;
      i += 1;
      continue;
    }
    if (arg === "--no-emit-unknown") {
      emitUnknown = false;
      i += 1;
      continue;
    }
    if (arg === "--dump-stats") {
      dumpStats = true;
      i += 1;
      continue;
    }
    if (arg === "--no-dump-stats") {
      dumpStats = false;
      i += 1;
      continue;
    }

    const layerOpt = readOptionValue(argv, i, "--layer");
    if (layerOpt) {
      if (
        layerOpt.value !== "layout" &&
        layerOpt.value !== "letters" &&
        layerOpt.value !== "cantillation"
      ) {
        throw new Error(
          `Unsupported layer '${layerOpt.value}'. Currently supported: layout, letters, cantillation`
        );
      }
      layer = layerOpt.value;
      i = layerOpt.next;
      continue;
    }
    const spineOpt = readOptionValue(argv, i, "--spine");
    if (spineOpt) {
      spinePath = path.resolve(spineOpt.value);
      i = spineOpt.next;
      continue;
    }
    const datasetOpt = readOptionValue(argv, i, "--dataset");
    if (datasetOpt) {
      datasetPath = path.resolve(datasetOpt.value);
      i = datasetOpt.next;
      continue;
    }
    const outOpt = readOptionValue(argv, i, "--out");
    if (outOpt) {
      outArg = path.resolve(outOpt.value);
      i = outOpt.next;
      continue;
    }
    const spineDigestOpt = readOptionValue(argv, i, "--spine-digest");
    if (spineDigestOpt) {
      spineDigestOverride = spineDigestOpt.value;
      i = spineDigestOpt.next;
      continue;
    }
    const layoutCodeDigestOpt = readOptionValue(argv, i, "--layout-code-digest");
    if (layoutCodeDigestOpt) {
      layoutLayerCodeDigestOverride = layoutCodeDigestOpt.value;
      i = layoutCodeDigestOpt.next;
      continue;
    }
    const lettersCodeFingerprintOpt = readOptionValue(argv, i, "--letters-code-fingerprint");
    if (lettersCodeFingerprintOpt) {
      lettersCodeFingerprintOverride = lettersCodeFingerprintOpt.value;
      i = lettersCodeFingerprintOpt.next;
      continue;
    }
    const cantillationCodeHashOpt = readOptionValue(argv, i, "--cantillation-code-hash");
    if (cantillationCodeHashOpt) {
      cantillationCodeHashOverride = cantillationCodeHashOpt.value;
      i = cantillationCodeHashOpt.next;
      continue;
    }
    const includeWordOpt = readOptionValue(argv, i, "--include-word-segmentation");
    if (includeWordOpt) {
      includeWordSegmentation = asBoolean(includeWordOpt.value, "--include-word-segmentation");
      i = includeWordOpt.next;
      continue;
    }
    const strictLettersOpt = readOptionValue(argv, i, "--strict-letters");
    if (strictLettersOpt) {
      strictLetters = asBoolean(strictLettersOpt.value, "--strict-letters");
      i = strictLettersOpt.next;
      continue;
    }
    const strictOpt = readOptionValue(argv, i, "--strict");
    if (strictOpt) {
      strict = asBoolean(strictOpt.value, "--strict");
      i = strictOpt.next;
      continue;
    }
    const emitUnknownOpt = readOptionValue(argv, i, "--emit-unknown");
    if (emitUnknownOpt) {
      emitUnknown = asBoolean(emitUnknownOpt.value, "--emit-unknown");
      i = emitUnknownOpt.next;
      continue;
    }
    const sofPasukRankOpt = readOptionValue(argv, i, "--sof-pasuk-rank");
    if (sofPasukRankOpt) {
      sofPasukRank = Number(sofPasukRankOpt.value);
      if (!Number.isInteger(sofPasukRank) || sofPasukRank < 1) {
        throw new Error("build-layer: --sof-pasuk-rank must be integer >= 1");
      }
      i = sofPasukRankOpt.next;
      continue;
    }
    const dumpStatsOpt = readOptionValue(argv, i, "--dump-stats");
    if (dumpStatsOpt) {
      dumpStats = asBoolean(dumpStatsOpt.value, "--dump-stats");
      i = dumpStatsOpt.next;
      continue;
    }
    const forceOpt = readOptionValue(argv, i, "--force");
    if (forceOpt) {
      force = asBoolean(forceOpt.value, "--force");
      i = forceOpt.next;
      continue;
    }

    throw new Error(`Unknown argument '${arg}'`);
  }

  if (!layer) {
    throw new Error("Missing required --layer (must be layout|letters|cantillation)");
  }
  if (!spinePath) {
    throw new Error("Missing required --spine");
  }
  const resolvedOutArg = outArg ?? path.resolve(process.cwd(), "outputs", "cache", layer);

  if (spineDigestOverride !== undefined) {
    assertSha256Hex(spineDigestOverride, "spineDigest");
  }

  if (layer === "layout") {
    if (!datasetPath) {
      throw new Error("Missing required --dataset for layer=layout");
    }
    if (layoutLayerCodeDigestOverride !== undefined) {
      assertSha256Hex(layoutLayerCodeDigestOverride, "layoutLayerCodeDigest");
    }
    return {
      layer,
      spinePath,
      datasetPath,
      outArg: resolvedOutArg,
      force,
      spineDigestOverride,
      layoutLayerCodeDigestOverride
    };
  }

  if (layer === "letters") {
    if (lettersCodeFingerprintOverride !== undefined) {
      assertNonEmptyString(lettersCodeFingerprintOverride, "lettersCodeFingerprint");
    }

    return {
      layer,
      spinePath,
      outArg: resolvedOutArg,
      force,
      includeWordSegmentation,
      strictLetters,
      spineDigestOverride,
      lettersCodeFingerprintOverride
    };
  }

  if (cantillationCodeHashOverride !== undefined) {
    assertSha256Hex(cantillationCodeHashOverride, "cantillationCodeHash");
  }

  return {
    layer: "cantillation",
    spinePath,
    outArg: resolvedOutArg,
    force,
    strict,
    emitUnknown,
    sofPasukRank,
    dumpStats,
    spineDigestOverride,
    cantillationCodeHashOverride
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

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

type ResolvedSpineInputPaths = {
  spineJsonlPath: string;
  spineManifestPath?: string;
};

async function resolveSpineInputPaths(inputPath: string): Promise<ResolvedSpineInputPaths> {
  const stat = await fs.stat(inputPath);
  if (stat.isDirectory()) {
    const nested = path.join(inputPath, "spine.jsonl");
    if (!(await pathExists(nested))) {
      throw new Error(`build-layer: expected spine file at ${nested}`);
    }
    const manifestPath = path.join(inputPath, "manifest.json");
    return {
      spineJsonlPath: nested,
      spineManifestPath: (await pathExists(manifestPath)) ? manifestPath : undefined
    };
  }

  if (path.basename(inputPath) === "manifest.json") {
    const spineDir = path.dirname(inputPath);
    const spineJsonlPath = path.join(spineDir, "spine.jsonl");
    if (!(await pathExists(spineJsonlPath))) {
      throw new Error(`build-layer: expected spine file at ${spineJsonlPath}`);
    }
    return {
      spineJsonlPath,
      spineManifestPath: inputPath
    };
  }

  return { spineJsonlPath: inputPath };
}

async function resolveSpineDigest(args: {
  spineJsonlPath: string;
  spineManifestPath?: string;
  override?: string;
}): Promise<string> {
  if (args.override) {
    assertSha256Hex(args.override, "spineDigest");
    return args.override;
  }

  if (args.spineManifestPath && (await pathExists(args.spineManifestPath))) {
    const parsed = (await readJsonFile(args.spineManifestPath)) as Record<string, unknown>;
    const digests =
      parsed && typeof parsed === "object" && "digests" in parsed
        ? (parsed.digests as Record<string, unknown>)
        : undefined;
    const digestValue = digests?.spineDigest;
    assertSha256Hex(digestValue, "spineDigest");
    return digestValue;
  }

  const spineDir = path.dirname(args.spineJsonlPath);
  const manifestPath = path.join(spineDir, "manifest.json");
  if (await pathExists(manifestPath)) {
    const parsed = (await readJsonFile(manifestPath)) as Record<string, unknown>;
    const digests =
      parsed && typeof parsed === "object" && "digests" in parsed
        ? (parsed.digests as Record<string, unknown>)
        : undefined;
    const digestValue = digests?.spineDigest;
    assertSha256Hex(digestValue, "spineDigest");
    return digestValue;
  }

  const digestFromDir = path.basename(spineDir);
  if (SHA256_HEX.test(digestFromDir)) {
    return digestFromDir;
  }

  throw new Error(
    `build-layer: unable to resolve spineDigest for ${args.spineJsonlPath}. ` +
      `Provide --spine-digest or point to a spine cache directory with manifest.json.`
  );
}

function resolveOutputRoots(
  outArg: string,
  layer: "layout" | "letters" | "cantillation"
): { outRoot: string; cacheDir: string } {
  const resolved = path.resolve(outArg);
  const parts = resolved.split(path.sep).filter((segment) => segment.length > 0);
  const parsed = path.parse(resolved);
  const isCacheLayer =
    parts.length >= 2 && parts[parts.length - 2] === "cache" && parts[parts.length - 1] === layer;

  if (isCacheLayer) {
    const rootParts = parts.slice(0, -2);
    const outRoot =
      rootParts.length > 0 ? path.join(parsed.root, ...rootParts) : parsed.root || resolved;
    return { outRoot, cacheDir: resolved };
  }
  return { outRoot: resolved, cacheDir: path.join(resolved, "cache", layer) };
}

async function computeLayoutLayerCodeDigest(): Promise<string> {
  const hash = crypto.createHash("sha256");
  for (const relPath of [...LAYOUT_CODE_PATHS].sort()) {
    const absPath = path.resolve(process.cwd(), relPath);
    const content = await fs.readFile(absPath);
    hash.update(relPath);
    hash.update("\u0000");
    hash.update(content);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

async function writeLayoutAliasFile(args: {
  outRoot: string;
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  manifestPath: string;
  layoutIrPath: string;
}): Promise<string> {
  const aliasPath = path.join(args.outRoot, "runs", "latest", "manifests", "layout.json");
  await fs.mkdir(path.dirname(aliasPath), { recursive: true });
  const payload = {
    layer: "layout",
    digest: args.digest,
    cache_hit: args.cacheHit,
    forced: args.forced,
    manifest_path: args.manifestPath,
    layout_ir_jsonl_path: args.layoutIrPath,
    updated_at: new Date().toISOString()
  };
  await fs.writeFile(aliasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return aliasPath;
}

async function writeLettersAliasFile(args: {
  outRoot: string;
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  manifestPath: string;
  lettersIrPath: string;
}): Promise<string> {
  const runAliasPath = path.join(args.outRoot, "runs", args.digest, "manifests", "letters.json");
  const latestAliasPath = path.join(args.outRoot, "runs", "latest", "manifests", "letters.json");
  const payload = {
    layer: "letters",
    run: args.digest,
    digest: args.digest,
    cache_hit: args.cacheHit,
    forced: args.forced,
    manifest_path: args.manifestPath,
    letters_ir_jsonl_path: args.lettersIrPath,
    updated_at: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(runAliasPath), { recursive: true });
  await fs.writeFile(runAliasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.mkdir(path.dirname(latestAliasPath), { recursive: true });
  await fs.writeFile(latestAliasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return latestAliasPath;
}

async function writeCantillationAliasFile(args: {
  outRoot: string;
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  manifestPath: string;
  cantillationIrPath: string;
  statsPath?: string;
}): Promise<string> {
  const runAliasPath = path.join(
    args.outRoot,
    "runs",
    args.digest,
    "manifests",
    "cantillation.json"
  );
  const latestAliasPath = path.join(
    args.outRoot,
    "runs",
    "latest",
    "manifests",
    "cantillation.json"
  );
  const payload = {
    layer: "cantillation",
    run: args.digest,
    digest: args.digest,
    cache_hit: args.cacheHit,
    forced: args.forced,
    manifest_path: args.manifestPath,
    cantillation_ir_jsonl_path: args.cantillationIrPath,
    ...(args.statsPath ? { stats_path: args.statsPath } : {}),
    updated_at: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(runAliasPath), { recursive: true });
  await fs.writeFile(runAliasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.mkdir(path.dirname(latestAliasPath), { recursive: true });
  await fs.writeFile(latestAliasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return latestAliasPath;
}

export async function runBuildLayer(
  rawArgv: string[] = process.argv.slice(2)
): Promise<BuildLayerCliResult> {
  const parsed = parseArgs(rawArgv);
  const resolvedSpine = await resolveSpineInputPaths(parsed.spinePath);
  const spineJsonlPath = resolvedSpine.spineJsonlPath;
  const spineDigest = await resolveSpineDigest({
    spineJsonlPath,
    spineManifestPath: resolvedSpine.spineManifestPath,
    override: parsed.spineDigestOverride
  });

  if (parsed.layer === "layout") {
    const datasetBytes = await fs.readFile(parsed.datasetPath);
    const layoutDatasetDigest = computeLayoutDatasetDigest(datasetBytes);
    const layoutLayerCodeDigest =
      parsed.layoutLayerCodeDigestOverride ?? (await computeLayoutLayerCodeDigest());

    const layoutConfig = {
      jsonl_canonical: true,
      jsonl_trailing_newline: true
    };
    const digest = computeLayoutDigest({
      spineDigest,
      layoutDatasetDigest,
      layoutLayerCodeDigest,
      layoutConfig
    });

    const projection = await projectSpineGapsFromJsonl(spineJsonlPath);
    const resolvedDataset = await loadAndResolveLayoutDataset(parsed.datasetPath, projection);

    const { outRoot, cacheDir } = resolveOutputRoots(parsed.outArg, "layout");
    const emitted = await emitLayout({
      gaps: readSpineGapDescriptorsFromJsonl(spineJsonlPath),
      eventsByGapid: resolvedDataset.eventsByGapid,
      spineDigest,
      layoutDatasetDigest,
      layoutLayerCodeDigest,
      layoutConfig,
      dataset: {
        dataset_id: resolvedDataset.dataset.dataset_id,
        version: resolvedDataset.dataset.version
      },
      outCacheDir: cacheDir,
      digest,
      force: parsed.force
    });

    const aliasPath = await writeLayoutAliasFile({
      outRoot,
      digest: emitted.digest,
      cacheHit: emitted.cacheHit,
      forced: emitted.forced,
      manifestPath: emitted.manifestPath,
      layoutIrPath: emitted.layoutIrPath
    });

    return {
      layer: "layout",
      digest: emitted.digest,
      cacheHit: emitted.cacheHit,
      forced: emitted.forced,
      outputDir: emitted.outputDir,
      manifestPath: emitted.manifestPath,
      layoutIrPath: emitted.layoutIrPath,
      aliasPath
    };
  }

  if (parsed.layer === "cantillation") {
    const codeHash = parsed.cantillationCodeHashOverride ?? (await computeCantillationCodeHash());
    const { outRoot, cacheDir } = resolveOutputRoots(parsed.outArg, "cantillation");
    const emitted = await extractCantillationIR(spineJsonlPath, cacheDir, {
      strict: parsed.strict,
      emitUnknown: parsed.emitUnknown,
      sofPasukRank: parsed.sofPasukRank,
      dumpStats: parsed.dumpStats,
      force: parsed.force,
      spineManifestPath: resolvedSpine.spineManifestPath,
      spineDigestOverride: spineDigest,
      codeHashOverride: codeHash
    });

    const aliasPath = await writeCantillationAliasFile({
      outRoot,
      digest: emitted.digest,
      cacheHit: emitted.cacheHit,
      forced: emitted.forced,
      manifestPath: emitted.manifestPath,
      cantillationIrPath: emitted.cantillationIrPath,
      ...(emitted.statsPath ? { statsPath: emitted.statsPath } : {})
    });

    return {
      layer: "cantillation",
      digest: emitted.digest,
      cacheHit: emitted.cacheHit,
      forced: emitted.forced,
      outputDir: emitted.outputDir,
      manifestPath: emitted.manifestPath,
      cantillationIrPath: emitted.cantillationIrPath,
      ...(emitted.statsPath ? { statsPath: emitted.statsPath } : {}),
      aliasPath
    };
  }

  const lettersCodeFingerprint =
    parsed.lettersCodeFingerprintOverride ?? (await computeLettersLayerCodeFingerprint());
  const lettersConfig = {
    include_word_segmentation: parsed.includeWordSegmentation,
    strict_letters: parsed.strictLetters
  };
  const digest = computeLettersDigest({
    spineDigest,
    config: lettersConfig,
    codeFingerprint: lettersCodeFingerprint,
    version: LETTERS_IR_VERSION
  });

  const { outRoot, cacheDir } = resolveOutputRoots(parsed.outArg, "letters");
  const emitted = await emitLettersFromSpine({
    spinePath: spineJsonlPath,
    spineManifestPath: resolvedSpine.spineManifestPath,
    spineDigestOverride: spineDigest,
    includeWordSegmentation: parsed.includeWordSegmentation,
    strictLetters: parsed.strictLetters,
    codeFingerprint: lettersCodeFingerprint,
    version: LETTERS_IR_VERSION,
    outCacheDir: cacheDir,
    digest,
    force: parsed.force
  });

  const aliasPath = await writeLettersAliasFile({
    outRoot,
    digest: emitted.digest,
    cacheHit: emitted.cacheHit,
    forced: emitted.forced,
    manifestPath: emitted.manifestPath,
    lettersIrPath: emitted.lettersIrPath
  });

  return {
    layer: "letters",
    digest: emitted.digest,
    cacheHit: emitted.cacheHit,
    forced: emitted.forced,
    outputDir: emitted.outputDir,
    manifestPath: emitted.manifestPath,
    lettersIrPath: emitted.lettersIrPath,
    aliasPath
  };
}

if (require.main === module) {
  runBuildLayer().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(
        `${mode}: layer=${result.layer} digest=${result.digest} output=${result.outputDir}`
      );
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`build-layer failed: ${message}`);
      process.exit(1);
    }
  );
}
