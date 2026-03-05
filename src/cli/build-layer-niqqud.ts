import fs from "node:fs/promises";
import path from "node:path";
import {
  computeNiqqudConfigDigest,
  computeNiqqudDigest,
  computeNiqqudLayerCodeFingerprint
} from "../layers/niqqud/hash";
import { buildNiqqudMods } from "../layers/niqqud/mods";
import { normalizeNiqqudMarks } from "../layers/niqqud/normalize_marks";
import { NIQQUD_IR_VERSION, serializeNiqqudIRRow, type NiqqudIRRow } from "../layers/niqqud/schema";
import { readNiqqudView } from "../layers/niqqud/spine_view";
import {
  createNiqqudStatsAccumulator,
  recordNiqqudRow,
  recordNiqqudWarning,
  writeNiqqudQualityArtifacts
} from "../layers/niqqud/stats";

export const NIQQUD_LAYER_VERSION = "1.0.0";
const NIQQUD_LAYER_DIGEST_VERSION = 1;

type BuildNiqqudCliOptions = {
  spinePath: string;
  outArg: string;
  format: "jsonl";
  emitStats: boolean;
  strict: boolean;
  force: boolean;
  codeFingerprintOverride?: string;
};

export type NiqqudBuildManifest = {
  layer: "niqqud";
  layer_version: string;
  ir_version: number;
  digest: string;
  spine_digest: string;
  config_digest: string;
  code_fingerprint: string;
  config: {
    format: "jsonl";
    emit_stats: boolean;
    strict: boolean;
  };
  output_files: string[];
  created_at: string;
};

export type BuildNiqqudCliResult = {
  layer: "niqqud";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  niqqudIrPath: string;
  statsPath?: string;
  warningsPath?: string;
};

type ResolvedSpineInputPaths = {
  spineJsonlPath: string;
  spineManifestPath?: string;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`build-layer-niqqud: ${label} must be non-empty string`);
  }
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`build-layer-niqqud: ${label} must be lowercase sha256 hex`);
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
  throw new Error(`build-layer-niqqud: invalid ${label} value '${value}', expected true|false`);
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
      throw new Error(`build-layer-niqqud: missing value for ${flag}`);
    }
    return { value, next: index + 2 };
  }
  if (arg.startsWith(`${flag}=`)) {
    return { value: arg.slice(`${flag}=`.length), next: index + 1 };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
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
      throw new Error("build-layer-niqqud: createdAt must be valid ISO date-time");
    }
    return parsed.toISOString();
  }
  throw new Error("build-layer-niqqud: createdAt must be Date | string");
}

function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node src/cli/build-layer-niqqud.ts --spine <spine.jsonl|spine_dir|spine_manifest.json> --out <outputs|outputs/cache/niqqud>"
  );
  console.log("");
  console.log("Options:");
  console.log("  --spine=path");
  console.log("  --out=path (defaults to outputs/cache/niqqud)");
  console.log("  --format=jsonl (default jsonl)");
  console.log("  --emit-stats=true|false (default true)");
  console.log("  --strict=true|false (default false)");
  console.log("  --code-fingerprint=<string> (optional override)");
  console.log("  --force=true|false (default false)");
}

export function parseArgs(argv: string[]): BuildNiqqudCliOptions {
  let spinePath: string | null = null;
  let outArg: string | null = null;
  let format: "jsonl" = "jsonl";
  let emitStats = true;
  let strict = false;
  let force = false;
  let codeFingerprintOverride: string | undefined;

  for (let i = 0; i < argv.length; ) {
    const arg = argv[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--emit-stats") {
      emitStats = true;
      i += 1;
      continue;
    }
    if (arg === "--no-emit-stats") {
      emitStats = false;
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
    if (arg === "--force") {
      force = true;
      i += 1;
      continue;
    }

    const spineOpt = readOptionValue(argv, i, "--spine");
    if (spineOpt) {
      spinePath = path.resolve(spineOpt.value);
      i = spineOpt.next;
      continue;
    }
    const outOpt = readOptionValue(argv, i, "--out");
    if (outOpt) {
      outArg = path.resolve(outOpt.value);
      i = outOpt.next;
      continue;
    }
    const formatOpt = readOptionValue(argv, i, "--format");
    if (formatOpt) {
      if (formatOpt.value !== "jsonl") {
        throw new Error(`build-layer-niqqud: unsupported --format '${formatOpt.value}'`);
      }
      format = "jsonl";
      i = formatOpt.next;
      continue;
    }
    const emitStatsOpt = readOptionValue(argv, i, "--emit-stats");
    if (emitStatsOpt) {
      emitStats = asBoolean(emitStatsOpt.value, "--emit-stats");
      i = emitStatsOpt.next;
      continue;
    }
    const strictOpt = readOptionValue(argv, i, "--strict");
    if (strictOpt) {
      strict = asBoolean(strictOpt.value, "--strict");
      i = strictOpt.next;
      continue;
    }
    const forceOpt = readOptionValue(argv, i, "--force");
    if (forceOpt) {
      force = asBoolean(forceOpt.value, "--force");
      i = forceOpt.next;
      continue;
    }
    const codeFingerprintOpt = readOptionValue(argv, i, "--code-fingerprint");
    if (codeFingerprintOpt) {
      codeFingerprintOverride = codeFingerprintOpt.value;
      i = codeFingerprintOpt.next;
      continue;
    }

    throw new Error(`build-layer-niqqud: unknown argument '${arg}'`);
  }

  if (!spinePath) {
    throw new Error("build-layer-niqqud: missing required --spine");
  }
  const resolvedOut = outArg ?? path.resolve(process.cwd(), "outputs", "cache", "niqqud");
  if (codeFingerprintOverride !== undefined) {
    assertNonEmptyString(codeFingerprintOverride, "codeFingerprint");
  }
  return {
    spinePath,
    outArg: resolvedOut,
    format,
    emitStats,
    strict,
    force,
    codeFingerprintOverride
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

async function resolveSpineInputPaths(inputPath: string): Promise<ResolvedSpineInputPaths> {
  const stat = await fs.stat(inputPath);
  if (stat.isDirectory()) {
    const nested = path.join(inputPath, "spine.jsonl");
    if (!(await pathExists(nested))) {
      throw new Error(`build-layer-niqqud: expected spine file at ${nested}`);
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
      throw new Error(`build-layer-niqqud: expected spine file at ${spineJsonlPath}`);
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
}): Promise<string> {
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
    `build-layer-niqqud: unable to resolve spineDigest for ${args.spineJsonlPath}; ` +
      "point to a spine cache dir/manifest or include a digest-named parent directory."
  );
}

function resolveNiqqudCacheDir(outArg: string): string {
  const resolved = path.resolve(outArg);
  const parts = resolved.split(path.sep).filter((segment) => segment.length > 0);
  const isCacheLayer =
    parts.length >= 2 &&
    parts[parts.length - 2] === "cache" &&
    parts[parts.length - 1] === "niqqud";
  if (isCacheLayer) {
    return resolved;
  }
  return path.join(resolved, "cache", "niqqud");
}

function parseNiqqudManifest(parsed: unknown): NiqqudBuildManifest {
  if (!isRecord(parsed)) {
    throw new Error("build-layer-niqqud: manifest must be object");
  }
  if (parsed.layer !== "niqqud") {
    throw new Error("build-layer-niqqud: manifest.layer must be 'niqqud'");
  }
  assertNonEmptyString(parsed.layer_version, "manifest.layer_version");
  const irVersion = parsed.ir_version;
  if (typeof irVersion !== "number" || !Number.isInteger(irVersion) || irVersion < 0) {
    throw new Error("build-layer-niqqud: manifest.ir_version must be non-negative integer");
  }
  assertSha256Hex(parsed.digest, "manifest.digest");
  assertSha256Hex(parsed.spine_digest, "manifest.spine_digest");
  assertSha256Hex(parsed.config_digest, "manifest.config_digest");
  assertSha256Hex(parsed.code_fingerprint, "manifest.code_fingerprint");

  if (!isRecord(parsed.config)) {
    throw new Error("build-layer-niqqud: manifest.config must be object");
  }
  if (parsed.config.format !== "jsonl") {
    throw new Error("build-layer-niqqud: manifest.config.format must be 'jsonl'");
  }
  if (!isBoolean(parsed.config.emit_stats)) {
    throw new Error("build-layer-niqqud: manifest.config.emit_stats must be boolean");
  }
  if (!isBoolean(parsed.config.strict)) {
    throw new Error("build-layer-niqqud: manifest.config.strict must be boolean");
  }

  if (!isStringArray(parsed.output_files)) {
    throw new Error("build-layer-niqqud: manifest.output_files must be string[]");
  }
  assertNonEmptyString(parsed.created_at, "manifest.created_at");

  return {
    layer: "niqqud",
    layer_version: parsed.layer_version,
    ir_version: irVersion,
    digest: parsed.digest,
    spine_digest: parsed.spine_digest,
    config_digest: parsed.config_digest,
    code_fingerprint: parsed.code_fingerprint,
    config: {
      format: "jsonl",
      emit_stats: parsed.config.emit_stats,
      strict: parsed.config.strict
    },
    output_files: parsed.output_files,
    created_at: parsed.created_at
  };
}

async function readNiqqudManifestSafe(filePath: string): Promise<NiqqudBuildManifest | null> {
  try {
    const parsed = await readJsonFile(filePath);
    return parseNiqqudManifest(parsed);
  } catch {
    return null;
  }
}

function requiredOutputFiles(config: NiqqudBuildManifest["config"]): string[] {
  const out = ["niqqud.ir.jsonl"];
  if (config.emit_stats) {
    out.push("niqqud.stats.json", "warnings.jsonl");
  }
  out.push("manifest.json");
  return out;
}

function isCacheManifestMatch(args: {
  manifest: NiqqudBuildManifest;
  digest: string;
  spineDigest: string;
  configDigest: string;
  codeFingerprint: string;
  config: NiqqudBuildManifest["config"];
}): boolean {
  const { manifest } = args;
  return (
    manifest.layer === "niqqud" &&
    manifest.layer_version === NIQQUD_LAYER_VERSION &&
    manifest.ir_version === NIQQUD_IR_VERSION &&
    manifest.digest === args.digest &&
    manifest.spine_digest === args.spineDigest &&
    manifest.config_digest === args.configDigest &&
    manifest.code_fingerprint === args.codeFingerprint &&
    manifest.config.format === args.config.format &&
    manifest.config.emit_stats === args.config.emit_stats &&
    manifest.config.strict === args.config.strict
  );
}

async function canReuseCache(args: {
  outputDir: string;
  manifestPath: string;
  digest: string;
  spineDigest: string;
  configDigest: string;
  codeFingerprint: string;
  config: NiqqudBuildManifest["config"];
}): Promise<boolean> {
  if (!(await pathExists(args.manifestPath))) {
    return false;
  }
  const manifest = await readNiqqudManifestSafe(args.manifestPath);
  if (!manifest) {
    return false;
  }
  if (
    !isCacheManifestMatch({
      manifest,
      digest: args.digest,
      spineDigest: args.spineDigest,
      configDigest: args.configDigest,
      codeFingerprint: args.codeFingerprint,
      config: args.config
    })
  ) {
    return false;
  }

  const requiredFiles = requiredOutputFiles(args.config);
  for (const relFile of requiredFiles) {
    if (!manifest.output_files.includes(relFile)) {
      return false;
    }
    if (!(await pathExists(path.join(args.outputDir, relFile)))) {
      return false;
    }
  }
  return true;
}

function createManifest(args: {
  digest: string;
  spineDigest: string;
  configDigest: string;
  codeFingerprint: string;
  config: NiqqudBuildManifest["config"];
  outputFiles: string[];
  createdAt?: Date | string;
}): NiqqudBuildManifest {
  assertSha256Hex(args.digest, "digest");
  assertSha256Hex(args.spineDigest, "spine_digest");
  assertSha256Hex(args.configDigest, "config_digest");
  assertSha256Hex(args.codeFingerprint, "code_fingerprint");
  return {
    layer: "niqqud",
    layer_version: NIQQUD_LAYER_VERSION,
    ir_version: NIQQUD_IR_VERSION,
    digest: args.digest,
    spine_digest: args.spineDigest,
    config_digest: args.configDigest,
    code_fingerprint: args.codeFingerprint,
    config: args.config,
    output_files: [...args.outputFiles],
    created_at: toIsoString(args.createdAt)
  };
}

export async function runBuildLayerNiqqud(
  rawArgv: string[] = process.argv.slice(2)
): Promise<BuildNiqqudCliResult> {
  const parsed = parseArgs(rawArgv);
  const resolvedSpine = await resolveSpineInputPaths(parsed.spinePath);
  const spineDigest = await resolveSpineDigest({
    spineJsonlPath: resolvedSpine.spineJsonlPath,
    spineManifestPath: resolvedSpine.spineManifestPath
  });

  const config = {
    format: parsed.format,
    emit_stats: parsed.emitStats,
    strict: parsed.strict
  } as const;
  const configDigest = computeNiqqudConfigDigest(config);
  const codeFingerprint =
    parsed.codeFingerprintOverride ?? (await computeNiqqudLayerCodeFingerprint());
  const digest = computeNiqqudDigest({
    layerVersion: NIQQUD_LAYER_DIGEST_VERSION,
    spineDigest,
    config,
    codeFingerprint
  });

  const cacheDir = resolveNiqqudCacheDir(parsed.outArg);
  const outputDir = path.join(cacheDir, digest);
  const niqqudIrPath = path.join(outputDir, "niqqud.ir.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");
  const statsPath = path.join(outputDir, "niqqud.stats.json");
  const warningsPath = path.join(outputDir, "warnings.jsonl");

  const hasCache = await canReuseCache({
    outputDir,
    manifestPath,
    digest,
    spineDigest,
    configDigest,
    codeFingerprint,
    config
  });
  if (hasCache && !parsed.force) {
    return {
      layer: "niqqud",
      digest,
      cacheHit: true,
      forced: false,
      outputDir,
      manifestPath,
      niqqudIrPath,
      ...(parsed.emitStats
        ? {
            statsPath,
            warningsPath
          }
        : {})
    };
  }

  await fs.mkdir(outputDir, { recursive: true });
  const irHandle = await fs.open(niqqudIrPath, "w");
  const statsAccumulator = createNiqqudStatsAccumulator();

  try {
    for await (const row of readNiqqudView(resolvedSpine.spineJsonlPath, {
      onWarning: (warning) => {
        recordNiqqudWarning(statsAccumulator, warning);
      }
    })) {
      const normalized = normalizeNiqqudMarks(row.niqqud);
      const built = buildNiqqudMods({ classes: normalized.normalized });

      const outRow: NiqqudIRRow = {
        kind: "niqqud",
        version: NIQQUD_IR_VERSION,
        gid: row.gid,
        ref_key: row.ref_key,
        g_index: row.g_index,
        raw: {
          niqqud: row.niqqud
        },
        mods: built.mods,
        unhandled: normalized.unhandled,
        flags: built.flags
      };

      await irHandle.write(`${serializeNiqqudIRRow(outRow)}\n`);

      recordNiqqudRow(statsAccumulator, {
        gid: row.gid,
        ref_key: row.ref_key,
        g_index: row.g_index,
        rawNiqqud: row.niqqud,
        classes: normalized.normalized,
        unhandled: normalized.unhandled,
        ambiguous: built.flags.ambiguous
      });
    }
  } finally {
    await irHandle.close();
  }

  let writtenStatsPath: string | undefined;
  let writtenWarningsPath: string | undefined;
  if (parsed.emitStats) {
    const written = await writeNiqqudQualityArtifacts({
      outputDir,
      stats: statsAccumulator.stats,
      warnings: statsAccumulator.warnings,
      writeWarningsJsonl: true
    });
    writtenStatsPath = written.statsPath;
    writtenWarningsPath = written.warningsPath;
  }

  const outputFiles = ["niqqud.ir.jsonl"];
  if (writtenStatsPath) {
    outputFiles.push(path.basename(writtenStatsPath));
  }
  if (writtenWarningsPath) {
    outputFiles.push(path.basename(writtenWarningsPath));
  }
  outputFiles.push("manifest.json");

  const manifest = createManifest({
    digest,
    spineDigest,
    configDigest,
    codeFingerprint,
    config,
    outputFiles
  });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    layer: "niqqud",
    digest,
    cacheHit: false,
    forced: parsed.force,
    outputDir,
    manifestPath,
    niqqudIrPath,
    ...(writtenStatsPath
      ? {
          statsPath: writtenStatsPath
        }
      : {}),
    ...(writtenWarningsPath
      ? {
          warningsPath: writtenWarningsPath
        }
      : {})
  };
}

if (require.main === module) {
  runBuildLayerNiqqud().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(
        `${mode}: layer=${result.layer} digest=${result.digest} output=${result.outputDir}`
      );
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`build-layer-niqqud failed: ${message}`);
      process.exit(1);
    }
  );
}
