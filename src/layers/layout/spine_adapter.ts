import fs from "node:fs";
import readline from "node:readline";

export type GapRawFlags = {
  maqaf_char?: boolean;
  sof_pasuk_char?: boolean;
  [key: string]: boolean | undefined;
};

export type GapDescriptor = {
  ref_key: string;
  gap_index: number;
  gapid: string;
  whitespace: boolean;
  raw_flags?: GapRawFlags;
};

export type GapProjectionIndex = {
  gapidByRefAndIndex: Map<string, Map<number, string>>;
  maxGapIndexByRef: Map<string, number>;
};

export type ReadSpineGapAdapterOptions = {
  index?: GapProjectionIndex;
};

type UnknownRecord = Record<string, unknown>;

const GAPID_PATTERN = /^([^#]+)#gap:([0-9]+)$/;
const MAQAF = "\u05BE";
const SOF_PASUQ = "\u05C3";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function fail(sourcePath: string, lineNumber: number, message: string): never {
  throw new Error(`spine_adapter: ${sourcePath}:${String(lineNumber)} ${message}`);
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

function extractRawFlags(raw: UnknownRecord): GapRawFlags | undefined {
  const flags: GapRawFlags = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "whitespace" || key === "chars") {
      continue;
    }
    if (typeof value === "boolean") {
      flags[key] = value;
    }
  }

  const chars = raw.chars;
  if (Array.isArray(chars)) {
    for (const value of chars) {
      if (typeof value !== "string") {
        continue;
      }
      if (value === MAQAF) {
        flags.maqaf_char = true;
      }
      if (value === SOF_PASUQ) {
        flags.sof_pasuk_char = true;
      }
    }
  }

  return Object.keys(flags).length > 0 ? flags : undefined;
}

function parseGapDescriptorFromJsonLine(
  line: string,
  lineNumber: number,
  sourcePath: string
): GapDescriptor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(sourcePath, lineNumber, `invalid JSON (${message})`);
  }

  if (!isRecord(parsed)) {
    fail(sourcePath, lineNumber, "expected JSON object record");
  }

  if (parsed.kind !== "gap") {
    return null;
  }

  const gapid = parsed.gapid;
  const ref_key = parsed.ref_key;
  const gapIndexValue = parsed.gap_index;
  const raw = parsed.raw;

  if (typeof gapid !== "string" || gapid.length === 0) {
    fail(sourcePath, lineNumber, `invalid gapid ${describe(gapid)}`);
  }
  if (typeof ref_key !== "string" || ref_key.length === 0) {
    fail(sourcePath, lineNumber, `invalid ref_key ${describe(ref_key)}`);
  }
  if (typeof gapIndexValue !== "number" || !Number.isInteger(gapIndexValue) || gapIndexValue < 0) {
    fail(sourcePath, lineNumber, `invalid gap_index ${describe(gapIndexValue)}`);
  }
  const gap_index = gapIndexValue;

  if (!isRecord(raw)) {
    fail(sourcePath, lineNumber, `invalid raw field ${describe(raw)}`);
  }
  if (typeof raw.whitespace !== "boolean") {
    fail(sourcePath, lineNumber, `raw.whitespace must be boolean, got ${describe(raw.whitespace)}`);
  }

  const parsedGapId = parseGapId(gapid);
  if (!parsedGapId) {
    fail(sourcePath, lineNumber, `gapid must match '<ref_key>#gap:<gap_index>' (got ${gapid})`);
  }
  if (parsedGapId.ref_key !== ref_key || parsedGapId.gap_index !== gap_index) {
    fail(
      sourcePath,
      lineNumber,
      `gapid '${gapid}' does not match ref_key='${ref_key}' and gap_index=${String(gap_index)}`
    );
  }

  return {
    ref_key,
    gap_index,
    gapid,
    whitespace: raw.whitespace,
    raw_flags: extractRawFlags(raw)
  };
}

function refGapMap(index: GapProjectionIndex, ref_key: string): Map<number, string> {
  const existing = index.gapidByRefAndIndex.get(ref_key);
  if (existing) {
    return existing;
  }
  const created = new Map<number, string>();
  index.gapidByRefAndIndex.set(ref_key, created);
  return created;
}

export function createGapProjectionIndex(): GapProjectionIndex {
  return {
    gapidByRefAndIndex: new Map<string, Map<number, string>>(),
    maxGapIndexByRef: new Map<string, number>()
  };
}

export function applyGapDescriptorToProjection(
  index: GapProjectionIndex,
  gap: GapDescriptor
): void {
  const byGapIndex = refGapMap(index, gap.ref_key);
  const existingGapId = byGapIndex.get(gap.gap_index);
  if (existingGapId !== undefined) {
    throw new Error(
      `spine_adapter: duplicate (ref_key,gap_index)=(${gap.ref_key},${String(gap.gap_index)}) while mapping gapids`
    );
  }
  byGapIndex.set(gap.gap_index, gap.gapid);

  const previousMax = index.maxGapIndexByRef.get(gap.ref_key);
  if (previousMax === undefined || gap.gap_index > previousMax) {
    index.maxGapIndexByRef.set(gap.ref_key, gap.gap_index);
  }
}

export function getGapId(
  index: GapProjectionIndex,
  ref_key: string,
  gap_index: number
): string | undefined {
  return index.gapidByRefAndIndex.get(ref_key)?.get(gap_index);
}

export async function* readSpineGapDescriptorsFromJsonl(
  spineJsonlPath: string,
  options: ReadSpineGapAdapterOptions = {}
): AsyncGenerator<GapDescriptor> {
  const stream = fs.createReadStream(spineJsonlPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const gap = parseGapDescriptorFromJsonLine(line, lineNumber, spineJsonlPath);
      if (!gap) {
        continue;
      }

      if (options.index) {
        applyGapDescriptorToProjection(options.index, gap);
      }

      yield gap;
    }
  } finally {
    lines.close();
    stream.close();
  }
}

export async function projectSpineGapsFromJsonl(
  spineJsonlPath: string
): Promise<GapProjectionIndex> {
  const index = createGapProjectionIndex();
  for await (const _gap of readSpineGapDescriptorsFromJsonl(spineJsonlPath, { index })) {
    // streaming side effects populate index.
  }
  return index;
}
