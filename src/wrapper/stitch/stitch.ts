import fs from "node:fs";
import readline from "node:readline";
import {
  assertCantillationIRRecord,
  type CantillationEvent,
  type CantillationIRRecord
} from "../../layers/cantillation/schema";
import { assertLayoutIRRecord, type LayoutEvent } from "../../layers/layout/schema";
import { assertLettersIRRecord } from "../../layers/letters/schema";
import { assertNiqqudIRRow } from "../../layers/niqqud/schema";
import type { ProgramIRRecord } from "../program_schema";
import {
  loadStitchAnchorIndexes,
  type LoadStitchAnchorIndexesArgs,
  type StitchAnchorIndexes
} from "./loaders";
import {
  assertCantillationIRNoBleed,
  assertLayoutIRNoBleed,
  assertLettersIRNoBleed,
  assertNiqqudIRNoBleed,
  assertProgramIRNoRuntimeState
} from "./contractChecks";
import { readSpineTraversalPlanFromJsonl, type SpineTraversalPlan } from "./spinePlan";

type UnknownRecord = Record<string, unknown>;

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

export type StitchProgramRowsFromFilesArgs = LoadStitchAnchorIndexesArgs & {
  spinePath: string;
  allowMissingLetters?: boolean;
};

export type StitchProgramRowsResult = {
  rows: ProgramIRRecord[];
  spinePlan: SpineTraversalPlan;
  indexes: StitchAnchorIndexes;
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function isRecord(value: unknown): value is UnknownRecord {
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rankValue(value: unknown): number | null | undefined {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, "rank")) {
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

function compareCantEventsForJoin(left: CantillationEvent, right: CantillationEvent): number {
  const leftRank = CANT_EVENT_TYPE_ORDER[left.type];
  const rightRank = CANT_EVENT_TYPE_ORDER[right.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const rankCmp = compareOptionalRank(rankValue(left), rankValue(right));
  if (rankCmp !== 0) {
    return rankCmp;
  }
  return compareText(canonicalStringify(left), canonicalStringify(right));
}

function compareLayoutEventsForJoin(left: LayoutEvent, right: LayoutEvent): number {
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

function normalizeCantEvents(events: readonly CantillationEvent[]): CantillationEvent[] {
  return [...events].map((event) => deepClone(event)).sort(compareCantEventsForJoin);
}

function normalizeLayoutEvents(events: readonly LayoutEvent[]): LayoutEvent[] {
  return [...events].map((event) => deepClone(event)).sort(compareLayoutEventsForJoin);
}

async function* readJsonlValues(filePath: string): AsyncGenerator<{
  value: unknown;
  lineNumber: number;
}> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (line.length === 0) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `stitch: ${filePath}:${String(lineNumber)} invalid JSONL line (${message})`
        );
      }

      yield { value: parsed, lineNumber };
    }
  } finally {
    lines.close();
    stream.close();
  }
}

async function validateLettersAnchors(
  filePath: string,
  knownGids: ReadonlySet<string>
): Promise<void> {
  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    const location = `${filePath}:${String(lineNumber)}`;
    try {
      assertLettersIRRecord(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`stitch: ${location} invalid LettersIR record (${message})`);
    }
    assertLettersIRNoBleed(value, location);

    if (!knownGids.has(value.gid)) {
      throw new Error(`stitch: ${location} LettersIR gid '${value.gid}' missing from Spine`);
    }
  }
}

async function validateNiqqudAnchors(
  filePath: string,
  knownGids: ReadonlySet<string>
): Promise<void> {
  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    const location = `${filePath}:${String(lineNumber)}`;
    try {
      assertNiqqudIRRow(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`stitch: ${location} invalid NiqqudIR record (${message})`);
    }
    assertNiqqudIRNoBleed(value, location);

    if (!knownGids.has(value.gid)) {
      throw new Error(`stitch: ${location} NiqqudIR gid '${value.gid}' missing from Spine`);
    }
  }
}

async function validateLayoutAnchors(
  filePath: string,
  knownGapids: ReadonlySet<string>
): Promise<void> {
  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    const location = `${filePath}:${String(lineNumber)}`;
    try {
      assertLayoutIRRecord(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`stitch: ${location} invalid LayoutIR record (${message})`);
    }
    assertLayoutIRNoBleed(value, location);

    if (!knownGapids.has(value.gapid)) {
      throw new Error(`stitch: ${location} LayoutIR gapid '${value.gapid}' missing from Spine`);
    }
  }
}

async function validateCantillationAnchors(
  filePath: string,
  knownGids: ReadonlySet<string>,
  knownGapids: ReadonlySet<string>
): Promise<void> {
  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    const location = `${filePath}:${String(lineNumber)}`;
    let row: CantillationIRRecord;
    try {
      assertCantillationIRRecord(value);
      row = value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`stitch: ${location} invalid CantillationIR record (${message})`);
    }
    assertCantillationIRNoBleed(value, location);

    if (row.anchor.kind === "gid") {
      if (!knownGids.has(row.anchor.id)) {
        throw new Error(
          `stitch: ${location} CantillationIR gid '${row.anchor.id}' missing from Spine`
        );
      }
      continue;
    }

    if (!knownGapids.has(row.anchor.id)) {
      throw new Error(
        `stitch: ${location} CantillationIR gapid '${row.anchor.id}' missing from Spine`
      );
    }
  }
}

export async function validateStitchAnchorsFromFiles(
  args: Pick<
    StitchProgramRowsFromFilesArgs,
    "spinePath" | "lettersIrPath" | "niqqudIrPath" | "cantillationIrPath" | "layoutIrPath"
  >
): Promise<SpineTraversalPlan> {
  const spinePlan = await readSpineTraversalPlanFromJsonl(args.spinePath);
  await validateLettersAnchors(args.lettersIrPath, spinePlan.gidSet);
  await validateNiqqudAnchors(args.niqqudIrPath, spinePlan.gidSet);
  await validateLayoutAnchors(args.layoutIrPath, spinePlan.gapidSet);
  await validateCantillationAnchors(args.cantillationIrPath, spinePlan.gidSet, spinePlan.gapidSet);
  return spinePlan;
}

function stitchProgramRowsFromPlan(args: {
  spinePlan: SpineTraversalPlan;
  indexes: StitchAnchorIndexes;
  allowMissingLetters?: boolean;
}): ProgramIRRecord[] {
  const graphemeByGid = new Map(args.spinePlan.graphemes.map((row) => [row.gid, row]));
  const gapByGapid = new Map(args.spinePlan.gaps.map((row) => [row.gapid, row]));
  const rows: ProgramIRRecord[] = [];

  for (const step of args.spinePlan.plan) {
    if (step.kind === "g") {
      const grapheme = graphemeByGid.get(step.gid);
      if (!grapheme) {
        throw new Error(`stitch: internal spine plan error: unknown gid '${step.gid}'`);
      }

      const letter = args.indexes.lettersByGid.get(step.gid);
      if (!letter) {
        if (args.allowMissingLetters === true) {
          continue;
        }
        throw new Error(`stitch: missing LettersIR record for gid '${step.gid}'`);
      }

      if (letter.ref_key !== grapheme.ref_key || letter.g_index !== grapheme.g_index) {
        throw new Error(
          `stitch: LettersIR gid '${step.gid}' mismatches Spine location (LettersIR ${letter.ref_key}:${String(letter.g_index)}, Spine ${grapheme.ref_key}:${String(grapheme.g_index)})`
        );
      }

      const cantAttached = normalizeCantEvents(args.indexes.cantByGid.get(step.gid) ?? []);
      const opRow: ProgramIRRecord = {
        kind: "op",
        gid: letter.gid,
        ref_key: letter.ref_key,
        g_index: letter.g_index,
        op_kind: letter.op_kind,
        mods: deepClone(args.indexes.niqqudByGid.get(step.gid) ?? {}),
        ...(cantAttached.length > 0 ? { cant_attached: cantAttached } : {})
      };
      assertProgramIRNoRuntimeState(opRow, `ProgramIR[${String(rows.length)}]`);
      rows.push(opRow);
      continue;
    }

    const gap = gapByGapid.get(step.gapid);
    if (!gap) {
      throw new Error(`stitch: internal spine plan error: unknown gapid '${step.gapid}'`);
    }

    const boundaryRow: ProgramIRRecord = {
      kind: "boundary",
      gapid: gap.gapid,
      ref_key: gap.ref_key,
      gap_index: gap.gap_index,
      layout: normalizeLayoutEvents(args.indexes.layoutByGap.get(step.gapid) ?? []),
      cant: normalizeCantEvents(args.indexes.cantByGap.get(step.gapid) ?? []),
      raw: deepClone(gap.raw)
    };
    assertProgramIRNoRuntimeState(boundaryRow, `ProgramIR[${String(rows.length)}]`);
    rows.push(boundaryRow);
  }

  return rows;
}

export async function stitchProgramRowsFromFiles(
  args: StitchProgramRowsFromFilesArgs
): Promise<StitchProgramRowsResult> {
  const spinePlan = await validateStitchAnchorsFromFiles(args);
  const indexes = await loadStitchAnchorIndexes({
    lettersIrPath: args.lettersIrPath,
    niqqudIrPath: args.niqqudIrPath,
    cantillationIrPath: args.cantillationIrPath,
    layoutIrPath: args.layoutIrPath,
    metadataPlanPath: args.metadataPlanPath
  });
  const rows = stitchProgramRowsFromPlan({
    spinePlan,
    indexes,
    allowMissingLetters: args.allowMissingLetters
  });

  return { rows, spinePlan, indexes };
}
