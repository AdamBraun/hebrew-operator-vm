import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  STITCHER_VERSION,
  stitchProgramIRFromFiles,
  type ProgramManifest
} from "../wrapper/program_schema";

type StitchProgramCliOptions = {
  spineArg: string;
  lettersArg: string;
  niqqudArg: string;
  cantArg: string;
  layoutArg: string;
  metadataArg: string;
  outDir: string;
  force: boolean;
  createdAt?: string;
};

type StitchInputDigests = {
  spineDigest: string;
  lettersDigest: string;
  niqqudDigest: string;
  cantDigest: string;
  layoutDigest: string;
  metadataDigest: string;
};

type StitchConfig = {
  outputFormat: "jsonl";
  includeLetterCantillation: boolean;
  includeGapRaw: boolean;
};

type RefStat = {
  firstRef: string;
  lastRef: string;
  ops: number;
  boundaries: number;
};

export type ProgramMeta = {
  spineDigest: string;
  lettersDigest: string;
  niqqudDigest: string;
  cantDigest: string;
  layoutDigest: string;
  metadataDigest: string;
  stitcherVersion: string;
  stitchConfig: StitchConfig;
  counts: {
    ops: number;
    boundaries: number;
    checkpoints: number;
  };
  cacheDigest: string;
  programDigest: string;
  manifestDigest: string;
  createdAt: string;
  refStats?: Record<string, RefStat>;
};

export type StitchProgramCliResult = {
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  programPath: string;
  metaPath: string;
  manifestPath: string;
  cacheDigest: string;
  programDigest: string;
};

const INPUT_FILE_CANDIDATES = {
  spine: ["Spine.jsonl", "spine.jsonl"],
  letters: ["LettersIR.jsonl", "letters.ir.jsonl"],
  niqqud: ["NiqqudIR.jsonl", "niqqud.ir.jsonl"],
  cant: ["CantillationIR.jsonl", "cantillation.ir.jsonl"],
  layout: ["LayoutIR.jsonl", "layout.ir.jsonl"],
  metadata: ["MetadataPlan.json", "metadata_plan.json", "metadata.plan.json"]
} as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
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
      throw new Error(`stitch-program: missing value for ${flag}`);
    }
    return { value, next: index + 2 };
  }
  if (arg.startsWith(`${flag}=`)) {
    return { value: arg.slice(`${flag}=`.length), next: index + 1 };
  }
  return null;
}

function asBoolean(value: string, label: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (lowered === "true" || lowered === "1" || lowered === "yes") {
    return true;
  }
  if (lowered === "false" || lowered === "0" || lowered === "no") {
    return false;
  }
  throw new Error(`stitch-program: invalid ${label} value '${value}', expected true|false`);
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`stitch-program: ${label} must be non-empty string`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node src/cli/stitch-program.ts --spine <dir|file> --letters <dir|file> --niqqud <dir|file> --cant <dir|file> --layout <dir|file> --metadata <dir|file> --out <dir>"
  );
  console.log("");
  console.log("Options:");
  console.log("  --spine=path");
  console.log("  --letters=path");
  console.log("  --niqqud=path");
  console.log("  --cant=path");
  console.log("  --layout=path");
  console.log("  --metadata=path");
  console.log("  --out=dir");
  console.log("  --created-at=<ISO date-time> (optional)");
  console.log("  --force=true|false (default false)");
}

export function parseArgs(argv: string[]): StitchProgramCliOptions {
  let spineArg: string | null = null;
  let lettersArg: string | null = null;
  let niqqudArg: string | null = null;
  let cantArg: string | null = null;
  let layoutArg: string | null = null;
  let metadataArg: string | null = null;
  let outDir: string | null = null;
  let createdAt: string | undefined;
  let force = false;

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

    const spineOpt = readOptionValue(argv, i, "--spine");
    if (spineOpt) {
      spineArg = path.resolve(spineOpt.value);
      i = spineOpt.next;
      continue;
    }
    const lettersOpt = readOptionValue(argv, i, "--letters");
    if (lettersOpt) {
      lettersArg = path.resolve(lettersOpt.value);
      i = lettersOpt.next;
      continue;
    }
    const niqqudOpt = readOptionValue(argv, i, "--niqqud");
    if (niqqudOpt) {
      niqqudArg = path.resolve(niqqudOpt.value);
      i = niqqudOpt.next;
      continue;
    }
    const cantOpt = readOptionValue(argv, i, "--cant");
    if (cantOpt) {
      cantArg = path.resolve(cantOpt.value);
      i = cantOpt.next;
      continue;
    }
    const layoutOpt = readOptionValue(argv, i, "--layout");
    if (layoutOpt) {
      layoutArg = path.resolve(layoutOpt.value);
      i = layoutOpt.next;
      continue;
    }
    const metadataOpt = readOptionValue(argv, i, "--metadata");
    if (metadataOpt) {
      metadataArg = path.resolve(metadataOpt.value);
      i = metadataOpt.next;
      continue;
    }
    const outOpt = readOptionValue(argv, i, "--out");
    if (outOpt) {
      outDir = path.resolve(outOpt.value);
      i = outOpt.next;
      continue;
    }
    const createdAtOpt = readOptionValue(argv, i, "--created-at");
    if (createdAtOpt) {
      const parsed = new Date(createdAtOpt.value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("stitch-program: --created-at must be valid ISO date-time");
      }
      createdAt = parsed.toISOString();
      i = createdAtOpt.next;
      continue;
    }
    const forceOpt = readOptionValue(argv, i, "--force");
    if (forceOpt) {
      force = asBoolean(forceOpt.value, "--force");
      i = forceOpt.next;
      continue;
    }

    throw new Error(`stitch-program: unknown argument '${arg}'`);
  }

  if (!spineArg) {
    throw new Error("stitch-program: missing required --spine");
  }
  if (!lettersArg) {
    throw new Error("stitch-program: missing required --letters");
  }
  if (!niqqudArg) {
    throw new Error("stitch-program: missing required --niqqud");
  }
  if (!cantArg) {
    throw new Error("stitch-program: missing required --cant");
  }
  if (!layoutArg) {
    throw new Error("stitch-program: missing required --layout");
  }
  if (!metadataArg) {
    throw new Error("stitch-program: missing required --metadata");
  }
  if (!outDir) {
    throw new Error("stitch-program: missing required --out");
  }

  return {
    spineArg,
    lettersArg,
    niqqudArg,
    cantArg,
    layoutArg,
    metadataArg,
    outDir,
    force,
    ...(createdAt ? { createdAt } : {})
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

async function resolveInputFile(args: {
  label: keyof typeof INPUT_FILE_CANDIDATES;
  inputArg: string;
}): Promise<string> {
  const resolved = path.resolve(args.inputArg);
  const stat = await fs.stat(resolved);
  if (stat.isFile()) {
    return resolved;
  }

  const candidates = INPUT_FILE_CANDIDATES[args.label];
  for (const name of candidates) {
    const maybe = path.join(resolved, name);
    if (await pathExists(maybe)) {
      return maybe;
    }
  }
  throw new Error(
    `stitch-program: unable to resolve ${args.label} input file in ${resolved}; tried ${candidates.join(", ")}`
  );
}

async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return sha256Hex(data);
}

function createStitchConfig(): StitchConfig {
  return {
    outputFormat: "jsonl",
    includeLetterCantillation: true,
    includeGapRaw: true
  };
}

function buildCacheDigest(args: {
  digests: StitchInputDigests;
  stitcherVersion: string;
  stitchConfig: StitchConfig;
}): string {
  const payload = {
    inputDigests: args.digests,
    stitcherVersion: args.stitcherVersion,
    stitchConfig: args.stitchConfig
  };
  return sha256Hex(canonicalStringify(payload));
}

function buildRefStats(manifest: ProgramManifest): Record<string, RefStat> | undefined {
  if (!manifest.ref_ranges_by_book) {
    return undefined;
  }
  const out: Record<string, RefStat> = {};
  for (const book of Object.keys(manifest.ref_ranges_by_book).sort(compareText)) {
    const entry = manifest.ref_ranges_by_book[book];
    out[book] = {
      firstRef: entry.first_ref,
      lastRef: entry.last_ref,
      ops: entry.ops,
      boundaries: entry.boundaries
    };
  }
  return out;
}

function createProgramMeta(args: {
  digests: StitchInputDigests;
  stitcherVersion: string;
  stitchConfig: StitchConfig;
  counts: { ops: number; boundaries: number; checkpoints: number };
  cacheDigest: string;
  programDigest: string;
  manifestDigest: string;
  createdAt: string;
  refStats?: Record<string, RefStat>;
}): ProgramMeta {
  return {
    spineDigest: args.digests.spineDigest,
    lettersDigest: args.digests.lettersDigest,
    niqqudDigest: args.digests.niqqudDigest,
    cantDigest: args.digests.cantDigest,
    layoutDigest: args.digests.layoutDigest,
    metadataDigest: args.digests.metadataDigest,
    stitcherVersion: args.stitcherVersion,
    stitchConfig: args.stitchConfig,
    counts: {
      ops: args.counts.ops,
      boundaries: args.counts.boundaries,
      checkpoints: args.counts.checkpoints
    },
    cacheDigest: args.cacheDigest,
    programDigest: args.programDigest,
    manifestDigest: args.manifestDigest,
    createdAt: args.createdAt,
    ...(args.refStats ? { refStats: args.refStats } : {})
  };
}

async function readMetaSafe(filePath: string): Promise<ProgramMeta | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    assertNonEmptyString(parsed.cacheDigest, "program.meta.cacheDigest");
    assertNonEmptyString(parsed.programDigest, "program.meta.programDigest");
    assertNonEmptyString(parsed.stitcherVersion, "program.meta.stitcherVersion");
    if (!SHA256_HEX.test(parsed.cacheDigest)) {
      return null;
    }
    if (!SHA256_HEX.test(parsed.programDigest)) {
      return null;
    }
    return parsed as ProgramMeta;
  } catch {
    return null;
  }
}

export async function runStitchProgram(
  rawArgv: string[] = process.argv.slice(2)
): Promise<StitchProgramCliResult> {
  const parsed = parseArgs(rawArgv);
  const [
    spinePath,
    lettersIrPath,
    niqqudIrPath,
    cantillationIrPath,
    layoutIrPath,
    metadataPlanPath
  ] = await Promise.all([
    resolveInputFile({ label: "spine", inputArg: parsed.spineArg }),
    resolveInputFile({ label: "letters", inputArg: parsed.lettersArg }),
    resolveInputFile({ label: "niqqud", inputArg: parsed.niqqudArg }),
    resolveInputFile({ label: "cant", inputArg: parsed.cantArg }),
    resolveInputFile({ label: "layout", inputArg: parsed.layoutArg }),
    resolveInputFile({ label: "metadata", inputArg: parsed.metadataArg })
  ]);

  const digests: StitchInputDigests = {
    spineDigest: await sha256File(spinePath),
    lettersDigest: await sha256File(lettersIrPath),
    niqqudDigest: await sha256File(niqqudIrPath),
    cantDigest: await sha256File(cantillationIrPath),
    layoutDigest: await sha256File(layoutIrPath),
    metadataDigest: await sha256File(metadataPlanPath)
  };
  const stitchConfig = createStitchConfig();
  const cacheDigest = buildCacheDigest({
    digests,
    stitcherVersion: STITCHER_VERSION,
    stitchConfig
  });

  const outputDir = path.resolve(parsed.outDir);
  const programPath = path.join(outputDir, "ProgramIR.jsonl");
  const metaPath = path.join(outputDir, "program.meta.json");
  const manifestPath = path.join(outputDir, "program.manifest.json");

  if (!parsed.force) {
    const [existingMeta, programExists, manifestExists] = await Promise.all([
      readMetaSafe(metaPath),
      pathExists(programPath),
      pathExists(manifestPath)
    ]);
    if (programExists && manifestExists && existingMeta?.cacheDigest === cacheDigest) {
      return {
        cacheHit: true,
        forced: false,
        outputDir,
        programPath,
        metaPath,
        manifestPath,
        cacheDigest,
        programDigest: existingMeta.programDigest
      };
    }
  }

  const stitched = await stitchProgramIRFromFiles({
    spinePath,
    lettersIrPath,
    niqqudIrPath,
    cantillationIrPath,
    layoutIrPath,
    metadataPlanPath,
    outputFormat: "jsonl",
    ...(parsed.createdAt ? { createdAt: parsed.createdAt } : {})
  });

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(programPath, stitched.programIrJsonl, "utf8"),
    fs.writeFile(manifestPath, stitched.manifestText, "utf8")
  ]);

  const programDigest = sha256Hex(stitched.programIrJsonl);
  const manifestDigest = sha256Hex(stitched.manifestText);
  const createdAt =
    parsed.createdAt ??
    (typeof stitched.manifest.created_at === "string"
      ? stitched.manifest.created_at
      : new Date().toISOString());
  const meta = createProgramMeta({
    digests,
    stitcherVersion: STITCHER_VERSION,
    stitchConfig,
    counts: {
      ops: stitched.manifest.counts.ops,
      boundaries: stitched.manifest.counts.boundaries,
      checkpoints: stitched.manifest.counts.checkpoints
    },
    cacheDigest,
    programDigest,
    manifestDigest,
    createdAt,
    refStats: buildRefStats(stitched.manifest)
  });
  await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  return {
    cacheHit: false,
    forced: parsed.force,
    outputDir,
    programPath,
    metaPath,
    manifestPath,
    cacheDigest,
    programDigest
  };
}

if (require.main === module) {
  runStitchProgram().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(`${mode}: programDigest=${result.programDigest} out=${result.outputDir}`);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`stitch-program failed: ${message}`);
      process.exit(1);
    }
  );
}
