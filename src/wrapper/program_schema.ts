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
  type NiqqudIRRow,
  type NiqqudMods
} from "../layers/niqqud/schema";
import { assertSpineRecord, type SpineRecord } from "../spine/schema";

export const PROGRAM_LAYER = "program";
export const PROGRAM_IR_VERSION = 1;
export const PROGRAM_MANIFEST_VERSION = "1.0.0";
export const STITCHER_CONTRACT_VERSION = "1.0.0";
export const STITCHER_VERSION = "1.0.0";

export type ProgramIROutputFormat = "jsonl" | "json";

export type MetadataPlan = Record<string, unknown> & {
  checkpoints?: Array<{
    ref_end: string;
    [key: string]: unknown;
  }>;
};

export type ProgramIROpRecord = {
  kind: "op";
  gid: string;
  ref_key: string;
  g_index: number;
  op_kind: string;
  mods: NiqqudMods | Record<string, never>;
  cant_attached?: CantillationEvent[];
};

export type ProgramIRBoundaryRecord = {
  kind: "boundary";
  gapid: string;
  ref_key: string;
  gap_index: number;
  layout: LayoutEvent[];
  cant: CantillationEvent[];
  raw: {
    whitespace?: boolean;
    chars?: string[];
    [key: string]: unknown;
  };
};

export type ProgramIRRecord = ProgramIROpRecord | ProgramIRBoundaryRecord;

export type ProgramManifest = {
  layer: typeof PROGRAM_LAYER;
  version: typeof PROGRAM_MANIFEST_VERSION;
  contract: `STITCHER_CONTRACT/${typeof STITCHER_CONTRACT_VERSION}`;
  stitcher: {
    version: typeof STITCHER_VERSION;
    config: {
      output_format: ProgramIROutputFormat;
      include_letter_cantillation: boolean;
      include_gap_raw: boolean;
    };
  };
  created_at: string;
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
  if (Object.keys(value).length === 0) {
    return;
  }

  const rowLike: NiqqudIRRow = {
    kind: "niqqud",
    version: 1,
    gid: "dummy/0/0#g:0",
    ref_key: "dummy/0/0",
    g_index: 0,
    raw: { niqqud: [] },
    mods: value as NiqqudMods,
    unhandled: []
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

  if (kind === "op") {
    assertNoUnknownKeys(
      value,
      ["kind", "gid", "ref_key", "g_index", "op_kind", "mods", "cant_attached"],
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

    assertNonEmptyString(assertHas(value, "op_kind", path, scope), `${path}.op_kind`, scope);
    assertProgramMods(assertHas(value, "mods", path, scope), `${path}.mods`, scope);

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
      ["kind", "gapid", "ref_key", "gap_index", "layout", "cant", "raw"],
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
      "contract",
      "stitcher",
      "created_at",
      "input_digests",
      "input_row_counts",
      "counts",
      "ref_ranges_by_book",
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

  const contract = assertHas(value, "contract", path, scope);
  const expectedContract = `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`;
  if (contract !== expectedContract) {
    fail(scope, `${path}.contract`, `expected '${expectedContract}', got ${describe(contract)}`);
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

  for (const spineRow of inputs.spineRecords) {
    if (spineRow.kind === "gap") {
      out.push({
        kind: "boundary",
        gapid: spineRow.gapid,
        ref_key: spineRow.ref_key,
        gap_index: spineRow.gap_index,
        layout: deepClone(layoutByGapid.get(spineRow.gapid) ?? []),
        cant: deepClone(cantillationIndex.byGapid.get(spineRow.gapid) ?? []),
        raw: deepClone(spineRow.raw)
      });
      continue;
    }

    const letter = lettersByGid.get(spineRow.gid);
    if (!letter) {
      continue;
    }

    const niqqud = niqqudByGid.get(spineRow.gid);
    const cantAttached = deepClone(cantillationIndex.byGid.get(spineRow.gid) ?? []);
    const opRecord: ProgramIROpRecord = {
      kind: "op",
      gid: letter.gid,
      ref_key: letter.ref_key,
      g_index: letter.g_index,
      op_kind: letter.op_kind,
      mods: niqqud ? deepClone(niqqud) : {},
      ...(cantAttached.length > 0 ? { cant_attached: cantAttached } : {})
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

  return {
    layer: PROGRAM_LAYER,
    version: PROGRAM_MANIFEST_VERSION,
    contract: `STITCHER_CONTRACT/${STITCHER_CONTRACT_VERSION}`,
    stitcher: {
      version: STITCHER_VERSION,
      config: {
        output_format: args.outputFormat,
        include_letter_cantillation: true,
        include_gap_raw: true
      }
    },
    created_at: args.createdAt,
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
      ops: opRows,
      boundaries: boundaryRows,
      checkpoints
    },
    ref_ranges_by_book: buildRefRangesByBook(args.rows),
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
