import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import {
  assertCantillationIRRecords,
  compareCantillationIRRecords,
  formatCantillationIRJsonl,
  parseCantillationIRJsonl,
  type CantillationEvent,
  type CantillationIRRecord
} from "../layers/cantillation/schema";
import {
  assertLayoutIRRecord,
  assertLayoutIRRecords,
  compareLayoutIRRecords,
  compareRefKeysStable,
  formatLayoutIRJsonl,
  parseLayoutIRJsonl,
  type LayoutEvent,
  type LayoutIRRecord
} from "../layers/layout/schema";
import { assertRefKey, type RefKey } from "../ir/refkey";
import {
  assertLettersIRRecords,
  compareLettersIRRecords,
  formatLettersIRJsonl,
  parseLettersIRJsonl,
  type LettersIRRecord
} from "../layers/letters/schema";
import {
  assertNiqqudIRRows,
  compareNiqqudIRRows,
  formatNiqqudIRJsonl,
  parseNiqqudIRJsonl,
  type NiqqudIRRow,
  type NiqqudMods
} from "../layers/niqqud/schema";
import { assertSpineRecord, type SpineRecord } from "../spine/schema";
import {
  assertCantillationIRNoBleed,
  assertLayoutIRNoBleed,
  assertLettersIRNoBleed,
  assertNiqqudIRNoBleed,
  assertProgramIRNoRuntimeState
} from "./stitch/contractChecks";
import { stitchProgramRowsFromFiles } from "./stitch/stitch";

export const PROGRAM_LAYER = "program";
export const PROGRAM_IR_VERSION = 1;
export const PROGRAM_MANIFEST_VERSION = "1.0.0";
export const PROGRAM_SCHEMA_VERSION = "1.0.0";
export const PROGRAM_MODS_SCHEMA_VERSION = "1.0.0";
export const STITCHER_CONTRACT_VERSION = "1.0.0";
export const STITCHER_VERSION = "1.0.0";

export type ProgramIROutputFormat = "jsonl" | "json";

export type MetadataPlan = Record<string, unknown> & {
  checkpoints?: Array<{
    ref_end?: RefKey;
    ref_key_end?: RefKey;
    [key: string]: unknown;
  }>;
};

export type ProgramIROpRecord = {
  seq: number;
  kind: "op";
  gid: string;
  ref_key: string;
  g_index: number;
  op_kind: string;
  mods: ProgramMods;
  word_id?: string;
  pos_in_word?: number;
  cant_attached?: CantillationEvent[];
};

export type ProgramIRBoundaryRecord = {
  seq: number;
  kind: "boundary";
  gapid: string;
  ref_key: string;
  gap_index: number;
  left_gid: string | null;
  right_gid: string | null;
  layout: LayoutEvent[];
  cant: CantillationEvent[];
  raw: {
    whitespace?: boolean;
    chars?: string[];
    [key: string]: unknown;
  };
};

export type ProgramIRRecord = ProgramIROpRecord | ProgramIRBoundaryRecord;

export type ProgramModsFeatures = {
  hasDagesh: boolean;
  hasShva: boolean;
  vowelCount: number;
};

export type ProgramMods = {
  schemaVersion: typeof PROGRAM_MODS_SCHEMA_VERSION;
  classes: string[];
  features: ProgramModsFeatures;
};

export type ProgramInputDigests = {
  spine_sha256: string;
  letters_ir_sha256: string;
  niqqud_ir_sha256: string;
  cantillation_ir_sha256: string;
  layout_ir_sha256: string;
  metadata_plan_sha256: string;
};

export type ProgramManifestBuild = {
  gitSha: string | null;
  nodeVersion: string;
  platform: string;
  generatedAt: string;
};

export type ProgramManifestContains = {
  layout: boolean;
  cantillation: boolean;
  letterCantillation: boolean;
  gapRaw: boolean;
  metadataCheckpoints: boolean;
};

export type ProgramManifestIntegrity = {
  anchors: {
    firstRefKey: string | null;
    lastRefKey: string | null;
    firstGid: string | null;
    lastGid: string | null;
    firstGapid: string | null;
    lastGapid: string | null;
  };
  countsByRef: {
    refCount: number;
    meanOpsPerRef: number;
    maxOpsPerRef: number;
    maxBoundariesPerRef: number;
  };
  rollingHash: {
    chunkSize: number;
    chunkDigests: string[];
  };
};

export type ProgramCacheDigestArgs = {
  stitcherVersion: string;
  programSchemaVersion: string;
  stitchConfigDigest: string;
  inputDigests: ProgramInputDigests;
  programDigest: string;
};

export type ProgramManifest = {
  layer: typeof PROGRAM_LAYER;
  version: typeof PROGRAM_MANIFEST_VERSION;
  programSchemaVersion: typeof PROGRAM_SCHEMA_VERSION;
  contract: `STITCHER_CONTRACT/${typeof STITCHER_CONTRACT_VERSION}`;
  build: ProgramManifestBuild;
  stitcher: {
    version: typeof STITCHER_VERSION;
    config: {
      output_format: ProgramIROutputFormat;
      include_letter_cantillation: boolean;
      include_gap_raw: boolean;
    };
  };
  stitchConfigDigest: string;
  created_at: string;
  input_digests: ProgramInputDigests;
  input_row_counts: {
    spine: number;
    letters_ir: number;
    niqqud_ir: number;
    cantillation_ir: number;
    layout_ir: number;
  };
  counts: {
    program_rows: number;
    ops: number;
    boundaries: number;
    checkpoints: number;
  };
  ref_ranges_by_book?: Record<
    string,
    {
      first_ref: string;
      last_ref: string;
      ops: number;
      boundaries: number;
    }
  >;
  contains: ProgramManifestContains;
  integrity: ProgramManifestIntegrity;
  cacheDigest: string;
  output: {
    format: ProgramIROutputFormat;
    sha256: string;
  };
};

export type StitchProgramIRInputs = {
  spineRecords: readonly SpineRecord[];
  lettersRecords: readonly LettersIRRecord[];
  niqqudRows: readonly NiqqudIRRow[];
  cantillationRecords: readonly CantillationIRRecord[];
  layoutRecords: readonly LayoutIRRecord[];
  metadataPlan: MetadataPlan;
};

export type StitchProgramIRArgs = StitchProgramIRInputs & {
  outputFormat?: ProgramIROutputFormat;
  createdAt?: Date | string;
};

export type StitchProgramIRResult = {
  rows: ProgramIRRecord[];
  programIrJsonl: string;
  programIrJson: string;
  programIrText: string;
  manifest: ProgramManifest;
  manifestText: string;
};

export type StitchProgramIRPaths = {
  spinePath: string;
  lettersIrPath: string;
  niqqudIrPath: string;
  cantillationIrPath: string;
  layoutIrPath: string;
  metadataPlanPath: string;
};

export type StitchProgramIRFromFilesArgs = StitchProgramIRPaths & {
  outputFormat?: ProgramIROutputFormat;
  createdAt?: Date | string;
};

type UnknownRecord = Record<string, unknown>;

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

type ProgramAnchorKey = {
  ref_key: string;
  index: number;
  kind_rank: number;
  id: string;
};

const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;
const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SHORT_GIT_SHA_HEX = /^[a-f0-9]{7,40}$/;
const PROGRAM_ROLLING_HASH_CHUNK_SIZE = 50_000;
const PROGRAM_MODS_FEATURE_KEYS = ["hasDagesh", "hasShva", "vowelCount"] as const;

const OWN = Object.prototype.hasOwnProperty;

const LAYOUT_EVENT_TYPE_ORDER: Readonly<Record<LayoutEvent["type"], number>> = {
  SPACE: 0,
  SETUMA: 1,
  PETUCHA: 2,
  BOOK_BREAK: 3
};

const CANT_EVENT_TYPE_ORDER: Readonly<Record<CantillationEvent["type"], number>> = {
  TROPE_MARK: 0,
  UNKNOWN_MARK: 1,
  BOUNDARY: 2
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

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

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function fail(scope: string, path: string, message: string): never {
  throw new Error(`Invalid ${scope} at ${path}: ${message}`);
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

function assertRecord(value: unknown, path: string, scope: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(scope, path, `expected object, got ${describe(value)}`);
  }
}

function assertNoUnknownKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string,
  scope: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(scope, path, `unknown field '${key}'`);
    }
  }
}

function assertHas(record: UnknownRecord, key: string, path: string, scope: string): unknown {
  if (!hasOwn(record, key)) {
    fail(scope, `${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertNonEmptyString(
  value: unknown,
  path: string,
  scope: string
): asserts value is string {
  if (!isNonEmptyString(value)) {
    fail(scope, path, `expected non-empty string, got ${describe(value)}`);
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string,
  scope: string
): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    fail(scope, path, `expected non-negative integer, got ${describe(value)}`);
  }
}

function parseGid(value: string): { ref_key: string; g_index: number } | null {
  const match = value.match(GID_PATTERN);
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

function parseGapid(value: string): { ref_key: string; gap_index: number } | null {
  const match = value.match(GAPID_PATTERN);
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

function normalizeProgramMods(rawMods: NiqqudMods | undefined): ProgramMods {
  const classesSource =
    rawMods && Array.isArray(rawMods.classes) ? rawMods.classes.filter((entry) => typeof entry === "string") : [];
  const classes = [...new Set(classesSource)].sort(compareText);

  const featuresSource = rawMods && isRecord(rawMods.features) ? rawMods.features : {};
  for (const key of Object.keys(featuresSource)) {
    if (!PROGRAM_MODS_FEATURE_KEYS.includes(key as (typeof PROGRAM_MODS_FEATURE_KEYS)[number])) {
      throw new Error(
        `stitcher: ProgramIR mods.features key '${key}' is unsupported; bump PROGRAM_MODS_SCHEMA_VERSION to add new keys`
      );
    }
  }

  const hasDagesh =
    typeof featuresSource.hasDagesh === "boolean" ? featuresSource.hasDagesh : false;
  const hasShva = typeof featuresSource.hasShva === "boolean" ? featuresSource.hasShva : false;
  const vowelCount =
    typeof featuresSource.vowelCount === "number" &&
    Number.isInteger(featuresSource.vowelCount) &&
    featuresSource.vowelCount >= 0
      ? featuresSource.vowelCount
      : 0;

  return {
    schemaVersion: PROGRAM_MODS_SCHEMA_VERSION,
    classes,
    features: {
      hasDagesh,
      hasShva,
      vowelCount
    }
  };
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function detectGitSha(): string | null {
  const envCandidates = [
    process.env.GITHUB_SHA,
    process.env.GIT_SHA,
    process.env.BUILD_GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA
  ];
  for (const candidate of envCandidates) {
    const normalized = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
    if (SHORT_GIT_SHA_HEX.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

function resolveProgramManifestBuild(generatedAt: string): ProgramManifestBuild {
  return {
    gitSha: detectGitSha(),
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    generatedAt
  };
}

export function computeProgramCacheDigest(args: ProgramCacheDigestArgs): string {
  const payload = {
    kind: "ProgramIRCache",
    stitcherVersion: args.stitcherVersion,
    programSchemaVersion: args.programSchemaVersion,
    stitchConfigDigest: args.stitchConfigDigest,
    inputDigests: args.inputDigests,
    programDigest: args.programDigest
  };
  return sha256Hex(canonicalStringify(payload));
}

function normalizeCreatedAt(value: Date | string | undefined): string {
  if (value === undefined) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    if (Number.isNaN(Date.parse(iso))) {
      throw new Error("stitcher: createdAt must be valid Date");
    }
    return iso;
  }
  if (typeof value === "string") {
    if (Number.isNaN(Date.parse(value))) {
      throw new Error("stitcher: createdAt must be valid ISO date-time");
    }
    return new Date(value).toISOString();
  }
  throw new Error("stitcher: createdAt must be Date | string");
}

function compareSpineRecords(left: SpineRecord, right: SpineRecord): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }

  const leftIndex = left.kind === "gap" ? left.gap_index : left.g_index;
  const rightIndex = right.kind === "gap" ? right.gap_index : right.g_index;
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  if (left.kind !== right.kind) {
    return left.kind === "gap" ? -1 : 1;
  }

  if (left.kind === "gap" && right.kind === "gap") {
    return compareText(left.gapid, right.gapid);
  }
  if (left.kind === "g" && right.kind === "g") {
    return compareText(left.gid, right.gid);
  }
  return 0;
}

function assertSpineRecords(
  records: readonly SpineRecord[],
  path = "$",
  scope = "SpineRecords"
): void {
  const seenGids = new Set<string>();
  const seenGapids = new Set<string>();
  let previous: SpineRecord | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    assertSpineRecord(row);

    if (row.kind === "g") {
      if (seenGids.has(row.gid)) {
        fail(scope, `${path}[${i}].gid`, `duplicate gid '${row.gid}'`);
      }
      seenGids.add(row.gid);
    } else {
      if (seenGapids.has(row.gapid)) {
        fail(scope, `${path}[${i}].gapid`, `duplicate gapid '${row.gapid}'`);
      }
      seenGapids.add(row.gapid);
    }

    if (previous && compareSpineRecords(previous, row) >= 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be in strict deterministic order by (ref_key, index, kind)"
      );
    }
    previous = row;
  }
}

export function parseSpineJsonl(text: string): SpineRecord[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid SpineJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: SpineRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid SpineJsonl at line ${String(i + 1)}: ${message}`);
    }
    assertSpineRecord(parsed);
    out.push(parsed);
  }

  assertSpineRecords(out);
  return out;
}

function serializeSpineRecord(record: SpineRecord): string {
  assertSpineRecord(record);
  return canonicalStringify(record);
}

export function formatSpineJsonl(records: readonly SpineRecord[]): string {
  const normalized = [...records].sort(compareSpineRecords);
  assertSpineRecords(normalized);
  if (normalized.length === 0) {
    return "";
  }
  return `${normalized.map((record) => serializeSpineRecord(record)).join("\n")}\n`;
}

export function assertMetadataPlan(
  value: unknown,
  path = "$",
  scope = "MetadataPlan"
): asserts value is MetadataPlan {
  assertRecord(value, path, scope);

  if (hasOwn(value, "version")) {
    const version = value.version;
    if (
      version !== undefined &&
      (typeof version !== "number" ||
        !Number.isInteger(version) ||
        !Number.isSafeInteger(version) ||
        version < 1)
    ) {
      fail(scope, `${path}.version`, `expected integer >= 1, got ${describe(version)}`);
    }
  }

  if (hasOwn(value, "notes") && value.notes !== undefined && typeof value.notes !== "string") {
    fail(scope, `${path}.notes`, `expected string, got ${describe(value.notes)}`);
  }

  if (hasOwn(value, "labels")) {
    const labels = value.labels;
    if (labels !== undefined) {
      if (!Array.isArray(labels)) {
        fail(scope, `${path}.labels`, `expected string[], got ${describe(labels)}`);
      }
      for (let i = 0; i < labels.length; i += 1) {
        if (typeof labels[i] !== "string") {
          fail(scope, `${path}.labels[${i}]`, `expected string, got ${describe(labels[i])}`);
        }
      }
    }
  }

  if (hasOwn(value, "options")) {
    const options = value.options;
    if (options !== undefined) {
      assertRecord(options, `${path}.options`, scope);
      for (const key of Object.keys(options)) {
        const optionValue = options[key];
        const validScalar =
          optionValue === null ||
          typeof optionValue === "string" ||
          typeof optionValue === "number" ||
          typeof optionValue === "boolean";
        if (!validScalar) {
          fail(
            scope,
            `${path}.options.${key}`,
            `expected string|number|boolean|null, got ${describe(optionValue)}`
          );
        }
      }
    }
  }

  if (hasOwn(value, "checkpoints")) {
    const checkpoints = value.checkpoints;
    if (checkpoints !== undefined) {
      if (!Array.isArray(checkpoints)) {
        fail(scope, `${path}.checkpoints`, `expected array, got ${describe(checkpoints)}`);
      }
      for (let i = 0; i < checkpoints.length; i += 1) {
        const checkpointPath = `${path}.checkpoints[${i}]`;
        const checkpoint = checkpoints[i];
        assertRecord(checkpoint, checkpointPath, scope);
        const refEnd =
          typeof checkpoint.ref_end === "string"
            ? checkpoint.ref_end
            : typeof checkpoint.ref_key_end === "string"
              ? checkpoint.ref_key_end
              : null;
        if (!refEnd) {
          fail(
            scope,
            checkpointPath,
            "expected checkpoint.ref_end or checkpoint.ref_key_end as canonical RefKey"
          );
        }
        try {
          assertRefKey(refEnd, checkpointPath.concat(".ref_end"));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          fail(scope, `${checkpointPath}.ref_end`, message);
        }
        if (hasOwn(checkpoint, "label") && checkpoint.label !== undefined) {
          if (typeof checkpoint.label !== "string") {
            fail(
              scope,
              `${checkpointPath}.label`,
              `expected string, got ${describe(checkpoint.label)}`
            );
          }
        }
      }
    }
  }
}

export function parseMetadataPlanJson(text: string): MetadataPlan {
  if (typeof text !== "string") {
    throw new Error(`Invalid MetadataPlanJson: expected string, got ${typeof text}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid MetadataPlanJson: ${message}`);
  }
  assertMetadataPlan(parsed);
  return parsed;
}

function collectKnownSpineAnchors(spineRecords: readonly SpineRecord[]): {
  gids: Set<string>;
  gapids: Set<string>;
} {
  const gids = new Set<string>();
  const gapids = new Set<string>();
  for (const row of spineRecords) {
    if (row.kind === "g") {
      gids.add(row.gid);
      continue;
    }
    gapids.add(row.gapid);
  }
  return { gids, gapids };
}

function assertLayerAnchorsAgainstSpine(args: {
  spineRecords: readonly SpineRecord[];
  lettersRecords: readonly LettersIRRecord[];
  niqqudRows: readonly NiqqudIRRow[];
  cantillationRecords: readonly CantillationIRRecord[];
  layoutRecords: readonly LayoutIRRecord[];
}): void {
  const known = collectKnownSpineAnchors(args.spineRecords);

  for (let i = 0; i < args.lettersRecords.length; i += 1) {
    const row = args.lettersRecords[i];
    if (!known.gids.has(row.gid)) {
      throw new Error(`stitcher: LettersIR[${String(i)}] gid '${row.gid}' missing from Spine`);
    }
  }

  for (let i = 0; i < args.niqqudRows.length; i += 1) {
    const row = args.niqqudRows[i];
    if (!known.gids.has(row.gid)) {
      throw new Error(`stitcher: NiqqudIR[${String(i)}] gid '${row.gid}' missing from Spine`);
    }
  }

  for (let i = 0; i < args.layoutRecords.length; i += 1) {
    const row = args.layoutRecords[i];
    if (!known.gapids.has(row.gapid)) {
      throw new Error(`stitcher: LayoutIR[${String(i)}] gapid '${row.gapid}' missing from Spine`);
    }
  }

  for (let i = 0; i < args.cantillationRecords.length; i += 1) {
    const row = args.cantillationRecords[i];
    const anchorExists =
      row.anchor.kind === "gid" ? known.gids.has(row.anchor.id) : known.gapids.has(row.anchor.id);
    if (!anchorExists) {
      const label = row.anchor.kind === "gid" ? "gid" : "gapid";
      throw new Error(
        `stitcher: CantillationIR[${String(i)}] ${label} '${row.anchor.id}' missing from Spine`
      );
    }
  }
}

function normalizeInputs(args: StitchProgramIRInputs): StitchProgramIRInputs {
  const spineRecords = [...args.spineRecords].sort(compareSpineRecords);
  const lettersRecords = [...args.lettersRecords].sort(compareLettersIRRecords);
  const niqqudRows = [...args.niqqudRows].sort(compareNiqqudIRRows);
  const cantillationRecords = [...args.cantillationRecords].sort(compareCantillationIRRecords);
  const layoutRecords = [...args.layoutRecords].sort(compareLayoutIRRecords);

  assertSpineRecords(spineRecords);
  assertLettersIRRecords(lettersRecords);
  assertNiqqudIRRows(niqqudRows);
  assertCantillationIRRecords(cantillationRecords);
  assertLayoutIRRecords(layoutRecords);
  assertMetadataPlan(args.metadataPlan);

  assertLayerAnchorsAgainstSpine({
    spineRecords,
    lettersRecords,
    niqqudRows,
    cantillationRecords,
    layoutRecords
  });

  for (let i = 0; i < lettersRecords.length; i += 1) {
    assertLettersIRNoBleed(lettersRecords[i], `LettersIR[${String(i)}]`);
  }
  for (let i = 0; i < niqqudRows.length; i += 1) {
    assertNiqqudIRNoBleed(niqqudRows[i], `NiqqudIR[${String(i)}]`);
  }
  for (let i = 0; i < cantillationRecords.length; i += 1) {
    assertCantillationIRNoBleed(cantillationRecords[i], `CantillationIR[${String(i)}]`);
  }
  for (let i = 0; i < layoutRecords.length; i += 1) {
    assertLayoutIRNoBleed(layoutRecords[i], `LayoutIR[${String(i)}]`);
  }

  return {
    spineRecords,
    lettersRecords,
    niqqudRows,
    cantillationRecords,
    layoutRecords,
    metadataPlan: deepClone(args.metadataPlan)
  };
}

function indexNiqqud(rows: readonly NiqqudIRRow[]): Map<string, NiqqudMods> {
  const out = new Map<string, NiqqudMods>();
  for (const row of rows) {
    if (out.has(row.gid)) {
      throw new Error(`stitcher: duplicate NiqqudIR gid '${row.gid}'`);
    }
    out.set(row.gid, deepClone(row.mods));
  }
  return out;
}

function indexCantillation(records: readonly CantillationIRRecord[]): {
  byGid: Map<string, CantillationEvent[]>;
  byGapid: Map<string, CantillationEvent[]>;
} {
  const byGid = new Map<string, CantillationEvent[]>();
  const byGapid = new Map<string, CantillationEvent[]>();

  for (const row of records) {
    const bucket = row.anchor.kind === "gid" ? byGid : byGapid;
    const existing = bucket.get(row.anchor.id) ?? [];
    existing.push(deepClone(row.event));
    bucket.set(row.anchor.id, existing);
  }

  for (const [key, events] of byGid.entries()) {
    byGid.set(key, [...events].sort(compareCantillationEventsForJoin));
  }
  for (const [key, events] of byGapid.entries()) {
    byGapid.set(key, [...events].sort(compareCantillationEventsForJoin));
  }

  return { byGid, byGapid };
}

function rankValue(value: unknown): number | null | undefined {
  if (!isRecord(value) || !hasOwn(value, "rank")) {
    return undefined;
  }
  const rank = value.rank;
  if (rank === null) {
    return null;
  }
  if (typeof rank === "number" && Number.isFinite(rank)) {
    return rank;
  }
  return undefined;
}

function compareOptionalRank(
  left: number | null | undefined,
  right: number | null | undefined
): number {
  if (left === right) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  return left - right;
}

function compareCantillationEventsForJoin(
  left: CantillationEvent,
  right: CantillationEvent
): number {
  const leftTypeRank = CANT_EVENT_TYPE_ORDER[left.type];
  const rightTypeRank = CANT_EVENT_TYPE_ORDER[right.type];
  if (leftTypeRank !== rightTypeRank) {
    return leftTypeRank - rightTypeRank;
  }

  const rankCmp = compareOptionalRank(rankValue(left), rankValue(right));
  if (rankCmp !== 0) {
    return rankCmp;
  }
  return compareText(canonicalStringify(left), canonicalStringify(right));
}

function compareLayoutEvents(left: LayoutEvent, right: LayoutEvent): number {
  const leftRank = LAYOUT_EVENT_TYPE_ORDER[left.type];
  const rightRank = LAYOUT_EVENT_TYPE_ORDER[right.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const rankCmp = compareOptionalRank(rankValue(left), rankValue(right));
  if (rankCmp !== 0) {
    return rankCmp;
  }
  return compareText(canonicalStringify(left), canonicalStringify(right));
}

function indexLayout(records: readonly LayoutIRRecord[]): Map<string, LayoutEvent[]> {
  const out = new Map<string, LayoutEvent[]>();
  for (const row of records) {
    const existing = out.get(row.gapid) ?? [];
    existing.push(deepClone(row.layout_event));
    out.set(row.gapid, existing);
  }
  for (const [gapid, events] of out.entries()) {
    out.set(gapid, [...events].sort(compareLayoutEvents));
  }
  return out;
}

function makeProgramAnchorKey(record: ProgramIRRecord): ProgramAnchorKey {
  if (record.kind === "boundary") {
    return {
      ref_key: record.ref_key,
      index: record.gap_index,
      kind_rank: 0,
      id: record.gapid
    };
  }
  return {
    ref_key: record.ref_key,
    index: record.g_index,
    kind_rank: 1,
    id: record.gid
  };
}

export function compareProgramIRRecords(left: ProgramIRRecord, right: ProgramIRRecord): number {
  const leftKey = makeProgramAnchorKey(left);
  const rightKey = makeProgramAnchorKey(right);
  const refCmp = compareRefKeysStable(leftKey.ref_key, rightKey.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (leftKey.index !== rightKey.index) {
    return leftKey.index - rightKey.index;
  }
  if (leftKey.kind_rank !== rightKey.kind_rank) {
    return leftKey.kind_rank - rightKey.kind_rank;
  }
  return compareText(leftKey.id, rightKey.id);
}

function assertProgramMods(value: unknown, path: string, scope: string): void {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["schemaVersion", "classes", "features"], path, scope);

  const schemaVersion = assertHas(value, "schemaVersion", path, scope);
  if (schemaVersion !== PROGRAM_MODS_SCHEMA_VERSION) {
    fail(
      scope,
      `${path}.schemaVersion`,
      `expected '${PROGRAM_MODS_SCHEMA_VERSION}', got ${describe(schemaVersion)}`
    );
  }

  const classes = assertHas(value, "classes", path, scope);
  if (!Array.isArray(classes)) {
    fail(scope, `${path}.classes`, "expected string[]");
  }
  let previousClass: string | null = null;
  for (let i = 0; i < classes.length; i += 1) {
    const className = classes[i];
    if (typeof className !== "string") {
      fail(scope, `${path}.classes[${i}]`, "expected string");
    }
    if (previousClass !== null && compareText(previousClass, className) >= 0) {
      fail(scope, `${path}.classes[${i}]`, "expected strictly sorted unique class names");
    }
    previousClass = className;
  }

  const features = assertHas(value, "features", path, scope);
  assertRecord(features, `${path}.features`, scope);
  assertNoUnknownKeys(
    features,
    [...PROGRAM_MODS_FEATURE_KEYS],
    `${path}.features`,
    scope
  );
  if (typeof assertHas(features, "hasDagesh", `${path}.features`, scope) !== "boolean") {
    fail(scope, `${path}.features.hasDagesh`, "expected boolean");
  }
  if (typeof assertHas(features, "hasShva", `${path}.features`, scope) !== "boolean") {
    fail(scope, `${path}.features.hasShva`, "expected boolean");
  }
  const vowelCount = assertHas(features, "vowelCount", `${path}.features`, scope);
  assertNonNegativeInteger(vowelCount, `${path}.features.vowelCount`, scope);
}

function assertCantillationEvent(value: unknown, path: string, scope: string): void {
  const rowLike: CantillationIRRecord = {
    kind: "cant_event",
    anchor: {
      kind: "gid",
      id: "dummy/0/0#g:0"
    },
    ref_key: "dummy/0/0",
    event: value as CantillationEvent,
    raw: { teamim: [] }
  };
  try {
    assertCantillationIRRecords([rowLike], path, scope);
  } catch {
    const gapRowLike: CantillationIRRecord = {
      kind: "cant_event",
      anchor: {
        kind: "gap",
        id: "dummy/0/0#gap:0"
      },
      ref_key: "dummy/0/0",
      event: value as CantillationEvent,
      raw: { source: "program_schema" }
    };
    assertCantillationIRRecords([gapRowLike], path, scope);
  }
}

export function assertProgramIRRecord(
  value: unknown,
  path = "$",
  scope = "ProgramIRRecord"
): asserts value is ProgramIRRecord {
  assertRecord(value, path, scope);
  const kind = assertHas(value, "kind", path, scope);

  if (kind === "op") {
    assertNoUnknownKeys(
      value,
      [
        "seq",
        "kind",
        "gid",
        "ref_key",
        "g_index",
        "op_kind",
        "mods",
        "word_id",
        "pos_in_word",
        "cant_attached"
      ],
      path,
      scope
    );

    const seq = assertHas(value, "seq", path, scope);
    assertNonNegativeInteger(seq, `${path}.seq`, scope);

    const gid = assertHas(value, "gid", path, scope);
    assertNonEmptyString(gid, `${path}.gid`, scope);

    const ref_key = assertHas(value, "ref_key", path, scope);
    assertNonEmptyString(ref_key, `${path}.ref_key`, scope);

    const g_index = assertHas(value, "g_index", path, scope);
    assertNonNegativeInteger(g_index, `${path}.g_index`, scope);

    const parsedGid = parseGid(gid);
    if (!parsedGid) {
      fail(scope, `${path}.gid`, `expected '<ref_key>#g:<g_index>', got ${describe(gid)}`);
    }
    if (parsedGid.ref_key !== ref_key || parsedGid.g_index !== g_index) {
      fail(
        scope,
        `${path}.gid`,
        `gid '${gid}' must match ref_key='${ref_key}' and g_index=${String(g_index)}`
      );
    }

    assertNonEmptyString(assertHas(value, "op_kind", path, scope), `${path}.op_kind`, scope);
    assertProgramMods(assertHas(value, "mods", path, scope), `${path}.mods`, scope);

    const wordId = hasOwn(value, "word_id") ? value.word_id : undefined;
    const posInWord = hasOwn(value, "pos_in_word") ? value.pos_in_word : undefined;
    if ((wordId === undefined) !== (posInWord === undefined)) {
      fail(
        scope,
        path,
        "word_id and pos_in_word must either both be present or both be omitted"
      );
    }
    if (wordId !== undefined) {
      assertNonEmptyString(wordId, `${path}.word_id`, scope);
      assertNonNegativeInteger(posInWord, `${path}.pos_in_word`, scope);
    }

    const cantAttached = hasOwn(value, "cant_attached") ? value.cant_attached : [];
    if (cantAttached !== undefined) {
      if (!Array.isArray(cantAttached)) {
        fail(scope, `${path}.cant_attached`, `expected array, got ${describe(cantAttached)}`);
      }
      for (let i = 0; i < cantAttached.length; i += 1) {
        assertCantillationEvent(cantAttached[i], `${path}.cant_attached[${i}]`, scope);
      }
    }

    return;
  }

  if (kind === "boundary") {
    assertNoUnknownKeys(
      value,
      ["seq", "kind", "gapid", "ref_key", "gap_index", "left_gid", "right_gid", "layout", "cant", "raw"],
      path,
      scope
    );

    const seq = assertHas(value, "seq", path, scope);
    assertNonNegativeInteger(seq, `${path}.seq`, scope);

    const gapid = assertHas(value, "gapid", path, scope);
    assertNonEmptyString(gapid, `${path}.gapid`, scope);

    const ref_key = assertHas(value, "ref_key", path, scope);
    assertNonEmptyString(ref_key, `${path}.ref_key`, scope);

    const gap_index = assertHas(value, "gap_index", path, scope);
    assertNonNegativeInteger(gap_index, `${path}.gap_index`, scope);

    const parsedGapid = parseGapid(gapid);
    if (!parsedGapid) {
      fail(scope, `${path}.gapid`, `expected '<ref_key>#gap:<gap_index>', got ${describe(gapid)}`);
    }
    if (parsedGapid.ref_key !== ref_key || parsedGapid.gap_index !== gap_index) {
      fail(
        scope,
        `${path}.gapid`,
        `gapid '${gapid}' must match ref_key='${ref_key}' and gap_index=${String(gap_index)}`
      );
    }

    const leftGid = assertHas(value, "left_gid", path, scope);
    if (leftGid !== null) {
      assertNonEmptyString(leftGid, `${path}.left_gid`, scope);
      const parsedLeft = parseGid(leftGid);
      if (!parsedLeft) {
        fail(scope, `${path}.left_gid`, `expected '<ref_key>#g:<g_index>' or null`);
      }
    }
    const rightGid = assertHas(value, "right_gid", path, scope);
    if (rightGid !== null) {
      assertNonEmptyString(rightGid, `${path}.right_gid`, scope);
      const parsedRight = parseGid(rightGid);
      if (!parsedRight) {
        fail(scope, `${path}.right_gid`, `expected '<ref_key>#g:<g_index>' or null`);
      }
    }

    const layout = assertHas(value, "layout", path, scope);
    if (!Array.isArray(layout)) {
      fail(scope, `${path}.layout`, `expected array, got ${describe(layout)}`);
    }
    for (let i = 0; i < layout.length; i += 1) {
      const layoutRecordLike: LayoutIRRecord = {
        gapid,
        ref_key,
        gap_index,
        layout_event: layout[i] as LayoutEvent
      };
      assertLayoutIRRecord(layoutRecordLike, `${path}.layout[${i}]`, scope);
    }

    const cant = assertHas(value, "cant", path, scope);
    if (!Array.isArray(cant)) {
      fail(scope, `${path}.cant`, `expected array, got ${describe(cant)}`);
    }
    for (let i = 0; i < cant.length; i += 1) {
      assertCantillationEvent(cant[i], `${path}.cant[${i}]`, scope);
    }

    const raw = assertHas(value, "raw", path, scope);
    assertRecord(raw, `${path}.raw`, scope);
    return;
  }

  fail(scope, `${path}.kind`, `expected 'op' | 'boundary', got ${describe(kind)}`);
}

export function assertProgramIRRecords(
  records: readonly ProgramIRRecord[],
  path = "$",
  scope = "ProgramIRRecords"
): void {
  const seen = new Set<string>();
  let previous: ProgramIRRecord | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    assertProgramIRRecord(row, `${path}[${i}]`, scope);
    if (row.seq !== i) {
      fail(scope, `${path}[${i}].seq`, `expected seq=${String(i)}, got ${String(row.seq)}`);
    }

    const key = row.kind === "op" ? `${row.kind}\u0000${row.gid}` : `${row.kind}\u0000${row.gapid}`;
    if (seen.has(key)) {
      fail(scope, `${path}[${i}]`, `duplicate program anchor '${key}'`);
    }
    seen.add(key);

    if (previous && compareProgramIRRecords(previous, row) >= 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be in strict deterministic order by (ref_key, index, kind)"
      );
    }
    previous = row;
  }
}

export function serializeProgramIRRecord(record: ProgramIRRecord): string {
  assertProgramIRRecord(record);
  return canonicalStringify(record);
}

export function parseProgramIRJsonl(text: string): ProgramIRRecord[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid ProgramIRJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: ProgramIRRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid ProgramIRJsonl at line ${String(i + 1)}: ${message}`);
    }
    assertProgramIRRecord(parsed, `$[${i}]`);
    out.push(parsed);
  }

  assertProgramIRRecords(out);
  return out;
}

export function formatProgramIRJsonl(records: readonly ProgramIRRecord[]): string {
  const normalized = [...records].sort(compareProgramIRRecords);
  assertProgramIRRecords(normalized);
  if (normalized.length === 0) {
    return "";
  }
  return `${normalized.map((row) => serializeProgramIRRecord(row)).join("\n")}\n`;
}

export function formatProgramIRJson(records: readonly ProgramIRRecord[]): string {
  const normalized = [...records].sort(compareProgramIRRecords);
  assertProgramIRRecords(normalized);
  return `${canonicalStringify(normalized)}\n`;
}

export function assertProgramManifest(
  value: unknown,
  path = "$",
  scope = "ProgramManifest"
): asserts value is ProgramManifest {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(
    value,
    [
      "layer",
      "version",
      "programSchemaVersion",
      "contract",
      "build",
      "stitcher",
      "stitchConfigDigest",
      "created_at",
      "input_digests",
      "input_row_counts",
      "counts",
      "ref_ranges_by_book",
      "contains",
      "integrity",
      "cacheDigest",
      "output"
    ],
    path,
    scope
  );

  const layer = assertHas(value, "layer", path, scope);
  if (layer !== PROGRAM_LAYER) {
    fail(scope, `${path}.layer`, `expected '${PROGRAM_LAYER}', got ${describe(layer)}`);
  }

  const version = assertHas(value, "version", path, scope);
  if (version !== PROGRAM_MANIFEST_VERSION) {
    fail(
      scope,
      `${path}.version`,
      `expected '${PROGRAM_MANIFEST_VERSION}', got ${describe(version)}`
    );
  }

  const programSchemaVersion = assertHas(value, "programSchemaVersion", path, scope);
  if (programSchemaVersion !== PROGRAM_SCHEMA_VERSION) {
    fail(
      scope,
      `${path}.programSchemaVersion`,
      `expected '${PROGRAM_SCHEMA_VERSION}', got ${describe(programSchemaVersion)}`
    );
  }

  const contract = assertHas(value, "contract", path, scope);
  const expectedContract = `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`;
  if (contract !== expectedContract) {
    fail(scope, `${path}.contract`, `expected '${expectedContract}', got ${describe(contract)}`);
  }

  const build = assertHas(value, "build", path, scope);
  assertRecord(build, `${path}.build`, scope);
  assertNoUnknownKeys(build, ["gitSha", "nodeVersion", "platform", "generatedAt"], `${path}.build`, scope);
  if (build.gitSha !== null && build.gitSha !== undefined) {
    assertNonEmptyString(build.gitSha, `${path}.build.gitSha`, scope);
    if (!SHORT_GIT_SHA_HEX.test(build.gitSha.toLowerCase())) {
      fail(scope, `${path}.build.gitSha`, "expected lowercase/uppercase hex git sha");
    }
  }
  assertNonEmptyString(build.nodeVersion, `${path}.build.nodeVersion`, scope);
  assertNonEmptyString(build.platform, `${path}.build.platform`, scope);
  assertNonEmptyString(build.generatedAt, `${path}.build.generatedAt`, scope);
  if (Number.isNaN(Date.parse(String(build.generatedAt)))) {
    fail(scope, `${path}.build.generatedAt`, "expected valid ISO date-time");
  }

  const stitcher = assertHas(value, "stitcher", path, scope);
  assertRecord(stitcher, `${path}.stitcher`, scope);
  assertNoUnknownKeys(stitcher, ["version", "config"], `${path}.stitcher`, scope);
  const stitcherVersion = assertHas(stitcher, "version", `${path}.stitcher`, scope);
  if (stitcherVersion !== STITCHER_VERSION) {
    fail(
      scope,
      `${path}.stitcher.version`,
      `expected '${STITCHER_VERSION}', got ${describe(stitcherVersion)}`
    );
  }
  const stitcherConfig = assertHas(stitcher, "config", `${path}.stitcher`, scope);
  assertRecord(stitcherConfig, `${path}.stitcher.config`, scope);
  assertNoUnknownKeys(
    stitcherConfig,
    ["output_format", "include_letter_cantillation", "include_gap_raw"],
    `${path}.stitcher.config`,
    scope
  );
  const stitcherOutputFormat = assertHas(
    stitcherConfig,
    "output_format",
    `${path}.stitcher.config`,
    scope
  );
  if (stitcherOutputFormat !== "jsonl" && stitcherOutputFormat !== "json") {
    fail(scope, `${path}.stitcher.config.output_format`, "expected 'jsonl' | 'json'");
  }
  if (typeof stitcherConfig.include_letter_cantillation !== "boolean") {
    fail(scope, `${path}.stitcher.config.include_letter_cantillation`, "expected boolean");
  }
  if (typeof stitcherConfig.include_gap_raw !== "boolean") {
    fail(scope, `${path}.stitcher.config.include_gap_raw`, "expected boolean");
  }

  const stitchConfigDigest = assertHas(value, "stitchConfigDigest", path, scope);
  if (!isSha256Hex(stitchConfigDigest)) {
    fail(scope, `${path}.stitchConfigDigest`, "expected lowercase sha256 hex");
  }

  assertNonEmptyString(assertHas(value, "created_at", path, scope), `${path}.created_at`, scope);
  if (Number.isNaN(Date.parse(String(value.created_at)))) {
    fail(scope, `${path}.created_at`, "expected valid ISO date-time");
  }

  const digests = assertHas(value, "input_digests", path, scope);
  assertRecord(digests, `${path}.input_digests`, scope);
  assertNoUnknownKeys(
    digests,
    [
      "spine_sha256",
      "letters_ir_sha256",
      "niqqud_ir_sha256",
      "cantillation_ir_sha256",
      "layout_ir_sha256",
      "metadata_plan_sha256"
    ],
    `${path}.input_digests`,
    scope
  );
  for (const key of Object.keys(digests)) {
    if (!isSha256Hex(digests[key])) {
      fail(scope, `${path}.input_digests.${key}`, "expected lowercase sha256 hex");
    }
  }

  const inputRowCounts = assertHas(value, "input_row_counts", path, scope);
  assertRecord(inputRowCounts, `${path}.input_row_counts`, scope);
  assertNoUnknownKeys(
    inputRowCounts,
    ["spine", "letters_ir", "niqqud_ir", "cantillation_ir", "layout_ir"],
    `${path}.input_row_counts`,
    scope
  );
  for (const key of Object.keys(inputRowCounts)) {
    assertNonNegativeInteger(inputRowCounts[key], `${path}.input_row_counts.${key}`, scope);
  }

  const counts = assertHas(value, "counts", path, scope);
  assertRecord(counts, `${path}.counts`, scope);
  assertNoUnknownKeys(
    counts,
    ["program_rows", "ops", "boundaries", "checkpoints"],
    `${path}.counts`,
    scope
  );
  assertNonNegativeInteger(counts.program_rows, `${path}.counts.program_rows`, scope);
  assertNonNegativeInteger(counts.ops, `${path}.counts.ops`, scope);
  assertNonNegativeInteger(counts.boundaries, `${path}.counts.boundaries`, scope);
  assertNonNegativeInteger(counts.checkpoints, `${path}.counts.checkpoints`, scope);

  if (hasOwn(value, "ref_ranges_by_book") && value.ref_ranges_by_book !== undefined) {
    const ranges = value.ref_ranges_by_book;
    assertRecord(ranges, `${path}.ref_ranges_by_book`, scope);
    for (const book of Object.keys(ranges)) {
      const entry = ranges[book];
      assertRecord(entry, `${path}.ref_ranges_by_book.${book}`, scope);
      assertNoUnknownKeys(
        entry,
        ["first_ref", "last_ref", "ops", "boundaries"],
        `${path}.ref_ranges_by_book.${book}`,
        scope
      );
      assertNonEmptyString(entry.first_ref, `${path}.ref_ranges_by_book.${book}.first_ref`, scope);
      assertNonEmptyString(entry.last_ref, `${path}.ref_ranges_by_book.${book}.last_ref`, scope);
      assertNonNegativeInteger(entry.ops, `${path}.ref_ranges_by_book.${book}.ops`, scope);
      assertNonNegativeInteger(
        entry.boundaries,
        `${path}.ref_ranges_by_book.${book}.boundaries`,
        scope
      );
    }
  }

  const contains = assertHas(value, "contains", path, scope);
  assertRecord(contains, `${path}.contains`, scope);
  assertNoUnknownKeys(
    contains,
    ["layout", "cantillation", "letterCantillation", "gapRaw", "metadataCheckpoints"],
    `${path}.contains`,
    scope
  );
  for (const key of Object.keys(contains)) {
    if (typeof contains[key] !== "boolean") {
      fail(scope, `${path}.contains.${key}`, "expected boolean");
    }
  }

  const integrity = assertHas(value, "integrity", path, scope);
  assertRecord(integrity, `${path}.integrity`, scope);
  assertNoUnknownKeys(integrity, ["anchors", "countsByRef", "rollingHash"], `${path}.integrity`, scope);

  const anchors = assertHas(integrity, "anchors", `${path}.integrity`, scope);
  assertRecord(anchors, `${path}.integrity.anchors`, scope);
  assertNoUnknownKeys(
    anchors,
    ["firstRefKey", "lastRefKey", "firstGid", "lastGid", "firstGapid", "lastGapid"],
    `${path}.integrity.anchors`,
    scope
  );
  for (const key of Object.keys(anchors)) {
    const anchorValue = anchors[key];
    if (anchorValue !== null) {
      assertNonEmptyString(anchorValue, `${path}.integrity.anchors.${key}`, scope);
    }
  }

  const countsByRef = assertHas(integrity, "countsByRef", `${path}.integrity`, scope);
  assertRecord(countsByRef, `${path}.integrity.countsByRef`, scope);
  assertNoUnknownKeys(
    countsByRef,
    ["refCount", "meanOpsPerRef", "maxOpsPerRef", "maxBoundariesPerRef"],
    `${path}.integrity.countsByRef`,
    scope
  );
  assertNonNegativeInteger(countsByRef.refCount, `${path}.integrity.countsByRef.refCount`, scope);
  if (typeof countsByRef.meanOpsPerRef !== "number" || countsByRef.meanOpsPerRef < 0) {
    fail(scope, `${path}.integrity.countsByRef.meanOpsPerRef`, "expected number >= 0");
  }
  assertNonNegativeInteger(countsByRef.maxOpsPerRef, `${path}.integrity.countsByRef.maxOpsPerRef`, scope);
  assertNonNegativeInteger(
    countsByRef.maxBoundariesPerRef,
    `${path}.integrity.countsByRef.maxBoundariesPerRef`,
    scope
  );

  const rollingHash = assertHas(integrity, "rollingHash", `${path}.integrity`, scope);
  assertRecord(rollingHash, `${path}.integrity.rollingHash`, scope);
  assertNoUnknownKeys(
    rollingHash,
    ["chunkSize", "chunkDigests"],
    `${path}.integrity.rollingHash`,
    scope
  );
  assertNonNegativeInteger(rollingHash.chunkSize, `${path}.integrity.rollingHash.chunkSize`, scope);
  if (rollingHash.chunkSize < 1) {
    fail(scope, `${path}.integrity.rollingHash.chunkSize`, "expected integer >= 1");
  }
  const chunkDigests = rollingHash.chunkDigests;
  if (!Array.isArray(chunkDigests)) {
    fail(scope, `${path}.integrity.rollingHash.chunkDigests`, "expected array");
  }
  for (let i = 0; i < chunkDigests.length; i += 1) {
    if (!isSha256Hex(chunkDigests[i])) {
      fail(scope, `${path}.integrity.rollingHash.chunkDigests[${i}]`, "expected sha256 hex");
    }
  }

  const cacheDigest = assertHas(value, "cacheDigest", path, scope);
  if (!isSha256Hex(cacheDigest)) {
    fail(scope, `${path}.cacheDigest`, "expected lowercase sha256 hex");
  }

  const output = assertHas(value, "output", path, scope);
  assertRecord(output, `${path}.output`, scope);
  assertNoUnknownKeys(output, ["format", "sha256"], `${path}.output`, scope);
  if (output.format !== "jsonl" && output.format !== "json") {
    fail(scope, `${path}.output.format`, "expected 'jsonl' | 'json'");
  }
  if (!isSha256Hex(output.sha256)) {
    fail(scope, `${path}.output.sha256`, "expected lowercase sha256 hex");
  }
}

export function formatProgramManifest(manifest: ProgramManifest): string {
  assertProgramManifest(manifest);
  return `${canonicalStringify(manifest)}\n`;
}

function buildProgramRows(inputs: StitchProgramIRInputs): ProgramIRRecord[] {
  const niqqudByGid = indexNiqqud(inputs.niqqudRows);
  const cantillationIndex = indexCantillation(inputs.cantillationRecords);
  const layoutByGapid = indexLayout(inputs.layoutRecords);

  const lettersByGid = new Map<string, LettersIRRecord>();
  for (const row of inputs.lettersRecords) {
    if (lettersByGid.has(row.gid)) {
      throw new Error(`stitcher: duplicate LettersIR gid '${row.gid}'`);
    }
    lettersByGid.set(row.gid, row);
  }

  const out: ProgramIRRecord[] = [];
  const nextGidBySpineIndex: Array<string | null> = new Array(inputs.spineRecords.length);
  let nextGid: string | null = null;
  for (let i = inputs.spineRecords.length - 1; i >= 0; i -= 1) {
    const row = inputs.spineRecords[i];
    if (row?.kind === "g") {
      nextGid = row.gid;
    }
    nextGidBySpineIndex[i] = nextGid;
  }
  let previousGid: string | null = null;

  for (let spineIndex = 0; spineIndex < inputs.spineRecords.length; spineIndex += 1) {
    const spineRow = inputs.spineRecords[spineIndex];
    if (!spineRow) {
      continue;
    }
    if (spineRow.kind === "gap") {
      const boundaryRow: ProgramIRRecord = {
        seq: 0,
        kind: "boundary",
        gapid: spineRow.gapid,
        ref_key: spineRow.ref_key,
        gap_index: spineRow.gap_index,
        left_gid: previousGid,
        right_gid: nextGidBySpineIndex[spineIndex] ?? null,
        layout: deepClone(layoutByGapid.get(spineRow.gapid) ?? []),
        cant: deepClone(cantillationIndex.byGapid.get(spineRow.gapid) ?? []),
        raw: deepClone(spineRow.raw)
      };
      assertProgramIRNoRuntimeState(boundaryRow, `ProgramIR[${String(out.length)}]`);
      out.push(boundaryRow);
      continue;
    }

    const letter = lettersByGid.get(spineRow.gid);
    if (!letter) {
      throw new Error(`stitcher: missing LettersIR record for gid '${spineRow.gid}'`);
    }

    const niqqud = niqqudByGid.get(spineRow.gid);
    const cantAttached = deepClone(cantillationIndex.byGid.get(spineRow.gid) ?? []);
    const opRecord: ProgramIROpRecord = {
      seq: 0,
      kind: "op",
      gid: letter.gid,
      ref_key: letter.ref_key,
      g_index: letter.g_index,
      op_kind: letter.op_kind,
      mods: normalizeProgramMods(niqqud),
      ...(letter.word
        ? {
            word_id: letter.word.id,
            pos_in_word: letter.word.index_in_word
          }
        : {}),
      ...(cantAttached.length > 0 ? { cant_attached: cantAttached } : {})
    };
    assertProgramIRNoRuntimeState(opRecord, `ProgramIR[${String(out.length)}]`);
    out.push(opRecord);
    lettersByGid.delete(spineRow.gid);
    previousGid = spineRow.gid;
  }

  if (lettersByGid.size > 0) {
    const first = [...lettersByGid.keys()].sort(compareText)[0] ?? "unknown";
    throw new Error(`stitcher: LettersIR gid '${first}' was not consumed by Spine traversal`);
  }

  const normalized = [...out].sort(compareProgramIRRecords);
  const sequenced = normalized.map((row, seq) => ({
    ...row,
    seq
  }));
  assertProgramIRRecords(sequenced);
  return sequenced;
}

function buildRefRangesByBook(rows: readonly ProgramIRRecord[]): Record<
  string,
  {
    first_ref: string;
    last_ref: string;
    ops: number;
    boundaries: number;
  }
> {
  const out: Record<
    string,
    {
      first_ref: string;
      last_ref: string;
      ops: number;
      boundaries: number;
    }
  > = {};

  for (const row of rows) {
    const ref = row.ref_key;
    const book = ref.split("/")[0] ?? ref;
    const existing = out[book];
    if (!existing) {
      out[book] = {
        first_ref: ref,
        last_ref: ref,
        ops: row.kind === "op" ? 1 : 0,
        boundaries: row.kind === "boundary" ? 1 : 0
      };
      continue;
    }
    existing.last_ref = ref;
    if (row.kind === "op") {
      existing.ops += 1;
    } else {
      existing.boundaries += 1;
    }
  }

  return out;
}

function buildManifestContains(args: {
  rows: readonly ProgramIRRecord[];
  checkpoints: number;
  stitcherConfig: ProgramManifest["stitcher"]["config"];
}): ProgramManifestContains {
  const hasBoundaryRows = args.rows.some((row) => row.kind === "boundary");
  const hasBoundaryCantillation = args.rows.some(
    (row) => row.kind === "boundary" && row.cant.length > 0
  );
  const hasLetterCantillation = args.rows.some(
    (row) => row.kind === "op" && Array.isArray(row.cant_attached) && row.cant_attached.length > 0
  );
  return {
    layout: hasBoundaryRows,
    cantillation: hasBoundaryCantillation || hasLetterCantillation,
    letterCantillation: args.stitcherConfig.include_letter_cantillation && hasLetterCantillation,
    gapRaw:
      args.stitcherConfig.include_gap_raw &&
      args.rows.some((row) => row.kind === "boundary" && row.raw !== undefined),
    metadataCheckpoints: args.checkpoints > 0
  };
}

function buildManifestIntegrity(rows: readonly ProgramIRRecord[]): ProgramManifestIntegrity {
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const opRows = rows.filter((row): row is ProgramIROpRecord => row.kind === "op");
  const boundaryRows = rows.filter((row): row is ProgramIRBoundaryRecord => row.kind === "boundary");

  const perRef = new Map<string, { ops: number; boundaries: number }>();
  for (const row of rows) {
    const tally = perRef.get(row.ref_key) ?? { ops: 0, boundaries: 0 };
    if (row.kind === "op") {
      tally.ops += 1;
    } else {
      tally.boundaries += 1;
    }
    perRef.set(row.ref_key, tally);
  }
  const refCount = perRef.size;
  let totalOps = 0;
  let maxOpsPerRef = 0;
  let maxBoundariesPerRef = 0;
  for (const tally of perRef.values()) {
    totalOps += tally.ops;
    if (tally.ops > maxOpsPerRef) {
      maxOpsPerRef = tally.ops;
    }
    if (tally.boundaries > maxBoundariesPerRef) {
      maxBoundariesPerRef = tally.boundaries;
    }
  }

  const chunkDigests: string[] = [];
  for (let start = 0; start < rows.length; start += PROGRAM_ROLLING_HASH_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + PROGRAM_ROLLING_HASH_CHUNK_SIZE);
    const chunkText = `${chunk.map((row) => serializeProgramIRRecord(row)).join("\n")}\n`;
    chunkDigests.push(sha256Hex(chunkText));
  }

  return {
    anchors: {
      firstRefKey: firstRow?.ref_key ?? null,
      lastRefKey: lastRow?.ref_key ?? null,
      firstGid: opRows[0]?.gid ?? null,
      lastGid: opRows[opRows.length - 1]?.gid ?? null,
      firstGapid: boundaryRows[0]?.gapid ?? null,
      lastGapid: boundaryRows[boundaryRows.length - 1]?.gapid ?? null
    },
    countsByRef: {
      refCount,
      meanOpsPerRef: refCount === 0 ? 0 : totalOps / refCount,
      maxOpsPerRef,
      maxBoundariesPerRef
    },
    rollingHash: {
      chunkSize: PROGRAM_ROLLING_HASH_CHUNK_SIZE,
      chunkDigests
    }
  };
}

function createProgramManifest(args: {
  outputFormat: ProgramIROutputFormat;
  createdAt: string;
  outputSha256: string;
  rows: readonly ProgramIRRecord[];
  inputs: StitchProgramIRInputs;
}): ProgramManifest {
  const opRows = args.rows.filter((row) => row.kind === "op").length;
  const boundaryRows = args.rows.length - opRows;
  const checkpoints = Array.isArray(args.inputs.metadataPlan.checkpoints)
    ? args.inputs.metadataPlan.checkpoints.length
    : 0;

  const spineJsonl = formatSpineJsonl(args.inputs.spineRecords);
  const lettersJsonl = formatLettersIRJsonl(args.inputs.lettersRecords);
  const niqqudJsonl = formatNiqqudIRJsonl(args.inputs.niqqudRows);
  const cantillationJsonl = formatCantillationIRJsonl(args.inputs.cantillationRecords);
  const layoutJsonl = formatLayoutIRJsonl(args.inputs.layoutRecords);
  const metadataPlanJson = canonicalStringify(args.inputs.metadataPlan);
  const stitcherConfig: ProgramManifest["stitcher"]["config"] = {
    output_format: args.outputFormat,
    include_letter_cantillation: true,
    include_gap_raw: true
  };
  const stitchConfigDigest = sha256Hex(canonicalStringify(stitcherConfig));
  const inputDigests: ProgramInputDigests = {
    spine_sha256: sha256Hex(spineJsonl),
    letters_ir_sha256: sha256Hex(lettersJsonl),
    niqqud_ir_sha256: sha256Hex(niqqudJsonl),
    cantillation_ir_sha256: sha256Hex(cantillationJsonl),
    layout_ir_sha256: sha256Hex(layoutJsonl),
    metadata_plan_sha256: sha256Hex(metadataPlanJson)
  };
  const cacheDigest = computeProgramCacheDigest({
    stitcherVersion: STITCHER_VERSION,
    programSchemaVersion: PROGRAM_SCHEMA_VERSION,
    stitchConfigDigest,
    inputDigests,
    programDigest: args.outputSha256
  });
  const build = resolveProgramManifestBuild(args.createdAt);
  const contains = buildManifestContains({
    rows: args.rows,
    checkpoints,
    stitcherConfig
  });
  const integrity = buildManifestIntegrity(args.rows);

  return {
    layer: PROGRAM_LAYER,
    version: PROGRAM_MANIFEST_VERSION,
    programSchemaVersion: PROGRAM_SCHEMA_VERSION,
    contract: `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`,
    build,
    stitcher: {
      version: STITCHER_VERSION,
      config: stitcherConfig
    },
    stitchConfigDigest,
    created_at: args.createdAt,
    input_digests: inputDigests,
    input_row_counts: {
      spine: args.inputs.spineRecords.length,
      letters_ir: args.inputs.lettersRecords.length,
      niqqud_ir: args.inputs.niqqudRows.length,
      cantillation_ir: args.inputs.cantillationRecords.length,
      layout_ir: args.inputs.layoutRecords.length
    },
    counts: {
      program_rows: args.rows.length,
      ops: opRows,
      boundaries: boundaryRows,
      checkpoints
    },
    ref_ranges_by_book: buildRefRangesByBook(args.rows),
    contains,
    integrity,
    cacheDigest,
    output: {
      format: args.outputFormat,
      sha256: args.outputSha256
    }
  };
}

export function stitchProgramIR(args: StitchProgramIRArgs): StitchProgramIRResult {
  const outputFormat = args.outputFormat ?? "jsonl";
  const createdAt = normalizeCreatedAt(args.createdAt);
  const normalizedInputs = normalizeInputs(args);
  const rows = buildProgramRows(normalizedInputs);
  const programIrJsonl = formatProgramIRJsonl(rows);
  const programIrJson = formatProgramIRJson(rows);
  const programIrText = outputFormat === "json" ? programIrJson : programIrJsonl;

  const manifest = createProgramManifest({
    outputFormat,
    createdAt,
    outputSha256: sha256Hex(programIrText),
    rows,
    inputs: normalizedInputs
  });
  const manifestText = formatProgramManifest(manifest);

  return {
    rows,
    programIrJsonl,
    programIrJson,
    programIrText,
    manifest,
    manifestText
  };
}

export async function stitchProgramIRFromFiles(
  args: StitchProgramIRFromFilesArgs
): Promise<StitchProgramIRResult> {
  const outputFormat = args.outputFormat ?? "jsonl";
  const createdAt = normalizeCreatedAt(args.createdAt);
  const [
    stitched,
    spineText,
    lettersText,
    niqqudText,
    cantillationText,
    layoutText,
    metadataPlanText
  ] = await Promise.all([
    stitchProgramRowsFromFiles({
      spinePath: args.spinePath,
      lettersIrPath: args.lettersIrPath,
      niqqudIrPath: args.niqqudIrPath,
      cantillationIrPath: args.cantillationIrPath,
      layoutIrPath: args.layoutIrPath,
      metadataPlanPath: args.metadataPlanPath
    }),
    fs.readFile(args.spinePath, "utf8"),
    fs.readFile(args.lettersIrPath, "utf8"),
    fs.readFile(args.niqqudIrPath, "utf8"),
    fs.readFile(args.cantillationIrPath, "utf8"),
    fs.readFile(args.layoutIrPath, "utf8"),
    fs.readFile(args.metadataPlanPath, "utf8")
  ]);

  const spineRecords = parseSpineJsonl(spineText);
  const lettersRecords = parseLettersIRJsonl(lettersText);
  const niqqudRows = parseNiqqudIRJsonl(niqqudText);
  const cantillationRecords = parseCantillationIRJsonl(cantillationText);
  const layoutRecords = parseLayoutIRJsonl(layoutText);
  const metadataPlan = parseMetadataPlanJson(metadataPlanText);
  const normalizedInputs = normalizeInputs({
    spineRecords,
    lettersRecords,
    niqqudRows,
    cantillationRecords,
    layoutRecords,
    metadataPlan
  });

  const rows = [...stitched.rows];
  assertProgramIRRecords(rows);

  const programIrJsonl = formatProgramIRJsonl(rows);
  const programIrJson = formatProgramIRJson(rows);
  const programIrText = outputFormat === "json" ? programIrJson : programIrJsonl;

  const manifest = createProgramManifest({
    outputFormat,
    createdAt,
    outputSha256: sha256Hex(programIrText),
    rows,
    inputs: normalizedInputs
  });
  const manifestText = formatProgramManifest(manifest);

  return {
    rows,
    programIrJsonl,
    programIrJson,
    programIrText,
    manifest,
    manifestText
  };
}

export async function writeProgramIRJsonl(
  filePath: string,
  records: readonly ProgramIRRecord[]
): Promise<void> {
  const text = formatProgramIRJsonl(records);
  await fs.writeFile(filePath, text, "utf8");
}

export async function writeProgramIRJson(
  filePath: string,
  records: readonly ProgramIRRecord[]
): Promise<void> {
  const text = formatProgramIRJson(records);
  await fs.writeFile(filePath, text, "utf8");
}

export async function writeProgramManifest(
  filePath: string,
  manifest: ProgramManifest
): Promise<void> {
  const text = formatProgramManifest(manifest);
  await fs.writeFile(filePath, text, "utf8");
}
