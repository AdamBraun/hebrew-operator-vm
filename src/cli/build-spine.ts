import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { buildSpineForRef } from "../spine/build";
import { emitSpine } from "../spine/emit";
import { computeSpineDigest } from "../spine/hash";
import { SPINE_RECORD_VERSION } from "../spine/manifest";
import {
  defaultNormalizationOptions,
  normalizeOptions,
  type NormalizationOptions
} from "../spine/options";
import { type SpineRecord } from "../spine/schema";
import { writeRunManifestSymlinks } from "./run_manifest_symlinks";

type VersePayload = {
  n: number;
  he?: string;
};

type ChapterPayload = {
  n: number;
  verses?: VersePayload[];
};

type BookPayload = {
  name: string;
  chapters?: ChapterPayload[];
};

type TorahCorpusPayload = {
  books?: BookPayload[];
};

type BuildSpineCliOptions = {
  input: string;
  outRoot: string;
  options: NormalizationOptions;
  force: boolean;
  codeFingerprint: string;
  schemaVersion: string;
};

export type BuildSpineCliResult = {
  spineDigest: string;
  cacheHit: boolean;
  forced: boolean;
  outputDir: string;
  manifestPath: string;
  spinePath: string;
  aliasPath: string;
};

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
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
    "  node src/cli/build-spine.ts --input data/torah.json --out outputs --unicode NFC --normalize-finals=false"
  );
  console.log("");
  console.log("Options:");
  console.log("  --input=path");
  console.log("  --out=dir (default: outputs)");
  console.log("  --unicode=NFC|NFKD|none");
  console.log("  --normalize-finals=true|false  (also --normalize-finals / --no-normalize-finals)");
  console.log(
    "  --strip-control-chars=true|false (also --strip-control-chars / --no-strip-control-chars)"
  );
  console.log(
    "  --preserve-punctuation=true|false (also --preserve-punctuation / --drop-punctuation)"
  );
  console.log(
    "  --error-on-unknown-mark=true|false (also --error-on-unknown-mark / --warn-on-unknown-mark)"
  );
  console.log("  --force");
}

async function readCodeFingerprint(): Promise<string> {
  try {
    const packagePath = path.resolve(process.cwd(), "package.json");
    const raw = await fs.readFile(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { name?: string; version?: string };
    const name = typeof parsed.name === "string" && parsed.name.length > 0 ? parsed.name : "spine";
    const version =
      typeof parsed.version === "string" && parsed.version.length > 0 ? parsed.version : "0.0.0";
    return `${name}@${version}:spine`;
  } catch {
    return "spine@0.0.0";
  }
}

export function parseArgs(argv: string[]): BuildSpineCliOptions {
  let input = path.resolve(process.cwd(), "data", "torah.json");
  let outRoot = path.resolve(process.cwd(), "outputs");
  let force = false;
  const optPatch: Partial<NormalizationOptions> = {};

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
    if (arg === "--normalize-finals") {
      optPatch.normalizeFinals = true;
      i += 1;
      continue;
    }
    if (arg === "--no-normalize-finals") {
      optPatch.normalizeFinals = false;
      i += 1;
      continue;
    }
    if (arg === "--strip-control-chars") {
      optPatch.stripControlChars = true;
      i += 1;
      continue;
    }
    if (arg === "--no-strip-control-chars") {
      optPatch.stripControlChars = false;
      i += 1;
      continue;
    }
    if (arg === "--preserve-punctuation") {
      optPatch.preservePunctuation = true;
      i += 1;
      continue;
    }
    if (arg === "--drop-punctuation") {
      optPatch.preservePunctuation = false;
      i += 1;
      continue;
    }
    if (arg === "--error-on-unknown-mark") {
      optPatch.errorOnUnknownMark = true;
      i += 1;
      continue;
    }
    if (arg === "--warn-on-unknown-mark") {
      optPatch.errorOnUnknownMark = false;
      i += 1;
      continue;
    }

    const inputOpt = readOptionValue(argv, i, "--input");
    if (inputOpt) {
      input = path.resolve(inputOpt.value);
      i = inputOpt.next;
      continue;
    }
    const outOpt = readOptionValue(argv, i, "--out");
    if (outOpt) {
      outRoot = path.resolve(outOpt.value);
      i = outOpt.next;
      continue;
    }
    const unicodeOpt =
      readOptionValue(argv, i, "--unicode") ?? readOptionValue(argv, i, "--unicode-form");
    if (unicodeOpt) {
      optPatch.unicodeForm = unicodeOpt.value as NormalizationOptions["unicodeForm"];
      i = unicodeOpt.next;
      continue;
    }
    const normalizeFinalsOpt = readOptionValue(argv, i, "--normalize-finals");
    if (normalizeFinalsOpt) {
      optPatch.normalizeFinals = asBoolean(normalizeFinalsOpt.value, "--normalize-finals");
      i = normalizeFinalsOpt.next;
      continue;
    }
    const stripControlOpt = readOptionValue(argv, i, "--strip-control-chars");
    if (stripControlOpt) {
      optPatch.stripControlChars = asBoolean(stripControlOpt.value, "--strip-control-chars");
      i = stripControlOpt.next;
      continue;
    }
    const punctOpt = readOptionValue(argv, i, "--preserve-punctuation");
    if (punctOpt) {
      optPatch.preservePunctuation = asBoolean(punctOpt.value, "--preserve-punctuation");
      i = punctOpt.next;
      continue;
    }
    const unknownMarkOpt = readOptionValue(argv, i, "--error-on-unknown-mark");
    if (unknownMarkOpt) {
      optPatch.errorOnUnknownMark = asBoolean(unknownMarkOpt.value, "--error-on-unknown-mark");
      i = unknownMarkOpt.next;
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

  return {
    input,
    outRoot,
    options: normalizeOptions(optPatch),
    force,
    codeFingerprint: "PENDING",
    schemaVersion: SPINE_RECORD_VERSION
  };
}

function enumerateRefs(payload: TorahCorpusPayload): Array<{ ref_key: string; text: string }> {
  const out: Array<{ ref_key: string; text: string }> = [];
  for (const book of payload.books ?? []) {
    const bookName = String(book.name ?? "").trim();
    if (!bookName) {
      continue;
    }
    for (const chapter of book.chapters ?? []) {
      const chapterN = Number(chapter.n);
      if (!Number.isInteger(chapterN) || chapterN <= 0) {
        continue;
      }
      for (const verse of chapter.verses ?? []) {
        const verseN = Number(verse.n);
        if (!Number.isInteger(verseN) || verseN <= 0) {
          continue;
        }
        const ref_key = `${bookName}/${chapterN}/${verseN}`;
        const text = typeof verse.he === "string" ? verse.he : "";
        out.push({ ref_key, text });
      }
    }
  }
  return out;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeAliasFile(args: {
  outRoot: string;
  spineDigest: string;
  manifestPath: string;
}): Promise<string> {
  const aliases = await writeRunManifestSymlinks({
    outRoot: args.outRoot,
    layer: "spine",
    digest: args.spineDigest,
    manifestPath: args.manifestPath
  });
  return aliases.latestAliasPath;
}

async function canReuseSpineCache(args: {
  manifestPath: string;
  expectedDigest: string;
}): Promise<boolean> {
  try {
    const raw = await fs.readFile(args.manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return false;
    }
    const manifest = parsed as Record<string, unknown>;
    if (manifest.layer !== "spine") {
      return false;
    }
    if (
      typeof manifest.digests !== "object" ||
      manifest.digests === null ||
      Array.isArray(manifest.digests)
    ) {
      return false;
    }
    const digests = manifest.digests as Record<string, unknown>;
    if (digests.spineDigest !== args.expectedDigest) {
      return false;
    }
    if (
      typeof manifest.cache_manifest !== "object" ||
      manifest.cache_manifest === null ||
      Array.isArray(manifest.cache_manifest)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function* buildRecordsForPayload(
  refs: readonly { ref_key: string; text: string }[],
  opts: NormalizationOptions
): AsyncGenerator<SpineRecord> {
  for (const ref of refs) {
    yield* buildSpineForRef({ ref_key: ref.ref_key, text: ref.text, opts });
  }
}

export async function runBuildSpine(
  rawArgv: string[] = process.argv.slice(2)
): Promise<BuildSpineCliResult> {
  const parsed = parseArgs(rawArgv);
  const codeFingerprint = await readCodeFingerprint();
  const opts = normalizeOptions(parsed.options);

  const inputBuffer = await fs.readFile(parsed.input);
  const inputSha256 = sha256Hex(inputBuffer);
  const digest = computeSpineDigest({
    inputSha256,
    options: opts,
    codeFingerprint,
    schemaVersion: parsed.schemaVersion
  });

  const cacheBase = path.join(parsed.outRoot, "cache", "spine");
  const outputDir = path.join(cacheBase, digest);
  const spinePath = path.join(outputDir, "spine.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");

  const hasCache = (await pathExists(spinePath)) && (await pathExists(manifestPath));
  if (
    hasCache &&
    !parsed.force &&
    (await canReuseSpineCache({ manifestPath, expectedDigest: digest }))
  ) {
    const aliasPath = await writeAliasFile({
      outRoot: parsed.outRoot,
      spineDigest: digest,
      manifestPath
    });
    return {
      spineDigest: digest,
      cacheHit: true,
      forced: false,
      outputDir,
      manifestPath,
      spinePath,
      aliasPath
    };
  }

  const payload = JSON.parse(inputBuffer.toString("utf8")) as TorahCorpusPayload;
  const refs = enumerateRefs(payload);
  const emitted = await emitSpine({
    records: buildRecordsForPayload(refs, opts),
    input: {
      path: parsed.input,
      sha256: inputSha256
    },
    options: opts,
    spineDigest: digest,
    outCacheDir: cacheBase
  });

  const aliasPath = await writeAliasFile({
    outRoot: parsed.outRoot,
    spineDigest: emitted.spineDigest,
    manifestPath: emitted.manifestPath
  });

  return {
    spineDigest: emitted.spineDigest,
    cacheHit: false,
    forced: parsed.force,
    outputDir: emitted.outputDir,
    manifestPath: emitted.manifestPath,
    spinePath: emitted.spinePath,
    aliasPath
  };
}

if (require.main === module) {
  runBuildSpine().then(
    (result) => {
      const mode = result.cacheHit ? "cache-hit" : "built";
      console.log(`${mode}: spineDigest=${result.spineDigest} output=${result.outputDir}`);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`build-spine failed: ${message}`);
      process.exit(1);
    }
  );
}
