import fs from "node:fs";
import readline from "node:readline";
import {
  assertCantillationIRRecord,
  compareCantillationEvents,
  type CantillationEvent,
  type CantillationIRRecord
} from "../../layers/cantillation/schema";
import {
  assertLayoutIRRecord,
  type LayoutEvent,
  type LayoutIRRecord
} from "../../layers/layout/schema";
import { assertLettersIRRecord, type LettersIRRecord } from "../../layers/letters/schema";
import { assertNiqqudIRRow, type NiqqudMods } from "../../layers/niqqud/schema";
import { assertRefKey, type RefKey } from "../../ir/refkey";

export type LettersOp = Omit<LettersIRRecord, "kind">;
export type CantEvent = CantillationEvent;

export type Checkpoint = {
  ref_end?: RefKey;
  ref_key_end?: RefKey;
  [key: string]: unknown;
};

export type MetadataPlanDocument = Record<string, unknown> & {
  checkpoints?: Checkpoint[];
};

export type StitchAnchorIndexes = {
  lettersByGid: Map<string, LettersOp>;
  niqqudByGid: Map<string, NiqqudMods>;
  cantByGid: Map<string, CantEvent[]>;
  cantByGap: Map<string, CantEvent[]>;
  layoutByGap: Map<string, LayoutEvent[]>;
  metadataPlan: MetadataPlanDocument;
  checkpointByRefEnd: Map<RefKey, Checkpoint[]>;
};

export type LoadStitchAnchorIndexesArgs = {
  lettersIrPath: string;
  niqqudIrPath: string;
  cantillationIrPath: string;
  layoutIrPath: string;
  metadataPlanPath: string;
};

type UnknownRecord = Record<string, unknown>;

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareCantEventsStable(left: CantEvent, right: CantEvent): number {
  const eventCmp = compareCantillationEvents(left, right);
  if (eventCmp !== 0) {
    return eventCmp;
  }
  return compareText(canonicalStringify(left), canonicalStringify(right));
}

function compareLayoutEventsStable(left: LayoutEvent, right: LayoutEvent): number {
  const leftRank = LAYOUT_EVENT_TYPE_ORDER[left.type];
  const rightRank = LAYOUT_EVENT_TYPE_ORDER[right.type];
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const metaCmp = compareText(canonicalStringify(left.meta), canonicalStringify(right.meta));
  if (metaCmp !== 0) {
    return metaCmp;
  }
  return compareText(canonicalStringify(left), canonicalStringify(right));
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
          `stitch loaders: ${filePath}:${String(lineNumber)} invalid JSONL line (${message})`
        );
      }
      yield { value: parsed, lineNumber };
    }
  } finally {
    lines.close();
    stream.close();
  }
}

function toLettersOp(row: LettersIRRecord): LettersOp {
  return {
    gid: row.gid,
    ref_key: row.ref_key,
    g_index: row.g_index,
    letter: row.letter,
    op_kind: row.op_kind,
    ...(row.features ? { features: clone(row.features) } : {}),
    ...(row.word ? { word: clone(row.word) } : {}),
    ...(row.flags ? { flags: clone(row.flags) } : {}),
    source: clone(row.source)
  };
}

export async function loadLettersByGid(filePath: string): Promise<Map<string, LettersOp>> {
  const lettersByGid = new Map<string, LettersOp>();

  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    try {
      assertLettersIRRecord(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `stitch loaders: ${filePath}:${String(lineNumber)} invalid LettersIR record (${message})`
      );
    }

    if (lettersByGid.has(value.gid)) {
      throw new Error(
        `stitch loaders: duplicate LettersIR gid '${value.gid}' at ${filePath}:${String(lineNumber)}`
      );
    }
    lettersByGid.set(value.gid, toLettersOp(value));
  }

  return lettersByGid;
}

export async function loadNiqqudByGid(filePath: string): Promise<Map<string, NiqqudMods>> {
  const niqqudByGid = new Map<string, NiqqudMods>();

  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    try {
      assertNiqqudIRRow(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `stitch loaders: ${filePath}:${String(lineNumber)} invalid NiqqudIR record (${message})`
      );
    }

    if (niqqudByGid.has(value.gid)) {
      throw new Error(
        `stitch loaders: duplicate NiqqudIR gid '${value.gid}' at ${filePath}:${String(lineNumber)}`
      );
    }
    niqqudByGid.set(value.gid, clone(value.mods));
  }

  return niqqudByGid;
}

function pushCantEvent(target: Map<string, CantEvent[]>, key: string, event: CantEvent): void {
  const existing = target.get(key) ?? [];
  existing.push(clone(event));
  target.set(key, existing);
}

function finalizeCantEvents(map: Map<string, CantEvent[]>): void {
  for (const [anchorId, events] of map.entries()) {
    map.set(anchorId, [...events].sort(compareCantEventsStable));
  }
}

export async function loadCantillationIndexes(filePath: string): Promise<{
  cantByGid: Map<string, CantEvent[]>;
  cantByGap: Map<string, CantEvent[]>;
}> {
  const cantByGid = new Map<string, CantEvent[]>();
  const cantByGap = new Map<string, CantEvent[]>();

  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    let row: CantillationIRRecord;
    try {
      assertCantillationIRRecord(value);
      row = value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `stitch loaders: ${filePath}:${String(lineNumber)} invalid CantillationIR record (${message})`
      );
    }

    if (row.anchor.kind === "gid") {
      pushCantEvent(cantByGid, row.anchor.id, row.event);
      continue;
    }
    pushCantEvent(cantByGap, row.anchor.id, row.event);
  }

  finalizeCantEvents(cantByGid);
  finalizeCantEvents(cantByGap);

  return { cantByGid, cantByGap };
}

function pushLayoutEvent(map: Map<string, LayoutEvent[]>, gapid: string, event: LayoutEvent): void {
  const existing = map.get(gapid) ?? [];
  existing.push(clone(event));
  map.set(gapid, existing);
}

function finalizeLayoutEvents(map: Map<string, LayoutEvent[]>): void {
  for (const [gapid, events] of map.entries()) {
    map.set(gapid, [...events].sort(compareLayoutEventsStable));
  }
}

export async function loadLayoutByGap(filePath: string): Promise<Map<string, LayoutEvent[]>> {
  const layoutByGap = new Map<string, LayoutEvent[]>();

  for await (const { value, lineNumber } of readJsonlValues(filePath)) {
    let row: LayoutIRRecord;
    try {
      assertLayoutIRRecord(value);
      row = value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `stitch loaders: ${filePath}:${String(lineNumber)} invalid LayoutIR record (${message})`
      );
    }

    pushLayoutEvent(layoutByGap, row.gapid, row.layout_event);
  }

  finalizeLayoutEvents(layoutByGap);
  return layoutByGap;
}

function assertMetadataPlanDocument(
  value: unknown,
  filePath: string
): asserts value is MetadataPlanDocument {
  if (!isRecord(value)) {
    throw new Error(`stitch loaders: ${filePath} metadata plan must be a JSON object`);
  }
}

function assertCheckpoint(
  value: unknown,
  index: number,
  filePath: string
): asserts value is Checkpoint {
  if (!isRecord(value)) {
    throw new Error(`stitch loaders: ${filePath} checkpoints[${String(index)}] must be an object`);
  }
  const refEnd =
    typeof value.ref_end === "string"
      ? value.ref_end
      : typeof value.ref_key_end === "string"
        ? value.ref_key_end
        : null;
  if (!refEnd) {
    throw new Error(
      `stitch loaders: ${filePath} checkpoints[${String(index)}] requires ref_end or ref_key_end`
    );
  }
  try {
    assertRefKey(refEnd, `${filePath} checkpoints[${String(index)}].ref_end`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`stitch loaders: ${message}`);
  }
}

export async function loadMetadataPlan(filePath: string): Promise<{
  metadataPlan: MetadataPlanDocument;
  checkpointByRefEnd: Map<RefKey, Checkpoint[]>;
}> {
  const text = await fs.promises.readFile(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`stitch loaders: ${filePath} invalid JSON (${message})`);
  }

  assertMetadataPlanDocument(parsed, filePath);
  const metadataPlan = clone(parsed);
  const checkpointByRefEnd = new Map<RefKey, Checkpoint[]>();
  const checkpoints = Array.isArray(metadataPlan.checkpoints) ? metadataPlan.checkpoints : [];

  for (let i = 0; i < checkpoints.length; i += 1) {
    const checkpoint = checkpoints[i];
    assertCheckpoint(checkpoint, i, filePath);
    const refEnd =
      typeof checkpoint.ref_end === "string"
        ? checkpoint.ref_end
        : (checkpoint.ref_key_end as RefKey);
    const existing = checkpointByRefEnd.get(refEnd) ?? [];
    existing.push(clone(checkpoint));
    checkpointByRefEnd.set(refEnd, existing);
  }

  return {
    metadataPlan,
    checkpointByRefEnd
  };
}

export async function loadStitchAnchorIndexes(
  args: LoadStitchAnchorIndexesArgs
): Promise<StitchAnchorIndexes> {
  const [lettersByGid, niqqudByGid, cant, layoutByGap, metadata] = await Promise.all([
    loadLettersByGid(args.lettersIrPath),
    loadNiqqudByGid(args.niqqudIrPath),
    loadCantillationIndexes(args.cantillationIrPath),
    loadLayoutByGap(args.layoutIrPath),
    loadMetadataPlan(args.metadataPlanPath)
  ]);

  return {
    lettersByGid,
    niqqudByGid,
    cantByGid: cant.cantByGid,
    cantByGap: cant.cantByGap,
    layoutByGap,
    metadataPlan: metadata.metadataPlan,
    checkpointByRefEnd: metadata.checkpointByRefEnd
  };
}
