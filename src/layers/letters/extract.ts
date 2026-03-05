import crypto from "node:crypto";
import fsRaw from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  LayerAnchorOrderingAccumulator,
  createLayerManifestCore,
  type LayerManifestCore
} from "../../ir/layer_manifest_core";
import { type SpineRecord } from "../../spine/schema";
import { classifyLetterOperator } from "./opMap";
import {
  assertLettersIRRecordsAgainstSpine,
  compareLettersIRRecords,
  serializeLettersIRRecord,
  type LettersIRRecord
} from "./schema";
import {
  computeLettersDigest,
  computeLettersLayerCodeFingerprint,
  DEFAULT_LETTERS_DIGEST_VERSION,
  type LettersDigestConfig
} from "./hash";
import { assignWordIds } from "./wordSeg";
import { assertSpineRecordShape, resolveHebrewLetter } from "./validate";

export type ExtractLettersIRForRefArgs = {
  spineRecordsForRef: Iterable<SpineRecord>;
  spineDigest: string;
  includeWordMetadata?: boolean;
  strictLetters?: boolean;
};

export type WriteExtractedLettersIRArgs = ExtractLettersIRForRefArgs & {
  outputPath: string;
};

export type WriteExtractedLettersIRResult = {
  outputPath: string;
  recordsWritten: number;
};

export type LettersLayerConfig = {
  include_word_segmentation: boolean;
  strict_letters: boolean;
};

export type LettersManifest = {
  layer: "letters";
  version: string;
  created_at: string;
  inputs: {
    spine_digest: string;
    spine_path: string;
  };
  config: LettersLayerConfig;
  outputs: {
    letters_ir_path: string;
  };
  counts: {
    letters_emitted: number;
    refs_seen: number;
  };
  cache_manifest: LayerManifestCore;
};

export type EmitLettersFromSpineArgs = {
  spinePath: string;
  spineManifestPath?: string;
  spineDigestOverride?: string;
  includeWordSegmentation?: boolean;
  strictLetters?: boolean;
  codeFingerprint?: string;
  version?: string;
  outCacheDir?: string;
  createdAt?: Date | string;
  force?: boolean;
  digest?: string;
};

export type EmitLettersFromSpineResult = {
  digest: string;
  outputDir: string;
  lettersIrPath: string;
  manifestPath: string;
  manifest: LettersManifest;
  counts: LettersManifest["counts"];
  cacheHit: boolean;
  forced: boolean;
};

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`extractLettersIRRecordsForRef: ${label} must be lowercase sha256 hex`);
  }
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty string`);
  }
}

function defaultLettersCacheDir(): string {
  return path.resolve(process.cwd(), "outputs", "cache", "letters");
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
      throw new Error("emitLettersFromSpine: createdAt must be valid ISO date-time");
    }
    return parsed.toISOString();
  }
  throw new Error("emitLettersFromSpine: createdAt must be Date | string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSpineDigest(args: {
  spinePath: string;
  spineManifestPath?: string;
  spineDigestOverride?: string;
}): Promise<string> {
  if (args.spineDigestOverride !== undefined) {
    assertSha256Hex(args.spineDigestOverride, "spineDigestOverride");
    return args.spineDigestOverride;
  }

  const manifestPath =
    args.spineManifestPath ?? path.join(path.dirname(args.spinePath), "manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(
      `emitLettersFromSpine: missing spine manifest at ${manifestPath}; provide spineDigestOverride`
    );
  }

  const raw = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.digests)) {
    throw new Error(`emitLettersFromSpine: invalid spine manifest at ${manifestPath}`);
  }
  const digest = parsed.digests.spineDigest;
  assertSha256Hex(digest, "spineManifest.digests.spineDigest");
  return digest;
}

async function readLettersManifest(filePath: string): Promise<LettersManifest> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`emitLettersFromSpine: invalid letters manifest at ${filePath}`);
  }
  if (parsed.layer !== "letters") {
    throw new Error(`emitLettersFromSpine: manifest.layer must be 'letters'`);
  }
  assertNonEmptyString(parsed.version, "manifest.version");
  assertNonEmptyString(parsed.created_at, "manifest.created_at");
  if (!isRecord(parsed.inputs)) {
    throw new Error("emitLettersFromSpine: manifest.inputs must be object");
  }
  assertSha256Hex(parsed.inputs.spine_digest, "manifest.inputs.spine_digest");
  assertNonEmptyString(parsed.inputs.spine_path, "manifest.inputs.spine_path");

  if (!isRecord(parsed.config)) {
    throw new Error("emitLettersFromSpine: manifest.config must be object");
  }
  if (typeof parsed.config.include_word_segmentation !== "boolean") {
    throw new Error(
      "emitLettersFromSpine: manifest.config.include_word_segmentation must be boolean"
    );
  }
  if (
    parsed.config.strict_letters !== undefined &&
    typeof parsed.config.strict_letters !== "boolean"
  ) {
    throw new Error("emitLettersFromSpine: manifest.config.strict_letters must be boolean");
  }

  if (!isRecord(parsed.outputs)) {
    throw new Error("emitLettersFromSpine: manifest.outputs must be object");
  }
  assertNonEmptyString(parsed.outputs.letters_ir_path, "manifest.outputs.letters_ir_path");

  if (!isRecord(parsed.counts)) {
    throw new Error("emitLettersFromSpine: manifest.counts must be object");
  }
  const lettersEmitted = Number(parsed.counts.letters_emitted);
  const refsSeen = Number(parsed.counts.refs_seen);
  if (!Number.isInteger(lettersEmitted) || lettersEmitted < 0) {
    throw new Error(
      "emitLettersFromSpine: manifest.counts.letters_emitted must be non-negative int"
    );
  }
  if (!Number.isInteger(refsSeen) || refsSeen < 0) {
    throw new Error("emitLettersFromSpine: manifest.counts.refs_seen must be non-negative int");
  }
  if (!isRecord(parsed.cache_manifest)) {
    throw new Error("emitLettersFromSpine: manifest.cache_manifest must be object");
  }

  return {
    layer: "letters",
    version: parsed.version,
    created_at: parsed.created_at,
    inputs: {
      spine_digest: parsed.inputs.spine_digest,
      spine_path: parsed.inputs.spine_path
    },
    config: {
      include_word_segmentation: parsed.config.include_word_segmentation,
      strict_letters: parsed.config.strict_letters === true
    },
    outputs: {
      letters_ir_path: parsed.outputs.letters_ir_path
    },
    counts: {
      letters_emitted: lettersEmitted,
      refs_seen: refsSeen
    },
    cache_manifest: parsed.cache_manifest as LayerManifestCore
  };
}

export async function* readSpineRecordsFromJsonl(
  spineJsonlPath: string
): AsyncGenerator<SpineRecord> {
  const stream = fsRaw.createReadStream(spineJsonlPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `letters extractor: ${spineJsonlPath}:${String(lineNumber)} invalid JSON (${message})`
        );
      }

      assertSpineRecordShape(parsed);
      yield parsed;
    }
  } finally {
    lines.close();
    stream.close();
  }
}

export function extractLettersIRRecordsForRef(args: ExtractLettersIRForRefArgs): LettersIRRecord[] {
  assertSha256Hex(args.spineDigest, "spineDigest");

  const spineRows = [...args.spineRecordsForRef];
  const includeWord = args.includeWordMetadata !== false;
  const strictLetters = args.strictLetters === true;
  const wordByGid = includeWord ? assignWordIds(spineRows) : new Map();
  const out: LettersIRRecord[] = [];

  for (const row of spineRows) {
    if (row.kind !== "g") {
      continue;
    }
    const letter = resolveHebrewLetter(
      row.base_letter,
      {
        ref_key: row.ref_key,
        gid: row.gid
      },
      strictLetters
    );
    if (!letter) {
      continue;
    }

    const classification = classifyLetterOperator(letter);
    const wordAnchor = wordByGid.get(row.gid);
    if (includeWord && !wordAnchor) {
      throw new Error(
        `extractLettersIRRecordsForRef: missing word assignment for gid='${row.gid}' in ref '${row.ref_key}'`
      );
    }

    out.push({
      kind: "letter_ir",
      gid: row.gid,
      ref_key: row.ref_key,
      g_index: row.g_index,
      letter: classification.letter,
      op_kind: classification.op_kind,
      features: classification.features,
      ...(includeWord && wordAnchor
        ? {
            word: {
              id: wordAnchor.wordId,
              index_in_word: wordAnchor.indexInWord
            }
          }
        : {}),
      source: {
        spine_digest: args.spineDigest
      }
    });
  }

  assertLettersIRRecordsAgainstSpine(out, spineRows);
  return out;
}

export async function writeExtractedLettersIRJsonl(
  args: WriteExtractedLettersIRArgs
): Promise<WriteExtractedLettersIRResult> {
  const records = extractLettersIRRecordsForRef(args);
  await fs.mkdir(path.dirname(args.outputPath), { recursive: true });

  const handle = await fs.open(args.outputPath, "w");
  let recordsWritten = 0;

  try {
    for (const record of records) {
      await handle.write(`${serializeLettersIRRecord(record)}\n`);
      recordsWritten += 1;
    }
  } finally {
    await handle.close();
  }

  return {
    outputPath: args.outputPath,
    recordsWritten
  };
}

export async function emitLettersFromSpine(
  args: EmitLettersFromSpineArgs
): Promise<EmitLettersFromSpineResult> {
  const spinePath = path.resolve(args.spinePath);
  const config: LettersDigestConfig = {
    include_word_segmentation: args.includeWordSegmentation !== false,
    strict_letters: args.strictLetters === true
  };
  const version = args.version ?? DEFAULT_LETTERS_DIGEST_VERSION;
  const spineDigest = await resolveSpineDigest({
    spinePath,
    spineManifestPath: args.spineManifestPath,
    spineDigestOverride: args.spineDigestOverride
  });
  const codeFingerprint = args.codeFingerprint ?? (await computeLettersLayerCodeFingerprint());
  const digest =
    args.digest ??
    computeLettersDigest({
      spineDigest,
      config,
      codeFingerprint,
      version
    });
  assertSha256Hex(digest, "digest");

  const cacheDir = args.outCacheDir ?? defaultLettersCacheDir();
  const outputDir = path.join(cacheDir, digest);
  const lettersIrPath = path.join(outputDir, "letters.ir.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");
  const hasCache = (await pathExists(lettersIrPath)) && (await pathExists(manifestPath));

  if (hasCache && !args.force) {
    try {
      const manifest = await readLettersManifest(manifestPath);
      return {
        digest,
        outputDir,
        lettersIrPath,
        manifestPath,
        manifest,
        counts: manifest.counts,
        cacheHit: true,
        forced: false
      };
    } catch {
      // Invalid/stale manifest: rebuild and overwrite cache entry.
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  const handle = await fs.open(lettersIrPath, "w");
  const closedRefs = new Set<string>();
  let currentRefKey: string | null = null;
  let currentRefRows: SpineRecord[] = [];
  let previousOutputRow: LettersIRRecord | null = null;
  const orderingAccumulator = new LayerAnchorOrderingAccumulator();
  const counts = {
    letters_emitted: 0,
    refs_seen: 0
  };

  const flushCurrentRef = async (): Promise<void> => {
    if (currentRefRows.length === 0) {
      return;
    }

    const rows = extractLettersIRRecordsForRef({
      spineRecordsForRef: currentRefRows,
      spineDigest,
      includeWordMetadata: config.include_word_segmentation,
      strictLetters: config.strict_letters
    });
    rows.sort(compareLettersIRRecords);

    for (const row of rows) {
      if (previousOutputRow && compareLettersIRRecords(previousOutputRow, row) >= 0) {
        throw new Error(
          "emitLettersFromSpine: non-canonical output ordering at " +
            `gid='${row.gid}' after gid='${previousOutputRow.gid}'`
        );
      }
      await handle.write(`${serializeLettersIRRecord(row)}\n`);
      orderingAccumulator.push(`gid:${row.gid}`);
      previousOutputRow = row;
      counts.letters_emitted += 1;
    }

    counts.refs_seen += 1;
    currentRefRows = [];
  };

  try {
    for await (const row of readSpineRecordsFromJsonl(spinePath)) {
      if (currentRefKey === null) {
        currentRefKey = row.ref_key;
      }

      if (row.ref_key !== currentRefKey) {
        closedRefs.add(currentRefKey);
        if (closedRefs.has(row.ref_key)) {
          throw new Error(
            `emitLettersFromSpine: spine rows for ref_key='${row.ref_key}' are not contiguous`
          );
        }
        await flushCurrentRef();
        currentRefKey = row.ref_key;
      }

      currentRefRows.push(row);
    }

    await flushCurrentRef();
  } finally {
    await handle.close();
  }

  const createdAtIso = toIsoString(args.createdAt);
  const ordering = orderingAccumulator.finalize();
  const manifest: LettersManifest = {
    layer: "letters",
    version,
    created_at: createdAtIso,
    inputs: {
      spine_digest: spineDigest,
      spine_path: spinePath
    },
    config,
    outputs: {
      letters_ir_path: lettersIrPath
    },
    counts,
    cache_manifest: createLayerManifestCore({
      layer_name: "letters",
      layer_semver: version,
      input_digests: {
        spineDigest: spineDigest,
        datasetDigest: null,
        configDigest: sha256Hex(JSON.stringify(config))
      },
      output_digest: sha256Hex(await fs.readFile(lettersIrPath)),
      ir_schema_version: version,
      stats: {
        record_count: counts.letters_emitted,
        gcount: counts.letters_emitted,
        gapcount: 0,
        event_counts: {}
      },
      ordering,
      timestamp: createdAtIso
    })
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    digest,
    outputDir,
    lettersIrPath,
    manifestPath,
    manifest,
    counts,
    cacheHit: false,
    forced: args.force === true
  };
}
