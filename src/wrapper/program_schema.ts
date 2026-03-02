import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import {
  assertCantillationIRRecords,
  compareCantillationEvents,
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
import {
  assertLettersIRRecords,
  compareLettersIRRecords,
  formatLettersIRJsonl,
  parseLettersIRJsonl,
  type LettersIRRecord
} from "../layers/letters/schema";
import {
  assertNiqqudIRRow,
  assertNiqqudIRRows,
  compareNiqqudIRRows,
  formatNiqqudIRJsonl,
  parseNiqqudIRJsonl,
  type NiqqudFlags,
  type NiqqudIRRow,
  type NiqqudMods
} from "../layers/niqqud/schema";
import { assertSpineRecord, type SpineRecord } from "../spine/schema";

export const PROGRAM_LAYER = "program";
export const PROGRAM_IR_VERSION = 1;
export const PROGRAM_MANIFEST_VERSION = "1.0.0";
export const STITCHER_CONTRACT_VERSION = "1.0.0";

export type ProgramIROutputFormat = "jsonl" | "json";

export type MetadataPlan = Record<string, unknown>;

export type ProgramNiqqudAttachment = {
  mods: NiqqudMods;
  unhandled: string[];
  flags?: NiqqudFlags;
};

export type ProgramIROpRecord = {
  kind: "program_op";
  gid: string;
  ref_key: string;
  g_index: number;
  letter: string;
  op_kind: string;
  features?: Record<string, unknown>;
  word?: LettersIRRecord["word"];
  flags?: LettersIRRecord["flags"];
  source: LettersIRRecord["source"];
  niqqud?: ProgramNiqqudAttachment;
  cantillation_events: CantillationEvent[];
};

export type ProgramIRBoundaryRecord = {
  kind: "boundary_frame";
  gapid: string;
  ref_key: string;
  gap_index: number;
  layout_events: LayoutEvent[];
  cantillation_events: CantillationEvent[];
};

export type ProgramIRRecord = ProgramIROpRecord | ProgramIRBoundaryRecord;

export type ProgramManifest = {
  layer: typeof PROGRAM_LAYER;
  version: typeof PROGRAM_MANIFEST_VERSION;
  contract: `STITCHER_CONTRACT/${typeof STITCHER_CONTRACT_VERSION}`;
  created_at: string;
  output_format: ProgramIROutputFormat;
  input_digests: {
    spine_sha256: string;
    letters_ir_sha256: string;
    niqqud_ir_sha256: string;
    cantillation_ir_sha256: string;
    layout_ir_sha256: string;
    metadata_plan_sha256: string;
  };
  input_row_counts: {
    spine: number;
    letters_ir: number;
    niqqud_ir: number;
    cantillation_ir: number;
    layout_ir: number;
  };
  counts: {
    program_rows: number;
    op_rows: number;
    boundary_rows: number;
  };
  output_sha256: string;
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

const OWN = Object.prototype.hasOwnProperty;

const LAYOUT_EVENT_TYPE_ORDER: Readonly<Record<LayoutEvent["type"], number>> = {
  SPACE: 0,
  SETUMA: 1,
  PETUCHA: 2,
  BOOK_BREAK: 3
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

  return {
    spineRecords,
    lettersRecords,
    niqqudRows,
    cantillationRecords,
    layoutRecords,
    metadataPlan: deepClone(args.metadataPlan)
  };
}

function cloneNiqqudAttachment(row: NiqqudIRRow): ProgramNiqqudAttachment {
  return {
    mods: deepClone(row.mods),
    unhandled: [...row.unhandled],
    ...(row.flags ? { flags: deepClone(row.flags) } : {})
  };
}

function indexNiqqud(rows: readonly NiqqudIRRow[]): Map<string, ProgramNiqqudAttachment> {
  const out = new Map<string, ProgramNiqqudAttachment>();
  for (const row of rows) {
    if (out.has(row.gid)) {
      throw new Error(`stitcher: duplicate NiqqudIR gid '${row.gid}'`);
    }
    out.set(row.gid, cloneNiqqudAttachment(row));
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
    byGid.set(key, [...events].sort(compareCantillationEvents));
  }
  for (const [key, events] of byGapid.entries()) {
    byGapid.set(key, [...events].sort(compareCantillationEvents));
  }

  return { byGid, byGapid };
}

function compareLayoutEvents(left: LayoutEvent, right: LayoutEvent): number {
  const leftRank = LAYOUT_EVENT_TYPE_ORDER[left.type];
  const rightRank = LAYOUT_EVENT_TYPE_ORDER[right.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return compareText(canonicalStringify(left.meta), canonicalStringify(right.meta));
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
  if (record.kind === "boundary_frame") {
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

function assertProgramNiqqudAttachment(
  value: unknown,
  path: string,
  scope: string
): asserts value is ProgramNiqqudAttachment {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["mods", "unhandled", "flags"], path, scope);

  const rowLike: NiqqudIRRow = {
    kind: "niqqud",
    version: 1,
    gid: "dummy/0/0#g:0",
    ref_key: "dummy/0/0",
    g_index: 0,
    raw: { niqqud: [] },
    mods: assertHas(value, "mods", path, scope) as NiqqudMods,
    unhandled: assertHas(value, "unhandled", path, scope) as string[],
    ...(hasOwn(value, "flags") && value.flags !== undefined ? { flags: value.flags } : {})
  };
  assertNiqqudIRRow(rowLike, path, scope);
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

  if (kind === "program_op") {
    assertNoUnknownKeys(
      value,
      [
        "kind",
        "gid",
        "ref_key",
        "g_index",
        "letter",
        "op_kind",
        "features",
        "word",
        "flags",
        "source",
        "niqqud",
        "cantillation_events"
      ],
      path,
      scope
    );

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

    assertNonEmptyString(assertHas(value, "letter", path, scope), `${path}.letter`, scope);
    assertNonEmptyString(assertHas(value, "op_kind", path, scope), `${path}.op_kind`, scope);

    const source = assertHas(value, "source", path, scope);
    assertRecord(source, `${path}.source`, scope);
    assertNoUnknownKeys(source, ["spine_digest"], `${path}.source`, scope);
    if (!isSha256Hex(source.spine_digest)) {
      fail(scope, `${path}.source.spine_digest`, "expected lowercase sha256 hex");
    }

    if (hasOwn(value, "niqqud") && value.niqqud !== undefined) {
      assertProgramNiqqudAttachment(value.niqqud, `${path}.niqqud`, scope);
    }

    const cantillationEvents = assertHas(value, "cantillation_events", path, scope);
    if (!Array.isArray(cantillationEvents)) {
      fail(
        scope,
        `${path}.cantillation_events`,
        `expected array, got ${describe(cantillationEvents)}`
      );
    }
    for (let i = 0; i < cantillationEvents.length; i += 1) {
      assertCantillationEvent(cantillationEvents[i], `${path}.cantillation_events[${i}]`, scope);
    }

    return;
  }

  if (kind === "boundary_frame") {
    assertNoUnknownKeys(
      value,
      ["kind", "gapid", "ref_key", "gap_index", "layout_events", "cantillation_events"],
      path,
      scope
    );

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

    const layoutEvents = assertHas(value, "layout_events", path, scope);
    if (!Array.isArray(layoutEvents)) {
      fail(scope, `${path}.layout_events`, `expected array, got ${describe(layoutEvents)}`);
    }
    for (let i = 0; i < layoutEvents.length; i += 1) {
      const layoutRecordLike: LayoutIRRecord = {
        gapid,
        ref_key,
        gap_index,
        layout_event: layoutEvents[i] as LayoutEvent
      };
      assertLayoutIRRecord(layoutRecordLike, `${path}.layout_events[${i}]`, scope);
    }

    const cantillationEvents = assertHas(value, "cantillation_events", path, scope);
    if (!Array.isArray(cantillationEvents)) {
      fail(
        scope,
        `${path}.cantillation_events`,
        `expected array, got ${describe(cantillationEvents)}`
      );
    }
    for (let i = 0; i < cantillationEvents.length; i += 1) {
      assertCantillationEvent(cantillationEvents[i], `${path}.cantillation_events[${i}]`, scope);
    }
    return;
  }

  fail(scope, `${path}.kind`, `expected 'program_op' | 'boundary_frame', got ${describe(kind)}`);
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

    const key =
      row.kind === "program_op" ? `${row.kind}\u0000${row.gid}` : `${row.kind}\u0000${row.gapid}`;
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
      "contract",
      "created_at",
      "output_format",
      "input_digests",
      "input_row_counts",
      "counts",
      "output_sha256"
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

  const contract = assertHas(value, "contract", path, scope);
  const expectedContract = `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`;
  if (contract !== expectedContract) {
    fail(scope, `${path}.contract`, `expected '${expectedContract}', got ${describe(contract)}`);
  }

  assertNonEmptyString(assertHas(value, "created_at", path, scope), `${path}.created_at`, scope);
  if (Number.isNaN(Date.parse(String(value.created_at)))) {
    fail(scope, `${path}.created_at`, "expected valid ISO date-time");
  }

  const outputFormat = assertHas(value, "output_format", path, scope);
  if (outputFormat !== "jsonl" && outputFormat !== "json") {
    fail(scope, `${path}.output_format`, "expected 'jsonl' | 'json'");
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
    ["program_rows", "op_rows", "boundary_rows"],
    `${path}.counts`,
    scope
  );
  assertNonNegativeInteger(counts.program_rows, `${path}.counts.program_rows`, scope);
  assertNonNegativeInteger(counts.op_rows, `${path}.counts.op_rows`, scope);
  assertNonNegativeInteger(counts.boundary_rows, `${path}.counts.boundary_rows`, scope);

  const outputSha = assertHas(value, "output_sha256", path, scope);
  if (!isSha256Hex(outputSha)) {
    fail(scope, `${path}.output_sha256`, "expected lowercase sha256 hex");
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

  for (const spineRow of inputs.spineRecords) {
    if (spineRow.kind === "gap") {
      out.push({
        kind: "boundary_frame",
        gapid: spineRow.gapid,
        ref_key: spineRow.ref_key,
        gap_index: spineRow.gap_index,
        layout_events: deepClone(layoutByGapid.get(spineRow.gapid) ?? []),
        cantillation_events: deepClone(cantillationIndex.byGapid.get(spineRow.gapid) ?? [])
      });
      continue;
    }

    const letter = lettersByGid.get(spineRow.gid);
    if (!letter) {
      continue;
    }

    const niqqud = niqqudByGid.get(spineRow.gid);
    const opRecord: ProgramIROpRecord = {
      kind: "program_op",
      gid: letter.gid,
      ref_key: letter.ref_key,
      g_index: letter.g_index,
      letter: letter.letter,
      op_kind: letter.op_kind,
      ...(letter.features ? { features: deepClone(letter.features) } : {}),
      ...(letter.word ? { word: deepClone(letter.word) } : {}),
      ...(letter.flags ? { flags: deepClone(letter.flags) } : {}),
      source: deepClone(letter.source),
      ...(niqqud ? { niqqud: deepClone(niqqud) } : {}),
      cantillation_events: deepClone(cantillationIndex.byGid.get(spineRow.gid) ?? [])
    };
    out.push(opRecord);
    lettersByGid.delete(spineRow.gid);
  }

  if (lettersByGid.size > 0) {
    const first = [...lettersByGid.keys()].sort(compareText)[0] ?? "unknown";
    throw new Error(`stitcher: LettersIR gid '${first}' was not consumed by Spine traversal`);
  }

  const normalized = [...out].sort(compareProgramIRRecords);
  assertProgramIRRecords(normalized);
  return normalized;
}

function createProgramManifest(args: {
  outputFormat: ProgramIROutputFormat;
  createdAt: string;
  outputSha256: string;
  rows: readonly ProgramIRRecord[];
  inputs: StitchProgramIRInputs;
}): ProgramManifest {
  const opRows = args.rows.filter((row) => row.kind === "program_op").length;
  const boundaryRows = args.rows.length - opRows;

  const spineJsonl = formatSpineJsonl(args.inputs.spineRecords);
  const lettersJsonl = formatLettersIRJsonl(args.inputs.lettersRecords);
  const niqqudJsonl = formatNiqqudIRJsonl(args.inputs.niqqudRows);
  const cantillationJsonl = formatCantillationIRJsonl(args.inputs.cantillationRecords);
  const layoutJsonl = formatLayoutIRJsonl(args.inputs.layoutRecords);
  const metadataPlanJson = canonicalStringify(args.inputs.metadataPlan);

  return {
    layer: PROGRAM_LAYER,
    version: PROGRAM_MANIFEST_VERSION,
    contract: `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`,
    created_at: args.createdAt,
    output_format: args.outputFormat,
    input_digests: {
      spine_sha256: sha256Hex(spineJsonl),
      letters_ir_sha256: sha256Hex(lettersJsonl),
      niqqud_ir_sha256: sha256Hex(niqqudJsonl),
      cantillation_ir_sha256: sha256Hex(cantillationJsonl),
      layout_ir_sha256: sha256Hex(layoutJsonl),
      metadata_plan_sha256: sha256Hex(metadataPlanJson)
    },
    input_row_counts: {
      spine: args.inputs.spineRecords.length,
      letters_ir: args.inputs.lettersRecords.length,
      niqqud_ir: args.inputs.niqqudRows.length,
      cantillation_ir: args.inputs.cantillationRecords.length,
      layout_ir: args.inputs.layoutRecords.length
    },
    counts: {
      program_rows: args.rows.length,
      op_rows: opRows,
      boundary_rows: boundaryRows
    },
    output_sha256: args.outputSha256
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
  const [spineText, lettersText, niqqudText, cantillationText, layoutText, metadataPlanText] =
    await Promise.all([
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

  return stitchProgramIR({
    spineRecords,
    lettersRecords,
    niqqudRows,
    cantillationRecords,
    layoutRecords,
    metadataPlan,
    ...(args.outputFormat ? { outputFormat: args.outputFormat } : {}),
    ...(args.createdAt ? { createdAt: args.createdAt } : {})
  });
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
