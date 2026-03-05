export type RefKey = string;
export type GraphemeId = string;
export type GapId = string;

export type SpineGraphemeRecord = {
  kind: "g";
  gid: GraphemeId;
  ref_key: RefKey;
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

export type SpineGapRecord = {
  kind: "gap";
  gapid: GapId;
  ref_key: RefKey;
  /**
   * Frozen convention: gap 0 is the leading gap before grapheme 0.
   */
  gap_index: number;
  raw: {
    whitespace: boolean;
    chars: string[];
  };
};

export type SpineRecord = SpineGraphemeRecord | SpineGapRecord;

type UnknownRecord = Record<string, unknown>;

const OWN = Object.prototype.hasOwnProperty;

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

function isGraphemeRecord(value: unknown): value is SpineGraphemeRecord {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "g") {
    return false;
  }
  if (!isNonEmptyString(value.gid) || !isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isNonNegativeInteger(value.g_index)) {
    return false;
  }
  if (!(typeof value.base_letter === "string" || value.base_letter === null)) {
    return false;
  }
  if (!isRecord(value.marks_raw)) {
    return false;
  }
  if (!isStringArray(value.marks_raw.niqqud) || !isStringArray(value.marks_raw.teamim)) {
    return false;
  }
  if (!isRecord(value.raw)) {
    return false;
  }
  return typeof value.raw.text === "string";
}

function isGapRecord(value: unknown): value is SpineGapRecord {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "gap") {
    return false;
  }
  if (!isNonEmptyString(value.gapid) || !isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isNonNegativeInteger(value.gap_index)) {
    return false;
  }
  if (!isRecord(value.raw)) {
    return false;
  }
  if (typeof value.raw.whitespace !== "boolean") {
    return false;
  }
  return isStringArray(value.raw.chars);
}

export function isSpineRecord(x: unknown): x is SpineRecord {
  return isGraphemeRecord(x) || isGapRecord(x);
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid SpineRecord at ${path}: ${message}`);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (!isRecord(value)) {
    fail(path, `expected object, got ${describe(value)}`);
  }
}

function assertNoUnknownKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(path, `unknown field '${key}'`);
    }
  }
}

function assertHas(record: UnknownRecord, key: string, path: string): unknown {
  if (!hasOwn(record, key)) {
    fail(`${path}.${key}`, "missing required field");
  }
  return record[key];
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    fail(path, `expected string, got ${describe(value)}`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  if (value.length === 0) {
    fail(path, "expected non-empty string");
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(path, `expected boolean, got ${describe(value)}`);
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (!isNonNegativeInteger(value)) {
    fail(path, `expected non-negative integer, got ${describe(value)}`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail(path, `expected string[], got ${describe(value)}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      fail(`${path}[${i}]`, `expected string, got ${describe(value[i])}`);
    }
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

function assertSpineGraphemeRecord(
  value: unknown,
  path: string
): asserts value is SpineGraphemeRecord {
  assertRecord(value, path);
  assertNoUnknownKeys(
    value,
    ["kind", "gid", "ref_key", "g_index", "base_letter", "marks_raw", "raw"],
    path
  );
  assertHas(value, "kind", path);
  if (value.kind !== "g") {
    fail(`${path}.kind`, `expected 'g', got ${describe(value.kind)}`);
  }

  const gid = assertHas(value, "gid", path);
  assertNonEmptyString(gid, `${path}.gid`);

  const refKey = assertHas(value, "ref_key", path);
  assertNonEmptyString(refKey, `${path}.ref_key`);

  const gIndex = assertHas(value, "g_index", path);
  assertNonNegativeInteger(gIndex, `${path}.g_index`);

  const baseLetter = assertHas(value, "base_letter", path);
  if (!(typeof baseLetter === "string" || baseLetter === null)) {
    fail(`${path}.base_letter`, `expected string | null, got ${describe(baseLetter)}`);
  }

  const marksRaw = assertHas(value, "marks_raw", path);
  assertRecord(marksRaw, `${path}.marks_raw`);
  assertNoUnknownKeys(marksRaw, ["niqqud", "teamim"], `${path}.marks_raw`);
  assertStringArray(assertHas(marksRaw, "niqqud", `${path}.marks_raw`), `${path}.marks_raw.niqqud`);
  assertStringArray(assertHas(marksRaw, "teamim", `${path}.marks_raw`), `${path}.marks_raw.teamim`);

  const raw = assertHas(value, "raw", path);
  assertRecord(raw, `${path}.raw`);
  assertNoUnknownKeys(raw, ["text"], `${path}.raw`);
  assertString(assertHas(raw, "text", `${path}.raw`), `${path}.raw.text`);
}

function assertSpineGapRecord(value: unknown, path: string): asserts value is SpineGapRecord {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["kind", "gapid", "ref_key", "gap_index", "raw"], path);
  assertHas(value, "kind", path);
  if (value.kind !== "gap") {
    fail(`${path}.kind`, `expected 'gap', got ${describe(value.kind)}`);
  }

  const gapid = assertHas(value, "gapid", path);
  assertNonEmptyString(gapid, `${path}.gapid`);

  const refKey = assertHas(value, "ref_key", path);
  assertNonEmptyString(refKey, `${path}.ref_key`);

  const gapIndex = assertHas(value, "gap_index", path);
  assertNonNegativeInteger(gapIndex, `${path}.gap_index`);

  const raw = assertHas(value, "raw", path);
  assertRecord(raw, `${path}.raw`);
  assertNoUnknownKeys(raw, ["whitespace", "chars"], `${path}.raw`);
  assertBoolean(assertHas(raw, "whitespace", `${path}.raw`), `${path}.raw.whitespace`);
  assertStringArray(assertHas(raw, "chars", `${path}.raw`), `${path}.raw.chars`);
}

export function assertSpineRecord(x: unknown): asserts x is SpineRecord {
  assertRecord(x, "$");
  const kind = assertHas(x, "kind", "$");
  if (kind === "g") {
    assertSpineGraphemeRecord(x, "$");
    return;
  }
  if (kind === "gap") {
    assertSpineGapRecord(x, "$");
    return;
  }
  fail("$.kind", `expected 'g' | 'gap', got ${describe(kind)}`);
}
