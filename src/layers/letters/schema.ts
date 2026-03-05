import fs from "node:fs/promises";
import { type SpineRecord } from "../../spine/schema";

export const LETTERS_IR_VERSION = "1.0.0";

export type LettersIRRecord = {
  kind: "letter_ir";
  gid: string;
  ref_key: string;
  g_index: number;
  letter: string;
  op_kind: string;
  features?: Record<string, unknown>;
  word?: {
    id: string;
    index_in_word: number;
  };
  flags?: {
    ignored?: boolean;
    reason?: string;
  };
  source: {
    spine_digest: string;
  };
};

export type SpineLetterAnchor = {
  gid: string;
  ref_key: string;
  g_index: number;
  letter: string;
};

export const LETTERS_IR_RECORD_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "spec/schemas/letters-ir-record.schema.json",
  title: "LettersIRRecord",
  type: "object",
  additionalProperties: false,
  required: ["kind", "gid", "ref_key", "g_index", "letter", "op_kind", "source"],
  properties: {
    kind: { const: "letter_ir" },
    gid: {
      type: "string",
      minLength: 1,
      pattern: "^.+#g:[0-9]+$"
    },
    ref_key: { type: "string", minLength: 1 },
    g_index: {
      type: "integer",
      minimum: 0
    },
    letter: {
      type: "string",
      pattern: "^[\\u05D0-\\u05EA]$"
    },
    op_kind: {
      type: "string",
      minLength: 1
    },
    features: {
      type: "object",
      additionalProperties: true
    },
    word: {
      type: "object",
      additionalProperties: false,
      required: ["id", "index_in_word"],
      properties: {
        id: {
          type: "string",
          minLength: 1
        },
        index_in_word: {
          type: "integer",
          minimum: 0
        }
      }
    },
    flags: {
      type: "object",
      additionalProperties: false,
      properties: {
        ignored: { type: "boolean" },
        reason: { type: "string", minLength: 1 }
      }
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["spine_digest"],
      properties: {
        spine_digest: {
          type: "string",
          pattern: "^[a-f0-9]{64}$"
        }
      }
    }
  }
} as const;

type UnknownRecord = Record<string, unknown>;

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

const OWN = Object.prototype.hasOwnProperty;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;
const HEBREW_BASE_LETTER = /^[\u05D0-\u05EA]$/u;

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

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function parseGid(value: string): { ref_key: string; g_index: number } | null {
  const match = value.match(GID_PATTERN);
  if (!match) {
    return null;
  }
  const ref_key = match[1] ?? "";
  const parsed = Number(match[2]);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return { ref_key, g_index: parsed };
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

export function isHebrewLetter(value: unknown): value is string {
  return typeof value === "string" && HEBREW_BASE_LETTER.test(value);
}

function isWord(value: unknown): value is LettersIRRecord["word"] {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.id) && isNonNegativeInteger(value.index_in_word);
}

function isFlags(value: unknown): value is LettersIRRecord["flags"] {
  if (!isRecord(value)) {
    return false;
  }
  if (value.ignored !== undefined && typeof value.ignored !== "boolean") {
    return false;
  }
  if (value.reason !== undefined && !isNonEmptyString(value.reason)) {
    return false;
  }
  return true;
}

function isSource(value: unknown): value is LettersIRRecord["source"] {
  return isRecord(value) && isSha256Hex(value.spine_digest);
}

export function isLettersIRRecord(value: unknown): value is LettersIRRecord {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "letter_ir") {
    return false;
  }
  if (!isNonEmptyString(value.gid) || !isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isNonNegativeInteger(value.g_index)) {
    return false;
  }
  if (!isHebrewLetter(value.letter)) {
    return false;
  }
  if (!isNonEmptyString(value.op_kind)) {
    return false;
  }
  if (value.features !== undefined && !isRecord(value.features)) {
    return false;
  }
  if (value.word !== undefined && !isWord(value.word)) {
    return false;
  }
  if (value.flags !== undefined && !isFlags(value.flags)) {
    return false;
  }
  if (!isSource(value.source)) {
    return false;
  }

  const parsed = parseGid(value.gid);
  return parsed !== null && parsed.ref_key === value.ref_key && parsed.g_index === value.g_index;
}

function normalizeRefSegment(
  segment: string
): { kind: "int"; value: number } | { kind: "text"; value: string } {
  if (/^[0-9]+$/.test(segment)) {
    return { kind: "int", value: Number(segment) };
  }
  return { kind: "text", value: segment };
}

const TORAH_BOOK_ORDER: Readonly<Record<string, number>> = {
  Genesis: 0,
  Exodus: 1,
  Leviticus: 2,
  Numbers: 3,
  Deuteronomy: 4
};

function compareTorahBookSegment(left: string, right: string): number | null {
  const leftOrder = TORAH_BOOK_ORDER[left];
  const rightOrder = TORAH_BOOK_ORDER[right];
  if (leftOrder === undefined || rightOrder === undefined) {
    return null;
  }
  if (leftOrder === rightOrder) {
    return 0;
  }
  return leftOrder - rightOrder;
}

export function compareRefKeysStable(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftParts = left.split("/");
  const rightParts = right.split("/");
  const len = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < len; i += 1) {
    const l = leftParts[i];
    const r = rightParts[i];
    if (l === undefined) {
      return -1;
    }
    if (r === undefined) {
      return 1;
    }
    if (l === r) {
      continue;
    }

    if (i === 0) {
      const bookCmp = compareTorahBookSegment(l, r);
      if (bookCmp !== null) {
        if (bookCmp !== 0) {
          return bookCmp;
        }
        continue;
      }
    }

    const ln = normalizeRefSegment(l);
    const rn = normalizeRefSegment(r);

    if (ln.kind === "int" && rn.kind === "int") {
      if (ln.value !== rn.value) {
        return ln.value - rn.value;
      }
      continue;
    }

    if (ln.kind !== rn.kind) {
      return ln.kind === "text" ? -1 : 1;
    }

    return compareText(String(ln.value), String(rn.value));
  }

  return 0;
}

export function compareLettersIRRecords(left: LettersIRRecord, right: LettersIRRecord): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.g_index !== right.g_index) {
    return left.g_index - right.g_index;
  }
  return compareText(left.gid, right.gid);
}

function fail(scope: string, path: string, message: string): never {
  throw new Error(`Invalid ${scope} at ${path}: ${message}`);
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

function assertBoolean(value: unknown, path: string, scope: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(scope, path, `expected boolean, got ${describe(value)}`);
  }
}

function assertWord(
  value: unknown,
  path: string,
  scope: string
): asserts value is LettersIRRecord["word"] {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["id", "index_in_word"], path, scope);
  assertNonEmptyString(assertHas(value, "id", path, scope), `${path}.id`, scope);
  assertNonNegativeInteger(
    assertHas(value, "index_in_word", path, scope),
    `${path}.index_in_word`,
    scope
  );
}

function assertFlags(
  value: unknown,
  path: string,
  scope: string
): asserts value is LettersIRRecord["flags"] {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["ignored", "reason"], path, scope);

  if (hasOwn(value, "ignored") && value.ignored !== undefined) {
    assertBoolean(value.ignored, `${path}.ignored`, scope);
  }
  if (hasOwn(value, "reason") && value.reason !== undefined) {
    assertNonEmptyString(value.reason, `${path}.reason`, scope);
  }
}

function assertSource(
  value: unknown,
  path: string,
  scope: string
): asserts value is LettersIRRecord["source"] {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["spine_digest"], path, scope);
  const digest = assertHas(value, "spine_digest", path, scope);
  assertNonEmptyString(digest, `${path}.spine_digest`, scope);
  if (!isSha256Hex(digest)) {
    fail(scope, `${path}.spine_digest`, "expected lowercase sha256 hex");
  }
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

export function assertLettersIRRecord(
  value: unknown,
  path = "$",
  scope = "LettersIRRecord"
): asserts value is LettersIRRecord {
  assertRecord(value, path, scope);
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
      "source"
    ],
    path,
    scope
  );

  const kind = assertHas(value, "kind", path, scope);
  if (kind !== "letter_ir") {
    fail(scope, `${path}.kind`, `expected 'letter_ir', got ${describe(kind)}`);
  }

  const gid = assertHas(value, "gid", path, scope);
  assertNonEmptyString(gid, `${path}.gid`, scope);
  const parsed = parseGid(gid);
  if (!parsed) {
    fail(scope, `${path}.gid`, `expected '<ref_key>#g:<g_index>', got ${describe(gid)}`);
  }

  const refKey = assertHas(value, "ref_key", path, scope);
  assertNonEmptyString(refKey, `${path}.ref_key`, scope);

  const gIndex = assertHas(value, "g_index", path, scope);
  assertNonNegativeInteger(gIndex, `${path}.g_index`, scope);

  if (parsed.ref_key !== refKey || parsed.g_index !== gIndex) {
    fail(
      scope,
      `${path}.gid`,
      `gid '${gid}' must match ref_key='${refKey}' and g_index=${String(gIndex)}`
    );
  }

  const letter = assertHas(value, "letter", path, scope);
  assertNonEmptyString(letter, `${path}.letter`, scope);
  if (!isHebrewLetter(letter)) {
    fail(
      scope,
      `${path}.letter`,
      `expected normalized Hebrew base letter, got ${describe(letter)}`
    );
  }

  assertNonEmptyString(assertHas(value, "op_kind", path, scope), `${path}.op_kind`, scope);

  if (hasOwn(value, "features") && value.features !== undefined) {
    assertRecord(value.features, `${path}.features`, scope);
  }
  if (hasOwn(value, "word") && value.word !== undefined) {
    assertWord(value.word, `${path}.word`, scope);
  }
  if (hasOwn(value, "flags") && value.flags !== undefined) {
    assertFlags(value.flags, `${path}.flags`, scope);
  }

  assertSource(assertHas(value, "source", path, scope), `${path}.source`, scope);
}

export function assertLettersIRRecords(
  records: readonly LettersIRRecord[],
  path = "$",
  scope = "LettersIRRecords"
): void {
  const seen = new Set<string>();
  let prev: LettersIRRecord | null = null;

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    assertLettersIRRecord(row, `${path}[${i}]`, scope);

    if (seen.has(row.gid)) {
      fail(scope, `${path}[${i}].gid`, `duplicate gid '${row.gid}'`);
    }
    seen.add(row.gid);

    if (prev && compareLettersIRRecords(prev, row) >= 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be in strict spine order by (ref_key order, g_index)"
      );
    }

    prev = row;
  }
}

export function collectSpineLetterAnchors(
  spineRecords: readonly SpineRecord[]
): SpineLetterAnchor[] {
  const out: SpineLetterAnchor[] = [];
  for (const row of spineRecords) {
    if (row.kind !== "g") {
      continue;
    }
    if (!isHebrewLetter(row.base_letter)) {
      continue;
    }
    out.push({
      gid: row.gid,
      ref_key: row.ref_key,
      g_index: row.g_index,
      letter: row.base_letter
    });
  }
  return out;
}

export function assertLettersIRRecordsAgainstSpine(
  records: readonly LettersIRRecord[],
  spineRecords: readonly SpineRecord[],
  path = "$",
  scope = "LettersIRRecords"
): void {
  assertLettersIRRecords(records, path, scope);
  const anchors = collectSpineLetterAnchors(spineRecords);

  if (records.length !== anchors.length) {
    fail(
      scope,
      path,
      `expected ${String(anchors.length)} records (one per letter grapheme), got ${String(records.length)}`
    );
  }

  for (let i = 0; i < anchors.length; i += 1) {
    const row = records[i];
    const anchor = anchors[i];
    if (row.gid !== anchor.gid) {
      fail(
        scope,
        `${path}[${i}].gid`,
        `expected gid '${anchor.gid}' from spine order, got '${row.gid}'`
      );
    }
    if (row.ref_key !== anchor.ref_key) {
      fail(
        scope,
        `${path}[${i}].ref_key`,
        `expected ref_key '${anchor.ref_key}' from spine, got '${row.ref_key}'`
      );
    }
    if (row.g_index !== anchor.g_index) {
      fail(
        scope,
        `${path}[${i}].g_index`,
        `expected g_index ${String(anchor.g_index)} from spine, got ${String(row.g_index)}`
      );
    }
    if (row.letter !== anchor.letter) {
      fail(
        scope,
        `${path}[${i}].letter`,
        `expected letter '${anchor.letter}' from spine, got '${row.letter}'`
      );
    }
  }
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

export function serializeLettersIRRecord(record: LettersIRRecord): string {
  assertLettersIRRecord(record);
  return canonicalStringify(record);
}

export function parseLettersIRJsonl(text: string): LettersIRRecord[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid LettersIRJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: LettersIRRecord[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid LettersIRJsonl at line ${String(i + 1)}: ${message}`);
    }
    assertLettersIRRecord(parsed, `$[${i}]`);
    out.push(parsed);
  }

  assertLettersIRRecords(out);
  return out;
}

export function formatLettersIRJsonl(records: readonly LettersIRRecord[]): string {
  assertLettersIRRecords(records);
  if (records.length === 0) {
    return "";
  }
  return `${records.map((record) => serializeLettersIRRecord(record)).join("\n")}\n`;
}

export async function readLettersIRJsonl(filePath: string): Promise<LettersIRRecord[]> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseLettersIRJsonl(raw);
}

export async function writeLettersIRJsonl(
  filePath: string,
  records: readonly LettersIRRecord[]
): Promise<void> {
  const text = formatLettersIRJsonl(records);
  await fs.writeFile(filePath, text, "utf8");
}
