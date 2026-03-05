import fs from "node:fs";
import readline from "node:readline";
import { createNiqqudWarning, type NiqqudWarning } from "./stats";

export type GraphemeRow = {
  kind: "g";
  gid: string;
  ref_key: string;
  g_index: number;
  base_letter: string | null;
  marks_raw: {
    niqqud: string[];
    teamim: string[];
  };
  raw: {
    text: string;
  };
};

export type GapRow = {
  kind: "gap";
  gapid: string;
  ref_key: string;
  gap_index: number;
  raw: {
    whitespace: boolean;
    chars: string[];
  };
};

export type SpineRow = GraphemeRow | GapRow;

export type NiqqudSpineRow = {
  gid: string;
  ref_key: string;
  g_index: number;
  niqqud: string[];
};

export type ReadNiqqudViewOptions = {
  onWarning?: (warning: NiqqudWarning) => void;
};

type UnknownRecord = Record<string, unknown>;

const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;

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
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
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
  throw new Error(`niqqud spine_view: ${sourcePath}:${String(lineNumber)} ${message}`);
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

function warnInvalidNiqqud(args: {
  sourcePath: string;
  lineNumber: number;
  gid: string;
  ref_key: string;
  g_index: number;
  observed: unknown;
  onWarning?: (warning: NiqqudWarning) => void;
}): void {
  const warning: NiqqudWarning = createNiqqudWarning({
    gid: args.gid,
    ref_key: args.ref_key,
    g_index: args.g_index,
    type: "MALFORMED_MARKS",
    detail: `marks_raw.niqqud invalid at ${args.sourcePath}:${String(args.lineNumber)} observed=${describe(
      args.observed
    )}`
  });
  args.onWarning?.(warning);
  console.warn(warning);
}

function parseGapRow(parsed: UnknownRecord, sourcePath: string, lineNumber: number): GapRow {
  if (!isNonEmptyString(parsed.gapid)) {
    fail(sourcePath, lineNumber, `invalid gapid ${describe(parsed.gapid)}`);
  }
  if (!isNonEmptyString(parsed.ref_key)) {
    fail(sourcePath, lineNumber, `invalid ref_key ${describe(parsed.ref_key)}`);
  }
  if (!isNonNegativeInteger(parsed.gap_index)) {
    fail(sourcePath, lineNumber, `invalid gap_index ${describe(parsed.gap_index)}`);
  }
  if (!isRecord(parsed.raw)) {
    fail(sourcePath, lineNumber, `invalid raw ${describe(parsed.raw)}`);
  }
  if (typeof parsed.raw.whitespace !== "boolean") {
    fail(
      sourcePath,
      lineNumber,
      `raw.whitespace must be boolean, got ${describe(parsed.raw.whitespace)}`
    );
  }
  if (!isStringArray(parsed.raw.chars)) {
    fail(sourcePath, lineNumber, `raw.chars must be string[], got ${describe(parsed.raw.chars)}`);
  }

  return {
    kind: "gap",
    gapid: parsed.gapid,
    ref_key: parsed.ref_key,
    gap_index: parsed.gap_index,
    raw: {
      whitespace: parsed.raw.whitespace,
      chars: parsed.raw.chars
    }
  };
}

function parseGraphemeRow(
  parsed: UnknownRecord,
  sourcePath: string,
  lineNumber: number,
  options: ReadNiqqudViewOptions
): GraphemeRow {
  const gid = parsed.gid;
  const ref_key = parsed.ref_key;
  const g_index = parsed.g_index;

  if (!isNonEmptyString(gid)) {
    fail(sourcePath, lineNumber, `invalid gid ${describe(gid)}`);
  }
  if (!isNonEmptyString(ref_key)) {
    fail(sourcePath, lineNumber, `invalid ref_key ${describe(ref_key)}`);
  }
  if (!isNonNegativeInteger(g_index)) {
    fail(sourcePath, lineNumber, `invalid g_index ${describe(g_index)}`);
  }

  const parsedGid = parseGid(gid);
  if (!parsedGid) {
    fail(sourcePath, lineNumber, `gid must match '<ref_key>#g:<g_index>' (got ${gid})`);
  }
  if (parsedGid.ref_key !== ref_key || parsedGid.g_index !== g_index) {
    fail(
      sourcePath,
      lineNumber,
      `gid '${gid}' must match ref_key='${ref_key}' and g_index=${String(g_index)}`
    );
  }

  const baseLetter = parsed.base_letter;
  if (!(typeof baseLetter === "string" || baseLetter === null)) {
    fail(sourcePath, lineNumber, `invalid base_letter ${describe(baseLetter)}`);
  }

  if (!isRecord(parsed.raw)) {
    fail(sourcePath, lineNumber, `invalid raw ${describe(parsed.raw)}`);
  }
  if (typeof parsed.raw.text !== "string") {
    fail(sourcePath, lineNumber, `raw.text must be string, got ${describe(parsed.raw.text)}`);
  }

  let niqqud: string[] = [];
  let teamim: string[] = [];

  const marksRaw = parsed.marks_raw;
  if (isRecord(marksRaw)) {
    if (isStringArray(marksRaw.niqqud)) {
      niqqud = marksRaw.niqqud;
    } else {
      warnInvalidNiqqud({
        sourcePath,
        lineNumber,
        gid,
        ref_key,
        g_index,
        observed: marksRaw.niqqud,
        onWarning: options.onWarning
      });
    }

    if (isStringArray(marksRaw.teamim)) {
      teamim = marksRaw.teamim;
    }
  } else {
    warnInvalidNiqqud({
      sourcePath,
      lineNumber,
      gid,
      ref_key,
      g_index,
      observed: marksRaw,
      onWarning: options.onWarning
    });
  }

  return {
    kind: "g",
    gid,
    ref_key,
    g_index,
    base_letter: baseLetter,
    marks_raw: { niqqud, teamim },
    raw: { text: parsed.raw.text }
  };
}

function parseSpineRow(
  line: string,
  lineNumber: number,
  sourcePath: string,
  options: ReadNiqqudViewOptions
): SpineRow {
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
  if (parsed.kind === "g") {
    return parseGraphemeRow(parsed, sourcePath, lineNumber, options);
  }
  if (parsed.kind === "gap") {
    return parseGapRow(parsed, sourcePath, lineNumber);
  }

  fail(sourcePath, lineNumber, `unknown kind ${describe(parsed.kind)}`);
}

export async function* readNiqqudView(
  spinePath: string,
  options: ReadNiqqudViewOptions = {}
): AsyncGenerator<NiqqudSpineRow> {
  if (!isNonEmptyString(spinePath)) {
    throw new Error("niqqud spine_view: spinePath must be non-empty string");
  }

  const stream = fs.createReadStream(spinePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const row = parseSpineRow(line, lineNumber, spinePath, options);
      if (row.kind !== "g") {
        continue;
      }

      yield {
        gid: row.gid,
        ref_key: row.ref_key,
        g_index: row.g_index,
        niqqud: row.marks_raw.niqqud
      };
    }
  } finally {
    lines.close();
    stream.close();
  }
}
