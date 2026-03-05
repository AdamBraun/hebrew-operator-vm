import { compareRefKeysCanonical, formatRefKey, parseRefKey, type RefKey } from "../../ir/refkey";

export const TORAH_1Y_PLAN_DATASET_ID = "torah_1y_plan.v1";
export const TORAH_1Y_PLAN_SCOPE = "torah";
export const TORAH_1Y_PLAN_CYCLE = "one_year";
export const ALIYOT_PER_PARASHA = 7;

export type PlanRange = {
  start: RefKey;
  end: RefKey;
};

export type PlanAliyah = {
  aliyah_index: number;
  range: PlanRange;
};

export type PlanParasha = {
  parasha_id: string;
  parasha_name_he: string;
  parasha_name_en: string;
  range: PlanRange;
  aliyot: PlanAliyah[];
};

export type Torah1YPlanDataset = {
  dataset_id: string;
  scope: string;
  cycle: string;
  notes?: string;
  parashot: PlanParasha[];
};

type UnknownRecord = Record<string, unknown>;

type ParsedAliyah = PlanAliyah & {
  path: string;
};

type ParsedParasha = PlanParasha & {
  path: string;
  aliyotByIndex: Map<number, ParsedAliyah>;
};

const OWN = Object.prototype.hasOwnProperty;

function fail(path: string, message: string): never {
  throw new Error(`metadata plan dataset invalid at ${path}: ${message}`);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return OWN.call(record, key);
}

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

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, `expected string, got ${describe(value)}`);
  }
  return value;
}

function assertNonEmptyString(value: unknown, path: string): string {
  const text = assertString(value, path);
  if (text.length === 0) {
    fail(path, "expected non-empty string");
  }
  return text;
}

function assertInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(path, `expected integer, got ${describe(value)}`);
  }
  return value;
}

function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, `expected array, got ${describe(value)}`);
  }
  return value;
}

function canonicalizeRefKey(value: unknown, path: string): RefKey {
  const text = assertNonEmptyString(value, path);
  try {
    return formatRefKey(parseRefKey(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(path, message);
  }
}

function assertRangeForward(range: PlanRange, path: string): void {
  if (compareRefKeysCanonical(range.start, range.end) > 0) {
    fail(path, `range goes backwards: start '${range.start}' is after end '${range.end}'`);
  }
}

function parseRange(value: unknown, path: string): PlanRange {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["start", "end"], path);

  const start = canonicalizeRefKey(assertHas(value, "start", path), `${path}.start`);
  const end = canonicalizeRefKey(assertHas(value, "end", path), `${path}.end`);
  const range: PlanRange = { start, end };
  assertRangeForward(range, path);
  return range;
}

function parseAliyah(value: unknown, path: string): ParsedAliyah {
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["aliyah_index", "range"], path);

  const aliyahIndex = assertInteger(assertHas(value, "aliyah_index", path), `${path}.aliyah_index`);
  if (aliyahIndex < 1 || aliyahIndex > ALIYOT_PER_PARASHA) {
    fail(`${path}.aliyah_index`, `expected integer in [1..7], got ${String(aliyahIndex)}`);
  }

  return {
    aliyah_index: aliyahIndex,
    range: parseRange(assertHas(value, "range", path), `${path}.range`),
    path
  };
}

function parseAliyot(
  value: unknown,
  path: string
): {
  aliyot: PlanAliyah[];
  aliyotByIndex: Map<number, ParsedAliyah>;
} {
  const items = assertArray(value, path);
  if (items.length !== ALIYOT_PER_PARASHA) {
    fail(path, `expected exactly 7 aliyot, got ${String(items.length)}`);
  }

  const aliyotByIndex = new Map<number, ParsedAliyah>();
  const aliyot: PlanAliyah[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const aliyahPath = `${path}[${String(i)}]`;
    const parsed = parseAliyah(items[i], aliyahPath);
    if (aliyotByIndex.has(parsed.aliyah_index)) {
      fail(`${parsed.path}.aliyah_index`, `duplicate aliyah_index ${String(parsed.aliyah_index)}`);
    }
    aliyotByIndex.set(parsed.aliyah_index, parsed);
    aliyot.push({
      aliyah_index: parsed.aliyah_index,
      range: parsed.range
    });
  }

  for (let expected = 1; expected <= ALIYOT_PER_PARASHA; expected += 1) {
    if (!aliyotByIndex.has(expected)) {
      fail(path, `missing aliyah_index ${String(expected)}`);
    }
  }

  return { aliyot, aliyotByIndex };
}

function rangeContains(outer: PlanRange, inner: PlanRange): boolean {
  return (
    compareRefKeysCanonical(outer.start, inner.start) <= 0 &&
    compareRefKeysCanonical(inner.end, outer.end) <= 0
  );
}

function validateParashaAliyot(parasha: ParsedParasha): void {
  let previous: ParsedAliyah | null = null;

  for (let index = 1; index <= ALIYOT_PER_PARASHA; index += 1) {
    const current = parasha.aliyotByIndex.get(index);
    if (!current) {
      fail(`${parasha.path}.aliyot`, `missing aliyah_index ${String(index)}`);
    }

    if (!rangeContains(parasha.range, current.range)) {
      fail(
        `${current.path}.range`,
        `aliyah range '${current.range.start}'..'${current.range.end}' is outside parasha range ` +
          `'${parasha.range.start}'..'${parasha.range.end}'`
      );
    }

    if (previous && compareRefKeysCanonical(previous.range.end, current.range.start) >= 0) {
      fail(
        `${current.path}.range.start`,
        `range goes backwards or overlaps previous aliyah_index ${String(previous.aliyah_index)} ` +
          `(previous end '${previous.range.end}', current start '${current.range.start}')`
      );
    }

    previous = current;
  }
}

function parseParasha(value: unknown, path: string): ParsedParasha {
  assertRecord(value, path);
  assertNoUnknownKeys(
    value,
    ["parasha_id", "parasha_name_he", "parasha_name_en", "range", "aliyot"],
    path
  );

  const parasha_id = assertNonEmptyString(
    assertHas(value, "parasha_id", path),
    `${path}.parasha_id`
  );
  const parasha_name_he = assertNonEmptyString(
    assertHas(value, "parasha_name_he", path),
    `${path}.parasha_name_he`
  );
  const parasha_name_en = assertNonEmptyString(
    assertHas(value, "parasha_name_en", path),
    `${path}.parasha_name_en`
  );

  const range = parseRange(assertHas(value, "range", path), `${path}.range`);
  const parsedAliyot = parseAliyot(assertHas(value, "aliyot", path), `${path}.aliyot`);

  const parsed: ParsedParasha = {
    path,
    parasha_id,
    parasha_name_he,
    parasha_name_en,
    range,
    aliyot: parsedAliyot.aliyot,
    aliyotByIndex: parsedAliyot.aliyotByIndex
  };
  validateParashaAliyot(parsed);
  return parsed;
}

function validateParashaOrdering(parashot: readonly ParsedParasha[]): void {
  let previous: ParsedParasha | null = null;

  for (const current of parashot) {
    if (!previous) {
      previous = current;
      continue;
    }

    if (compareRefKeysCanonical(previous.range.start, current.range.start) > 0) {
      fail(
        `${current.path}.range.start`,
        `parasha ranges must be in canonical Torah order; current start '${current.range.start}' ` +
          `comes before previous start '${previous.range.start}'`
      );
    }

    if (compareRefKeysCanonical(previous.range.end, current.range.start) >= 0) {
      fail(
        `${current.path}.range.start`,
        `parasha ranges overlap or go backwards; previous end '${previous.range.end}', ` +
          `current start '${current.range.start}'`
      );
    }

    previous = current;
  }
}

export function validatePlanDataset(value: unknown): Torah1YPlanDataset {
  const path = "$";
  assertRecord(value, path);
  assertNoUnknownKeys(value, ["dataset_id", "scope", "cycle", "notes", "parashot"], path);

  const dataset_id = assertNonEmptyString(
    assertHas(value, "dataset_id", path),
    `${path}.dataset_id`
  );
  if (dataset_id !== TORAH_1Y_PLAN_DATASET_ID) {
    fail(
      `${path}.dataset_id`,
      `expected '${TORAH_1Y_PLAN_DATASET_ID}', got ${JSON.stringify(dataset_id)}`
    );
  }

  const scope = assertNonEmptyString(assertHas(value, "scope", path), `${path}.scope`);
  if (scope !== TORAH_1Y_PLAN_SCOPE) {
    fail(`${path}.scope`, `expected '${TORAH_1Y_PLAN_SCOPE}', got ${JSON.stringify(scope)}`);
  }

  const cycle = assertNonEmptyString(assertHas(value, "cycle", path), `${path}.cycle`);
  if (cycle !== TORAH_1Y_PLAN_CYCLE) {
    fail(`${path}.cycle`, `expected '${TORAH_1Y_PLAN_CYCLE}', got ${JSON.stringify(cycle)}`);
  }

  let notes: string | undefined;
  if (hasOwn(value, "notes")) {
    const rawNotes = value.notes;
    if (rawNotes !== undefined) {
      notes = assertString(rawNotes, `${path}.notes`);
    }
  }

  const parashotRaw = assertArray(assertHas(value, "parashot", path), `${path}.parashot`);
  if (parashotRaw.length === 0) {
    fail(`${path}.parashot`, "expected non-empty array");
  }

  const parsedParashot: ParsedParasha[] = [];
  for (let i = 0; i < parashotRaw.length; i += 1) {
    parsedParashot.push(parseParasha(parashotRaw[i], `${path}.parashot[${String(i)}]`));
  }

  validateParashaOrdering(parsedParashot);

  const parashot: PlanParasha[] = parsedParashot.map((parasha) => ({
    parasha_id: parasha.parasha_id,
    parasha_name_he: parasha.parasha_name_he,
    parasha_name_en: parasha.parasha_name_en,
    range: parasha.range,
    aliyot: [...parasha.aliyot]
  }));

  return {
    dataset_id,
    scope,
    cycle,
    ...(notes === undefined ? {} : { notes }),
    parashot
  };
}
