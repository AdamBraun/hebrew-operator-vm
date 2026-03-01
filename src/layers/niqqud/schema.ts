import fs from "node:fs/promises";

export const NIQQUD_IR_VERSION = 1;

export type NiqqudFeatureValue = number | boolean | string;

export type NiqqudTierHints = {
  rosh?: boolean;
  toch?: boolean;
  sof?: boolean;
};

export type NiqqudMods = {
  classes: string[];
  features: Record<string, NiqqudFeatureValue>;
  tierHints?: NiqqudTierHints;
};

export type NiqqudFlags = {
  empty: boolean;
  ambiguous: boolean;
  normalized_from?: string[];
};

export type NiqqudIRRow = {
  kind: "niqqud";
  version: typeof NIQQUD_IR_VERSION;
  gid: string;
  ref_key: string;
  g_index: number;
  raw: {
    niqqud: string[];
  };
  mods: NiqqudMods;
  unhandled: string[];
  flags?: NiqqudFlags;
};

export const NIQQUD_IR_ROW_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "spec/schemas/niqqud-ir-row.schema.json",
  title: "NiqqudIRRow",
  type: "object",
  additionalProperties: false,
  required: ["kind", "version", "gid", "ref_key", "g_index", "raw", "mods", "unhandled"],
  properties: {
    kind: { const: "niqqud" },
    version: { type: "integer", const: NIQQUD_IR_VERSION },
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
    raw: {
      type: "object",
      additionalProperties: false,
      required: ["niqqud"],
      properties: {
        niqqud: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    mods: {
      type: "object",
      additionalProperties: false,
      required: ["classes", "features"],
      properties: {
        classes: {
          type: "array",
          items: { type: "string" }
        },
        features: {
          type: "object",
          additionalProperties: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }]
          }
        },
        tierHints: {
          type: "object",
          additionalProperties: false,
          properties: {
            rosh: { type: "boolean" },
            toch: { type: "boolean" },
            sof: { type: "boolean" }
          }
        }
      }
    },
    unhandled: {
      type: "array",
      items: { type: "string" }
    },
    flags: {
      type: "object",
      additionalProperties: false,
      required: ["empty", "ambiguous"],
      properties: {
        empty: { type: "boolean" },
        ambiguous: { type: "boolean" },
        normalized_from: {
          type: "array",
          items: { type: "string" }
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
const GID_PATTERN = /^([^#]+)#g:([0-9]+)$/;

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

function normalizeRefSegment(
  segment: string
): { kind: "int"; value: number } | { kind: "text"; value: string } {
  if (/^[0-9]+$/.test(segment)) {
    return { kind: "int", value: Number(segment) };
  }
  return { kind: "text", value: segment };
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

export function compareNiqqudIRRows(left: NiqqudIRRow, right: NiqqudIRRow): number {
  const refCmp = compareRefKeysStable(left.ref_key, right.ref_key);
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.g_index !== right.g_index) {
    return left.g_index - right.g_index;
  }
  return compareText(left.gid, right.gid);
}

function isFeatureValue(value: unknown): value is NiqqudFeatureValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isTierHints(value: unknown): value is NiqqudTierHints {
  if (!isRecord(value)) {
    return false;
  }
  if (value.rosh !== undefined && typeof value.rosh !== "boolean") {
    return false;
  }
  if (value.toch !== undefined && typeof value.toch !== "boolean") {
    return false;
  }
  if (value.sof !== undefined && typeof value.sof !== "boolean") {
    return false;
  }
  return true;
}

function isNiqqudMods(value: unknown): value is NiqqudMods {
  if (!isRecord(value)) {
    return false;
  }
  if (!isStringArray(value.classes)) {
    return false;
  }
  if (!isRecord(value.features)) {
    return false;
  }
  for (const featureValue of Object.values(value.features)) {
    if (!isFeatureValue(featureValue)) {
      return false;
    }
  }
  if (value.tierHints !== undefined && !isTierHints(value.tierHints)) {
    return false;
  }
  return true;
}

function isNiqqudFlags(value: unknown): value is NiqqudFlags {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.empty !== "boolean" || typeof value.ambiguous !== "boolean") {
    return false;
  }
  if (value.normalized_from !== undefined && !isStringArray(value.normalized_from)) {
    return false;
  }
  return true;
}

export function isNiqqudIRRow(value: unknown): value is NiqqudIRRow {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== "niqqud") {
    return false;
  }
  if (value.version !== NIQQUD_IR_VERSION) {
    return false;
  }
  if (!isNonEmptyString(value.gid) || !isNonEmptyString(value.ref_key)) {
    return false;
  }
  if (!isNonNegativeInteger(value.g_index)) {
    return false;
  }
  const parsedGid = parseGid(value.gid);
  if (!parsedGid || parsedGid.ref_key !== value.ref_key || parsedGid.g_index !== value.g_index) {
    return false;
  }
  if (!isRecord(value.raw) || !isStringArray(value.raw.niqqud)) {
    return false;
  }
  if (!isNiqqudMods(value.mods)) {
    return false;
  }
  if (!isStringArray(value.unhandled)) {
    return false;
  }
  if (value.flags !== undefined && !isNiqqudFlags(value.flags)) {
    return false;
  }
  return true;
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

function assertString(value: unknown, path: string, scope: string): asserts value is string {
  if (typeof value !== "string") {
    fail(scope, path, `expected string, got ${describe(value)}`);
  }
}

function assertNonEmptyString(
  value: unknown,
  path: string,
  scope: string
): asserts value is string {
  assertString(value, path, scope);
  if (value.length === 0) {
    fail(scope, path, "expected non-empty string");
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

function assertStringArray(value: unknown, path: string, scope: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    fail(scope, path, `expected string[], got ${describe(value)}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      fail(scope, `${path}[${i}]`, `expected string, got ${describe(value[i])}`);
    }
  }
}

function assertFeatureValue(
  value: unknown,
  path: string,
  scope: string
): asserts value is NiqqudFeatureValue {
  if (!isFeatureValue(value)) {
    fail(scope, path, `expected string|number|boolean, got ${describe(value)}`);
  }
}

function assertNiqqudTierHints(
  value: unknown,
  path: string,
  scope: string
): asserts value is NiqqudTierHints {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["rosh", "toch", "sof"], path, scope);
  if (hasOwn(value, "rosh") && value.rosh !== undefined && typeof value.rosh !== "boolean") {
    fail(scope, `${path}.rosh`, `expected boolean, got ${describe(value.rosh)}`);
  }
  if (hasOwn(value, "toch") && value.toch !== undefined && typeof value.toch !== "boolean") {
    fail(scope, `${path}.toch`, `expected boolean, got ${describe(value.toch)}`);
  }
  if (hasOwn(value, "sof") && value.sof !== undefined && typeof value.sof !== "boolean") {
    fail(scope, `${path}.sof`, `expected boolean, got ${describe(value.sof)}`);
  }
}

function assertNiqqudMods(
  value: unknown,
  path: string,
  scope: string
): asserts value is NiqqudMods {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["classes", "features", "tierHints"], path, scope);
  assertStringArray(assertHas(value, "classes", path, scope), `${path}.classes`, scope);

  const features = assertHas(value, "features", path, scope);
  assertRecord(features, `${path}.features`, scope);
  for (const [key, featureValue] of Object.entries(features)) {
    assertFeatureValue(featureValue, `${path}.features.${key}`, scope);
  }

  if (hasOwn(value, "tierHints") && value.tierHints !== undefined) {
    assertNiqqudTierHints(value.tierHints, `${path}.tierHints`, scope);
  }
}

function assertNiqqudFlags(
  value: unknown,
  path: string,
  scope: string
): asserts value is NiqqudFlags {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(value, ["empty", "ambiguous", "normalized_from"], path, scope);
  if (typeof assertHas(value, "empty", path, scope) !== "boolean") {
    fail(scope, `${path}.empty`, `expected boolean, got ${describe(value.empty)}`);
  }
  if (typeof assertHas(value, "ambiguous", path, scope) !== "boolean") {
    fail(scope, `${path}.ambiguous`, `expected boolean, got ${describe(value.ambiguous)}`);
  }
  if (hasOwn(value, "normalized_from") && value.normalized_from !== undefined) {
    assertStringArray(value.normalized_from, `${path}.normalized_from`, scope);
  }
}

export function assertNiqqudIRRow(
  value: unknown,
  path = "$",
  scope = "NiqqudIRRow"
): asserts value is NiqqudIRRow {
  assertRecord(value, path, scope);
  assertNoUnknownKeys(
    value,
    ["kind", "version", "gid", "ref_key", "g_index", "raw", "mods", "unhandled", "flags"],
    path,
    scope
  );

  const kind = assertHas(value, "kind", path, scope);
  if (kind !== "niqqud") {
    fail(scope, `${path}.kind`, `expected 'niqqud', got ${describe(kind)}`);
  }

  const version = assertHas(value, "version", path, scope);
  if (version !== NIQQUD_IR_VERSION) {
    fail(
      scope,
      `${path}.version`,
      `expected ${String(NIQQUD_IR_VERSION)}, got ${describe(version)}`
    );
  }

  const gid = assertHas(value, "gid", path, scope);
  assertNonEmptyString(gid, `${path}.gid`, scope);

  const refKey = assertHas(value, "ref_key", path, scope);
  assertNonEmptyString(refKey, `${path}.ref_key`, scope);

  const gIndex = assertHas(value, "g_index", path, scope);
  assertNonNegativeInteger(gIndex, `${path}.g_index`, scope);

  const parsedGid = parseGid(gid);
  if (!parsedGid) {
    fail(scope, `${path}.gid`, `expected '<ref_key>#g:<g_index>', got ${describe(gid)}`);
  }
  if (parsedGid.ref_key !== refKey || parsedGid.g_index !== gIndex) {
    fail(
      scope,
      `${path}.gid`,
      `gid '${gid}' must match ref_key='${refKey}' and g_index=${String(gIndex)}`
    );
  }

  const raw = assertHas(value, "raw", path, scope);
  assertRecord(raw, `${path}.raw`, scope);
  assertNoUnknownKeys(raw, ["niqqud"], `${path}.raw`, scope);
  assertStringArray(assertHas(raw, "niqqud", `${path}.raw`, scope), `${path}.raw.niqqud`, scope);

  assertNiqqudMods(assertHas(value, "mods", path, scope), `${path}.mods`, scope);
  assertStringArray(assertHas(value, "unhandled", path, scope), `${path}.unhandled`, scope);

  if (hasOwn(value, "flags") && value.flags !== undefined) {
    assertNiqqudFlags(value.flags, `${path}.flags`, scope);
  }
}

export function assertNiqqudIRRows(
  rows: readonly NiqqudIRRow[],
  path = "$",
  scope = "NiqqudIRRows"
): void {
  const seenGids = new Set<string>();
  let prev: NiqqudIRRow | null = null;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    assertNiqqudIRRow(row, `${path}[${i}]`, scope);

    if (seenGids.has(row.gid)) {
      fail(scope, `${path}[${i}].gid`, `duplicate gid '${row.gid}'`);
    }
    seenGids.add(row.gid);

    if (prev && compareNiqqudIRRows(prev, row) > 0) {
      fail(
        scope,
        `${path}[${i}]`,
        "records must be in deterministic ascending order by (ref_key order, g_index)"
      );
    }
    prev = row;
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

export function serializeNiqqudIRRow(row: NiqqudIRRow): string {
  assertNiqqudIRRow(row);
  return canonicalStringify(row);
}

export function parseNiqqudIRJsonl(text: string): NiqqudIRRow[] {
  if (typeof text !== "string") {
    throw new Error(`Invalid NiqqudIRJsonl: expected string, got ${typeof text}`);
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: NiqqudIRRow[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid NiqqudIRJsonl at line ${String(i + 1)}: ${message}`);
    }

    assertNiqqudIRRow(parsed, `$[${i}]`);
    out.push(parsed);
  }

  assertNiqqudIRRows(out);
  return out;
}

export function formatNiqqudIRJsonl(rows: readonly NiqqudIRRow[]): string {
  const normalized = [...rows].sort(compareNiqqudIRRows);
  assertNiqqudIRRows(normalized);
  if (normalized.length === 0) {
    return "";
  }
  return `${normalized.map((row) => serializeNiqqudIRRow(row)).join("\n")}\n`;
}

export async function readNiqqudIRJsonl(filePath: string): Promise<NiqqudIRRow[]> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseNiqqudIRJsonl(raw);
}

export async function writeNiqqudIRJsonl(
  filePath: string,
  rows: readonly NiqqudIRRow[]
): Promise<void> {
  const text = formatNiqqudIRJsonl(rows);
  await fs.writeFile(filePath, text, "utf8");
}
