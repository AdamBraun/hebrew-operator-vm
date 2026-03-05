import fs from "node:fs";
import readline from "node:readline";
import {
  assertSpineRecord,
  type SpineGapRecord,
  type SpineGraphemeRecord,
  type SpineRecord
} from "../../spine/schema";

export type PlannedGrapheme = Pick<
  SpineGraphemeRecord,
  "gid" | "ref_key" | "g_index" | "base_letter"
>;

export type PlannedGap = Pick<SpineGapRecord, "gapid" | "ref_key" | "gap_index" | "raw">;

export type SpineTraversalStep = { kind: "g"; gid: string } | { kind: "gap"; gapid: string };

export type RefPlanIndexRange = {
  startPlanIndex: number;
  endPlanIndex: number;
};

export type SpineTraversalPlan = {
  graphemes: PlannedGrapheme[];
  gaps: PlannedGap[];
  plan: SpineTraversalStep[];
  gidSet: Set<string>;
  gapidSet: Set<string>;
  refIndexByRef: Map<string, RefPlanIndexRange>;
};

function toAsyncIterator<T>(
  source: AsyncIterable<T> | Iterable<T>
): AsyncIterator<T, unknown, undefined> {
  const asyncIterable = source as AsyncIterable<T>;
  if (typeof asyncIterable[Symbol.asyncIterator] === "function") {
    return asyncIterable[Symbol.asyncIterator]();
  }

  const iterator = (source as Iterable<T>)[Symbol.iterator]();
  return {
    next: async () => iterator.next() as IteratorResult<T>
  };
}

function cloneGapRaw(raw: SpineGapRecord["raw"]): SpineGapRecord["raw"] {
  return {
    whitespace: raw.whitespace,
    chars: [...raw.chars]
  };
}

function toPlannedGrapheme(row: SpineGraphemeRecord): PlannedGrapheme {
  return {
    gid: row.gid,
    ref_key: row.ref_key,
    g_index: row.g_index,
    base_letter: row.base_letter
  };
}

function toPlannedGap(row: SpineGapRecord): PlannedGap {
  return {
    gapid: row.gapid,
    ref_key: row.ref_key,
    gap_index: row.gap_index,
    raw: cloneGapRaw(row.raw)
  };
}

function assertUniqueGid(gidSet: Set<string>, gid: string): void {
  if (gidSet.has(gid)) {
    throw new Error(`spine plan: duplicate gid '${gid}'`);
  }
  gidSet.add(gid);
}

function assertUniqueGapid(gapidSet: Set<string>, gapid: string): void {
  if (gapidSet.has(gapid)) {
    throw new Error(`spine plan: duplicate gapid '${gapid}'`);
  }
  gapidSet.add(gapid);
}

function assertStrictGIndexAscending(
  lastGIndexByRef: Map<string, number>,
  refKey: string,
  gIndex: number
): void {
  const previous = lastGIndexByRef.get(refKey);
  if (previous !== undefined && gIndex <= previous) {
    throw new Error(
      `spine plan: ref '${refKey}' must have strictly increasing g_index; saw ${String(gIndex)} after ${String(previous)}`
    );
  }
  lastGIndexByRef.set(refKey, gIndex);
}

function updateRefPlanIndex(
  refIndexByRef: Map<string, RefPlanIndexRange>,
  refKey: string,
  planIndex: number
): void {
  const existing = refIndexByRef.get(refKey);
  if (!existing) {
    refIndexByRef.set(refKey, {
      startPlanIndex: planIndex,
      endPlanIndex: planIndex
    });
    return;
  }

  existing.endPlanIndex = planIndex;
}

export async function buildSpineTraversalPlan(
  records: AsyncIterable<SpineRecord> | Iterable<SpineRecord>
): Promise<SpineTraversalPlan> {
  const graphemes: PlannedGrapheme[] = [];
  const gaps: PlannedGap[] = [];
  const plan: SpineTraversalStep[] = [];
  const gidSet = new Set<string>();
  const gapidSet = new Set<string>();
  const lastGIndexByRef = new Map<string, number>();
  const refIndexByRef = new Map<string, RefPlanIndexRange>();

  const iterator = toAsyncIterator(records);
  for (let cursor = await iterator.next(); !cursor.done; cursor = await iterator.next()) {
    const row = cursor.value;
    assertSpineRecord(row);

    if (row.kind === "g") {
      assertUniqueGid(gidSet, row.gid);
      assertStrictGIndexAscending(lastGIndexByRef, row.ref_key, row.g_index);
      updateRefPlanIndex(refIndexByRef, row.ref_key, plan.length);
      graphemes.push(toPlannedGrapheme(row));
      plan.push({ kind: "g", gid: row.gid });
      continue;
    }

    assertUniqueGapid(gapidSet, row.gapid);
    updateRefPlanIndex(refIndexByRef, row.ref_key, plan.length);
    gaps.push(toPlannedGap(row));
    plan.push({ kind: "gap", gapid: row.gapid });
  }

  return {
    graphemes,
    gaps,
    plan,
    gidSet,
    gapidSet,
    refIndexByRef
  };
}

export async function* readSpineRecordsFromJsonl(
  spineJsonlPath: string
): AsyncGenerator<SpineRecord> {
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

      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `spine plan: ${spineJsonlPath}:${String(lineNumber)} invalid JSONL line (${message})`
        );
      }

      try {
        assertSpineRecord(parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `spine plan: ${spineJsonlPath}:${String(lineNumber)} invalid Spine record (${message})`
        );
      }

      yield parsed;
    }
  } finally {
    lines.close();
    stream.close();
  }
}

export async function readSpineTraversalPlanFromJsonl(
  spineJsonlPath: string
): Promise<SpineTraversalPlan> {
  return buildSpineTraversalPlan(readSpineRecordsFromJsonl(spineJsonlPath));
}
