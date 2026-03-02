import crypto from "node:crypto";
import fsRaw from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  CANTILLATION_ANCHORING_RULES,
  anchorPunctuationBoundaryToGap,
  anchorTropeMarkToGid,
  emitsDerivedBoundariesFromTropeMarks
} from "./anchoring";
import { CANTILLATION_PLACEMENT_POLICY_VERSION } from "./placement";
import {
  CANTILLATION_LAYER_VERSION,
  assertCantillationManifest,
  createCantillationManifest,
  type CantillationManifest,
  type CantillationManifestOutputFile
} from "./manifest";
import {
  createCantillationMarkCoverage,
  resolveCantillationMarkWithCoverage,
  type CantillationMarkCoverage,
  type TropeClass
} from "./marks";
import {
  compareCantillationEvents,
  compareRefKeysStable,
  serializeCantillationIRRecord,
  type CantillationEvent,
  type CantillationIRRecord
} from "./schema";
import {
  DEFAULT_CANTILLATION_CODE_PATHS,
  computeCantillationCodeHash,
  computeCantillationConfigHash,
  computeCantillationDigest,
  type CantillationDigestConfig
} from "./hash";
import { CantillationAnchorValidator } from "./validate";

export type CantillationLayerConfig = CantillationDigestConfig;

export type ExtractCantillationIRConfig = {
  strict?: boolean;
  emitUnknown?: boolean;
  sofPasukRank?: number;
  dumpStats?: boolean;
  topMarksLimit?: number;
  spineManifestPath?: string;
  spineDigestOverride?: string;
  codeHashOverride?: string;
  digestOverride?: string;
  force?: boolean;
};

export type CantillationTopMark = {
  mark: string;
  codepoint: string;
  count: number;
  mapped: boolean;
  name: string;
  class: TropeClass | "UNKNOWN";
};

export type CantillationRefCoverage = {
  ref_key: string;
  graphemes: number;
  marks_seen: number;
  marks_mapped: number;
  marks_unknown: number;
  gap_events: number;
  events_emitted: number;
};

export type CantillationStats = {
  layer: "cantillation";
  totals: {
    graphemes: number;
    marks_seen: number;
    marks_mapped: number;
    marks_unknown: number;
    gap_events: number;
    events_emitted: number;
    gid_events: number;
  };
  top_marks: CantillationTopMark[];
  ref_key_coverage: {
    refs_seen: number;
    refs_with_marks: number;
    refs_with_gap_events: number;
    refs: CantillationRefCoverage[];
  };
  config: {
    strict: boolean;
    emit_unknown: boolean;
    sof_pasuk_rank: number;
    dump_stats: boolean;
    top_marks_limit: number;
  };
};

export type ExtractCantillationIRResult = {
  digest: string;
  outputDir: string;
  cantillationIrPath: string;
  manifestPath: string;
  statsPath?: string;
  manifest: CantillationManifest;
  stats: CantillationStats;
  cacheHit: boolean;
  forced: boolean;
};

type UnknownRecord = Record<string, unknown>;

type ParsedSpineGraphemeRecord = {
  kind: "g";
  gid: string;
  ref_key: string;
  g_index: number;
  marks_raw: {
    teamim: string[];
  };
};

type ParsedSpineGapRecord = {
  kind: "gap";
  gapid: string;
  ref_key: string;
  gap_index: number;
  raw: {
    chars: string[];
    maqaf_char: boolean;
    sof_pasuk_char: boolean;
  };
};

type ParsedSpineRecord = ParsedSpineGraphemeRecord | ParsedSpineGapRecord;

type MarkTally = {
  mark: string;
  codepoint: string;
  count: number;
  mapped: boolean;
  name: string;
  class: TropeClass | "UNKNOWN";
};

type RefTally = {
  graphemes: number;
  marks_seen: number;
  marks_mapped: number;
  marks_unknown: number;
  gap_events: number;
  events_emitted: number;
};

const OWN = Object.prototype.hasOwnProperty;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;
const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;
const MAQAF = "\u05BE";
const SOF_PASUQ = "\u05C3";
const DEFAULT_TOP_MARKS_LIMIT = 10;

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function assertSha256Hex(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new Error(`cantillation extract: ${label} must be lowercase sha256 hex`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`cantillation extract: ${label} must be integer >= 1`);
  }
}

function parseGid(gid: string): { ref_key: string; g_index: number } | null {
  const match = gid.match(GID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const g_index = Number(match[2]);
  if (!Number.isInteger(g_index) || g_index < 0) {
    return null;
  }
  return { ref_key, g_index };
}

function parseGapId(gapid: string): { ref_key: string; gap_index: number } | null {
  const match = gapid.match(GAPID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const gap_index = Number(match[2]);
  if (!Number.isInteger(gap_index) || gap_index < 0) {
    return null;
  }
  return { ref_key, gap_index };
}

function toCodepointKey(mark: string): string {
  const cp = mark.codePointAt(0);
  if (cp === undefined) {
    throw new Error(`cantillation extract: unable to derive codepoint for mark '${mark}'`);
  }
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function sortMarksDeterministically(marks: readonly string[]): string[] {
  return [...marks].sort((left, right) => compareText(toCodepointKey(left), toCodepointKey(right)));
}

function defaultCacheDir(): string {
  return path.resolve(process.cwd(), "outputs", "cache", "cantillation");
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

function normalizeConfig(config: ExtractCantillationIRConfig | undefined): CantillationLayerConfig {
  const sof_pasuk_rank = config?.sofPasukRank ?? 3;
  assertPositiveInteger(sof_pasuk_rank, "sofPasukRank");

  const top_marks_limit = config?.topMarksLimit ?? DEFAULT_TOP_MARKS_LIMIT;
  assertPositiveInteger(top_marks_limit, "topMarksLimit");

  return {
    strict: config?.strict === true,
    emit_unknown: config?.emitUnknown === true,
    sof_pasuk_rank,
    dump_stats: config?.dumpStats === true,
    top_marks_limit,
    placement_policy: {
      derived_boundaries_from_trope_marks:
        CANTILLATION_ANCHORING_RULES.derived_boundaries_from_trope_marks,
      gid_disj_cut_placement: "next_gap_or_ref_end_gap",
      anchoring_version: CANTILLATION_ANCHORING_RULES.version,
      placement_version: CANTILLATION_PLACEMENT_POLICY_VERSION
    }
  };
}

async function resolveSpineDigest(args: {
  spinePath: string;
  spineManifestPath?: string;
  override?: string;
}): Promise<string> {
  if (args.override !== undefined) {
    assertSha256Hex(args.override, "spineDigestOverride");
    return args.override;
  }

  const manifestPath =
    args.spineManifestPath ?? path.join(path.dirname(args.spinePath), "manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(
      `cantillation extract: unable to resolve spine digest (missing manifest at ${manifestPath}); provide spineDigestOverride`
    );
  }

  const parsed = await readJsonFile(manifestPath);
  if (!isRecord(parsed) || !isRecord(parsed.digests)) {
    throw new Error(`cantillation extract: invalid spine manifest at ${manifestPath}`);
  }

  const digest = parsed.digests.spineDigest;
  assertSha256Hex(digest, "spineManifest.digests.spineDigest");
  return digest;
}

function describe(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function failSpine(sourcePath: string, lineNumber: number, message: string): never {
  throw new Error(`cantillation extract: ${sourcePath}:${String(lineNumber)} ${message}`);
}

function parseSpineRecord(
  value: unknown,
  sourcePath: string,
  lineNumber: number
): ParsedSpineRecord {
  if (!isRecord(value)) {
    failSpine(sourcePath, lineNumber, `expected object, got ${describe(value)}`);
  }

  const kind = value.kind;
  if (kind === "g") {
    if (!isNonEmptyString(value.gid) || !isNonEmptyString(value.ref_key)) {
      failSpine(sourcePath, lineNumber, "grapheme record requires non-empty gid/ref_key");
    }
    if (!isNonNegativeInteger(value.g_index)) {
      failSpine(sourcePath, lineNumber, `invalid g_index ${describe(value.g_index)}`);
    }
    if (!isRecord(value.marks_raw) || !isStringArray(value.marks_raw.teamim)) {
      failSpine(sourcePath, lineNumber, "grapheme record requires marks_raw.teamim string[]");
    }

    const parsedGid = parseGid(value.gid);
    if (!parsedGid) {
      failSpine(sourcePath, lineNumber, `invalid gid '${value.gid}'`);
    }
    if (parsedGid.ref_key !== value.ref_key || parsedGid.g_index !== value.g_index) {
      failSpine(
        sourcePath,
        lineNumber,
        `gid '${value.gid}' must match ref_key='${value.ref_key}' and g_index=${String(value.g_index)}`
      );
    }

    return {
      kind: "g",
      gid: value.gid,
      ref_key: value.ref_key,
      g_index: value.g_index,
      marks_raw: {
        teamim: value.marks_raw.teamim
      }
    };
  }

  if (kind === "gap") {
    if (!isNonEmptyString(value.gapid) || !isNonEmptyString(value.ref_key)) {
      failSpine(sourcePath, lineNumber, "gap record requires non-empty gapid/ref_key");
    }
    if (!isNonNegativeInteger(value.gap_index)) {
      failSpine(sourcePath, lineNumber, `invalid gap_index ${describe(value.gap_index)}`);
    }
    if (!isRecord(value.raw)) {
      failSpine(sourcePath, lineNumber, "gap record requires raw object");
    }

    const parsedGap = parseGapId(value.gapid);
    if (!parsedGap) {
      failSpine(sourcePath, lineNumber, `invalid gapid '${value.gapid}'`);
    }
    if (parsedGap.ref_key !== value.ref_key || parsedGap.gap_index !== value.gap_index) {
      failSpine(
        sourcePath,
        lineNumber,
        `gapid '${value.gapid}' must match ref_key='${value.ref_key}' and gap_index=${String(value.gap_index)}`
      );
    }

    const chars = isStringArray(value.raw.chars) ? value.raw.chars : [];
    const maqaf_char = value.raw.maqaf_char === true || chars.includes(MAQAF);
    const sof_pasuk_char = value.raw.sof_pasuk_char === true || chars.includes(SOF_PASUQ);

    return {
      kind: "gap",
      gapid: value.gapid,
      ref_key: value.ref_key,
      gap_index: value.gap_index,
      raw: {
        chars,
        maqaf_char,
        sof_pasuk_char
      }
    };
  }

  failSpine(sourcePath, lineNumber, `unsupported spine kind ${describe(kind)}`);
}

async function sha256OfFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function buildExpectedOutputFileNames(config: CantillationLayerConfig): string[] {
  const out = ["cantillation.ir.jsonl"];
  if (config.dump_stats) {
    out.push("stats.json");
  }
  return out;
}

async function readCantillationManifestSafe(
  filePath: string
): Promise<CantillationManifest | null> {
  try {
    const parsed = await readJsonFile(filePath);
    assertCantillationManifest(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function isManifestMatch(args: {
  manifest: CantillationManifest;
  spineDigest: string;
  configHash: string;
  codeHash: string;
}): boolean {
  return (
    args.manifest.layer === "cantillation" &&
    args.manifest.layer_version === CANTILLATION_LAYER_VERSION &&
    args.manifest.spine_digest === args.spineDigest &&
    args.manifest.config_hash === args.configHash &&
    args.manifest.code_hash === args.codeHash
  );
}

async function canReuseCache(args: {
  outputDir: string;
  manifestPath: string;
  spineDigest: string;
  configHash: string;
  codeHash: string;
  config: CantillationLayerConfig;
}): Promise<boolean> {
  if (!(await pathExists(args.manifestPath))) {
    return false;
  }

  const manifest = await readCantillationManifestSafe(args.manifestPath);
  if (!manifest) {
    return false;
  }

  if (
    !isManifestMatch({
      manifest,
      spineDigest: args.spineDigest,
      configHash: args.configHash,
      codeHash: args.codeHash
    })
  ) {
    return false;
  }

  const requiredFiles = buildExpectedOutputFileNames(args.config);
  const filesByName = new Map<string, CantillationManifestOutputFile>();
  for (const file of manifest.output_files) {
    filesByName.set(file.path, file);
  }

  for (const relPath of requiredFiles) {
    const manifestEntry = filesByName.get(relPath);
    if (!manifestEntry) {
      return false;
    }
    const absPath = path.join(args.outputDir, relPath);
    if (!(await pathExists(absPath))) {
      return false;
    }
    const actualHash = await sha256OfFile(absPath);
    if (actualHash !== manifestEntry.sha256) {
      return false;
    }
  }

  return true;
}

function initializeStats(config: CantillationLayerConfig): CantillationStats {
  return {
    layer: "cantillation",
    totals: {
      graphemes: 0,
      marks_seen: 0,
      marks_mapped: 0,
      marks_unknown: 0,
      gap_events: 0,
      events_emitted: 0,
      gid_events: 0
    },
    top_marks: [],
    ref_key_coverage: {
      refs_seen: 0,
      refs_with_marks: 0,
      refs_with_gap_events: 0,
      refs: []
    },
    config: {
      strict: config.strict,
      emit_unknown: config.emit_unknown,
      sof_pasuk_rank: config.sof_pasuk_rank,
      dump_stats: config.dump_stats,
      top_marks_limit: config.top_marks_limit
    }
  };
}

function getRefTally(map: Map<string, RefTally>, refKey: string): RefTally {
  const existing = map.get(refKey);
  if (existing) {
    return existing;
  }
  const created: RefTally = {
    graphemes: 0,
    marks_seen: 0,
    marks_mapped: 0,
    marks_unknown: 0,
    gap_events: 0,
    events_emitted: 0
  };
  map.set(refKey, created);
  return created;
}

function recordTopMark(
  tallies: Map<string, MarkTally>,
  args: {
    mark: string;
    codepoint: string;
    mapped: boolean;
    name: string;
    class: TropeClass | "UNKNOWN";
  }
): void {
  const existing = tallies.get(args.codepoint);
  if (existing) {
    existing.count += 1;
    return;
  }

  tallies.set(args.codepoint, {
    mark: args.mark,
    codepoint: args.codepoint,
    count: 1,
    mapped: args.mapped,
    name: args.name,
    class: args.class
  });
}

function finalizeStats(args: {
  stats: CantillationStats;
  coverage: CantillationMarkCoverage;
  markTallies: Map<string, MarkTally>;
  refTallies: Map<string, RefTally>;
  config: CantillationLayerConfig;
}): CantillationStats {
  const refs: CantillationRefCoverage[] = [...args.refTallies.entries()]
    .sort((left, right) => compareRefKeysStable(left[0], right[0]))
    .map(([ref_key, tally]) => ({
      ref_key,
      graphemes: tally.graphemes,
      marks_seen: tally.marks_seen,
      marks_mapped: tally.marks_mapped,
      marks_unknown: tally.marks_unknown,
      gap_events: tally.gap_events,
      events_emitted: tally.events_emitted
    }));

  const refs_with_marks = refs.filter((entry) => entry.marks_seen > 0).length;
  const refs_with_gap_events = refs.filter((entry) => entry.gap_events > 0).length;

  const topMarks = [...args.markTallies.values()]
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return compareText(left.codepoint, right.codepoint);
    })
    .slice(0, args.config.top_marks_limit)
    .map((entry) => ({ ...entry }));

  return {
    ...args.stats,
    totals: {
      ...args.stats.totals,
      marks_seen: args.coverage.marks_seen,
      marks_mapped: args.coverage.marks_mapped,
      marks_unknown: args.coverage.marks_unknown
    },
    top_marks: topMarks,
    ref_key_coverage: {
      refs_seen: refs.length,
      refs_with_marks,
      refs_with_gap_events,
      refs
    }
  };
}

async function writeStatsFile(filePath: string, stats: CantillationStats): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}

function eventSubOrder(events: CantillationEvent[]): CantillationEvent[] {
  return [...events].sort(compareCantillationEvents);
}

function readGapEvents(row: ParsedSpineGapRecord, sofPasukRank: number): CantillationEvent[] {
  const events: CantillationEvent[] = [];

  if (row.raw.maqaf_char) {
    events.push({
      type: "BOUNDARY",
      op: "MAQAF_GLUE",
      rank: 0,
      reason: "MAQAF"
    });
  }

  if (row.raw.sof_pasuk_char) {
    events.push({
      type: "BOUNDARY",
      op: "CUT",
      rank: sofPasukRank,
      reason: "SOF_PASUK"
    });
  }

  return eventSubOrder(events);
}

async function extractToArtifacts(args: {
  spinePath: string;
  config: CantillationLayerConfig;
  outputDir: string;
  cantillationIrPath: string;
  statsPath?: string;
}): Promise<CantillationStats> {
  const stats = initializeStats(args.config);
  const coverage = createCantillationMarkCoverage();
  const refTallies = new Map<string, RefTally>();
  const markTallies = new Map<string, MarkTally>();
  const anchorValidator = args.config.strict ? new CantillationAnchorValidator() : null;

  const stream = fsRaw.createReadStream(args.spinePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const handle = await fs.open(args.cantillationIrPath, "w");

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
        failSpine(args.spinePath, lineNumber, `invalid JSON (${message})`);
      }

      const row = parseSpineRecord(parsed, args.spinePath, lineNumber);
      if (anchorValidator) {
        if (row.kind === "g") {
          anchorValidator.registerSpineAnchor({
            kind: "g",
            gid: row.gid,
            ref_key: row.ref_key
          });
        } else {
          anchorValidator.registerSpineAnchor({
            kind: "gap",
            gapid: row.gapid,
            ref_key: row.ref_key
          });
        }
      }
      const refTally = getRefTally(refTallies, row.ref_key);

      if (row.kind === "g") {
        stats.totals.graphemes += 1;
        refTally.graphemes += 1;

        const orderedMarks = sortMarksDeterministically(row.marks_raw.teamim);
        const gidRecords: CantillationIRRecord[] = [];
        for (const mark of orderedMarks) {
          const resolved = resolveCantillationMarkWithCoverage(mark, coverage);
          refTally.marks_seen += 1;

          if (resolved.kind === "known") {
            refTally.marks_mapped += 1;
            recordTopMark(markTallies, {
              mark,
              codepoint: resolved.info.codepoint,
              mapped: true,
              name: resolved.info.name,
              class: resolved.info.class
            });

            gidRecords.push({
              kind: "cant_event",
              anchor: anchorTropeMarkToGid({ gid: row.gid, ref_key: row.ref_key }),
              ref_key: row.ref_key,
              event: {
                type: "TROPE_MARK",
                mark: resolved.info.name,
                class: resolved.info.class,
                rank: resolved.info.rank
              },
              raw: {
                teamim: [mark]
              }
            });
            continue;
          }

          refTally.marks_unknown += 1;
          recordTopMark(markTallies, {
            mark,
            codepoint: resolved.event.codepoint,
            mapped: false,
            name: "UNKNOWN_MARK",
            class: "UNKNOWN"
          });

          if (args.config.strict) {
            throw new Error(
              `cantillation extract: unknown teamim mark '${mark}' (${resolved.event.codepoint}) at gid='${row.gid}' ref_key='${row.ref_key}'`
            );
          }

          if (args.config.emit_unknown) {
            gidRecords.push({
              kind: "cant_event",
              anchor: anchorTropeMarkToGid({ gid: row.gid, ref_key: row.ref_key }),
              ref_key: row.ref_key,
              event: {
                type: "UNKNOWN_MARK",
                codepoint: resolved.event.codepoint,
                rank: null
              },
              raw: {
                teamim: [mark]
              }
            });
          }
        }

        gidRecords.sort((left, right) => compareCantillationEvents(left.event, right.event));
        for (const record of gidRecords) {
          anchorValidator?.assertEventAnchorExists(record);
          await handle.write(`${serializeCantillationIRRecord(record)}\n`);
          stats.totals.events_emitted += 1;
          stats.totals.gid_events += 1;
          refTally.events_emitted += 1;
        }
        continue;
      }

      const gapEvents = readGapEvents(row, args.config.sof_pasuk_rank);
      for (const event of gapEvents) {
        const source = event.reason === "SOF_PASUK" ? "sof_pasuk_char" : "maqaf_char";
        const record: CantillationIRRecord = {
          kind: "cant_event",
          anchor: anchorPunctuationBoundaryToGap({ gapid: row.gapid, ref_key: row.ref_key }),
          ref_key: row.ref_key,
          event,
          raw: {
            source
          }
        };
        anchorValidator?.assertEventAnchorExists(record);
        await handle.write(`${serializeCantillationIRRecord(record)}\n`);
        stats.totals.events_emitted += 1;
        stats.totals.gap_events += 1;
        refTally.gap_events += 1;
        refTally.events_emitted += 1;
      }
    }
  } finally {
    await handle.close();
    lines.close();
    stream.close();
  }

  const finalized = finalizeStats({
    stats,
    coverage,
    markTallies,
    refTallies,
    config: args.config
  });

  if (args.statsPath) {
    await writeStatsFile(args.statsPath, finalized);
  }

  return finalized;
}

export async function extractCantillationIR(
  spinePath: string,
  outDir: string,
  config: ExtractCantillationIRConfig = {}
): Promise<ExtractCantillationIRResult> {
  if (emitsDerivedBoundariesFromTropeMarks()) {
    throw new Error(
      "cantillation extract: derived boundary emission from trope marks is disabled (wrapper-level policy)"
    );
  }

  const resolvedSpinePath = path.resolve(spinePath);
  const normalizedConfig = normalizeConfig(config);
  const spineDigest = await resolveSpineDigest({
    spinePath: resolvedSpinePath,
    spineManifestPath: config.spineManifestPath,
    override: config.spineDigestOverride
  });

  const configHash = computeCantillationConfigHash(normalizedConfig);
  const codeHash =
    config.codeHashOverride ?? (await computeCantillationCodeHash(DEFAULT_CANTILLATION_CODE_PATHS));
  assertSha256Hex(codeHash, "codeHash");

  const digest =
    config.digestOverride ??
    computeCantillationDigest({
      spine_digest: spineDigest,
      config_hash: configHash,
      code_hash: codeHash
    });
  assertSha256Hex(digest, "digest");

  const cacheDir = path.resolve(outDir.length > 0 ? outDir : defaultCacheDir());
  const outputDir = path.join(cacheDir, digest);
  const cantillationIrPath = path.join(outputDir, "cantillation.ir.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");
  const statsPath = normalizedConfig.dump_stats ? path.join(outputDir, "stats.json") : undefined;

  const hasCache = await canReuseCache({
    outputDir,
    manifestPath,
    spineDigest,
    configHash,
    codeHash,
    config: normalizedConfig
  });

  if (hasCache && config.force !== true) {
    const manifest = await readCantillationManifestSafe(manifestPath);
    if (!manifest) {
      throw new Error(`cantillation extract: invalid cached manifest at ${manifestPath}`);
    }

    const stats =
      statsPath && (await pathExists(statsPath))
        ? ((await readJsonFile(statsPath)) as CantillationStats)
        : initializeStats(normalizedConfig);

    return {
      digest,
      outputDir,
      cantillationIrPath,
      manifestPath,
      ...(statsPath ? { statsPath } : {}),
      manifest,
      stats,
      cacheHit: true,
      forced: false
    };
  }

  await fs.mkdir(outputDir, { recursive: true });

  const stats = await extractToArtifacts({
    spinePath: resolvedSpinePath,
    config: normalizedConfig,
    outputDir,
    cantillationIrPath,
    ...(statsPath ? { statsPath } : {})
  });

  const outputFiles: CantillationManifestOutputFile[] = [
    {
      path: "cantillation.ir.jsonl",
      sha256: await sha256OfFile(cantillationIrPath)
    }
  ];

  if (statsPath) {
    outputFiles.push({
      path: "stats.json",
      sha256: await sha256OfFile(statsPath)
    });
  }

  const manifest = createCantillationManifest({
    layer_version: CANTILLATION_LAYER_VERSION,
    spine_digest: spineDigest,
    config_hash: configHash,
    code_hash: codeHash,
    output_files: outputFiles
  });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    digest,
    outputDir,
    cantillationIrPath,
    manifestPath,
    ...(statsPath ? { statsPath } : {}),
    manifest,
    stats,
    cacheHit: false,
    forced: config.force === true
  };
}
