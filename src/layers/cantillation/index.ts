import path from "node:path";
import { extractCantillationIR, type ExtractCantillationIRConfig } from "./extract";

export type CantillationCliOptions = {
  spinePath: string;
  outArg: string;
  strict: boolean;
  emitUnknown: boolean;
  sofPasukRank: number;
  dumpStats: boolean;
  force: boolean;
  spineDigestOverride?: string;
};

export type CantillationCliResult = {
  layer: "cantillation";
  digest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  cantillationIrPath: string;
  statsPath?: string;
};

const SHA256_HEX = /^[a-f0-9]{64}$/;

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`cantillation cli: ${label} must be non-empty string`);
  }
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`cantillation cli: ${label} must be lowercase sha256 hex`);
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
  throw new Error(`cantillation cli: invalid ${label} value '${value}', expected true|false`);
}

function asPositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`cantillation cli: ${label} must be integer >= 1`);
  }
  return parsed;
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
      throw new Error(`cantillation cli: missing value for ${flag}`);
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
    "  node src/layers/cantillation/index.ts --spine <spine.jsonl|spine_dir|spine_manifest.json> --out <outputs|outputs/cache/cantillation>"
  );
  console.log("");
  console.log("Options:");
  console.log("  --spine=path");
  console.log("  --out=path (defaults to outputs/cache/cantillation)");
  console.log("  --spine-digest=<sha256> (optional override)");
  console.log("  --strict=true|false (default false)");
  console.log("  --emit-unknown=true|false (default false)");
  console.log("  --sof-pasuk-rank=<int>=3 (default 3)");
  console.log("  --dump-stats=true|false (default false)");
  console.log("  --force=true|false (default false)");
}

function resolveCantillationCacheDir(outArg: string): string {
  const resolved = path.resolve(outArg);
  const parts = resolved.split(path.sep).filter((segment) => segment.length > 0);
  const isCacheLayer =
    parts.length >= 2 &&
    parts[parts.length - 2] === "cache" &&
    parts[parts.length - 1] === "cantillation";
  if (isCacheLayer) {
    return resolved;
  }
  return path.join(resolved, "cache", "cantillation");
}

function resolveSpinePathValue(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (path.basename(resolved) === "manifest.json") {
    return path.join(path.dirname(resolved), "spine.jsonl");
  }
  if (path.extname(resolved) === "") {
    return path.join(resolved, "spine.jsonl");
  }
  return resolved;
}

export function parseCantillationArgs(argv: string[]): CantillationCliOptions {
  let spinePath: string | null = null;
  let outArg: string | null = null;
  let strict = false;
  let emitUnknown = false;
  let sofPasukRank = 3;
  let dumpStats = false;
  let force = false;
  let spineDigestOverride: string | undefined;

  for (let i = 0; i < argv.length; ) {
    const arg = argv[i] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
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

    const sofRankOpt = readOptionValue(argv, i, "--sof-pasuk-rank");
    if (sofRankOpt) {
      sofPasukRank = asPositiveInteger(sofRankOpt.value, "--sof-pasuk-rank");
      i = sofRankOpt.next;
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

    const spineDigestOpt = readOptionValue(argv, i, "--spine-digest");
    if (spineDigestOpt) {
      spineDigestOverride = spineDigestOpt.value;
      i = spineDigestOpt.next;
      continue;
    }

    throw new Error(`cantillation cli: unknown argument '${arg}'`);
  }

  if (!spinePath) {
    throw new Error("cantillation cli: missing required --spine");
  }

  if (spineDigestOverride !== undefined) {
    assertSha256Hex(spineDigestOverride, "spineDigest");
  }

  return {
    spinePath,
    outArg: resolveCantillationCacheDir(
      outArg ?? path.resolve(process.cwd(), "outputs", "cache", "cantillation")
    ),
    strict,
    emitUnknown,
    sofPasukRank,
    dumpStats,
    force,
    ...(spineDigestOverride ? { spineDigestOverride } : {})
  };
}

export async function runCantillationCli(
  rawArgv: string[] = process.argv.slice(2)
): Promise<CantillationCliResult> {
  const parsed = parseCantillationArgs(rawArgv);

  const extractConfig: ExtractCantillationIRConfig = {
    strict: parsed.strict,
    emitUnknown: parsed.emitUnknown,
    sofPasukRank: parsed.sofPasukRank,
    dumpStats: parsed.dumpStats,
    force: parsed.force,
    ...(parsed.spineDigestOverride
      ? {
          spineDigestOverride: parsed.spineDigestOverride
        }
      : {}),
    ...(path.basename(parsed.spinePath) === "manifest.json"
      ? {
          spineManifestPath: parsed.spinePath
        }
      : {})
  };

  const resolvedSpinePath = resolveSpinePathValue(parsed.spinePath);
  const result = await extractCantillationIR(resolvedSpinePath, parsed.outArg, extractConfig);

  return {
    layer: "cantillation",
    digest: result.digest,
    cacheHit: result.cacheHit,
    forced: result.forced,
    outputDir: result.outputDir,
    manifestPath: result.manifestPath,
    cantillationIrPath: result.cantillationIrPath,
    ...(result.statsPath ? { statsPath: result.statsPath } : {})
  };
}

if (require.main === module) {
  runCantillationCli().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(
        `${mode}: layer=${result.layer} digest=${result.digest} output=${result.outputDir}`
      );
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`cantillation build failed: ${message}`);
      process.exit(1);
    }
  );
}
