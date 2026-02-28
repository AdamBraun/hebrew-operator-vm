import fs from "node:fs";
import path from "node:path";

export type CarryIds = {
  omega: string | null;
  focus: string | null;
  domain: string | null;
  pinned: string[];
  pinnedCount: number;
};

export type StateSize = {
  handles: number;
  links: number;
  boundaries: number;
  rules: number;
  cont: number;
  aliasEdges: number;
};

export type VerseRow = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  carryIn: CarryIds;
  carryOut: CarryIds;
  stateSize: StateSize;
  cleanup: {
    keptCount: number | null;
    droppedCount: number | null;
  };
  runtimeError: string | null;
};

export type SummaryContinuity = {
  expectedTransitions: number;
  omegaMatches: number;
  focusMatches: number;
  domainMatches: number;
  mismatches: {
    omega: string[];
    focus: string[];
    domain: string[];
  };
};

export type SummarySanity = {
  handleCounts: number[];
  nonIncreasingHandleCount: boolean;
};

export type Summary = {
  mode: string;
  from: string;
  to: string;
  input: string;
  outDir: string;
  versesSelected: number;
  runtimeErrors: number;
  continuity: SummaryContinuity;
  sanity: SummarySanity;
  verses: VerseRow[];
};

export type VerseRefParts = {
  book: string;
  chapter: number;
  verse: number;
};

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected object at '${field}'`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`expected string at '${field}'`);
  }
  return value;
}

function normalizeStringOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = asString(value, field).trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`expected number at '${field}'`);
  }
  return parsed;
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asNumber(value, field);
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`expected boolean at '${field}'`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`expected string[] at '${field}'`);
  }
  return value.map((entry, index) => asString(entry, `${field}[${index}]`));
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function normalizePinned(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const id = normalizeStringOrNull(entry, field);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out.sort(compareText);
}

function parseCarryIds(value: unknown, field: string): CarryIds {
  const row = asObject(value, field);
  const pinned = normalizePinned(row.pinned, `${field}.pinned`);
  return {
    omega: normalizeStringOrNull(row.omega, `${field}.omega`),
    focus: normalizeStringOrNull(row.focus, `${field}.focus`),
    domain: normalizeStringOrNull(row.domain, `${field}.domain`),
    pinned,
    pinnedCount: asNumber(row.pinnedCount ?? pinned.length, `${field}.pinnedCount`)
  };
}

function parseStateSize(value: unknown, field: string): StateSize {
  const row = asObject(value, field);
  return {
    handles: asNumber(row.handles, `${field}.handles`),
    links: asNumber(row.links, `${field}.links`),
    boundaries: asNumber(row.boundaries, `${field}.boundaries`),
    rules: asNumber(row.rules, `${field}.rules`),
    cont: asNumber(row.cont, `${field}.cont`),
    aliasEdges: asNumber(row.aliasEdges, `${field}.aliasEdges`)
  };
}

function parseVerseRow(value: unknown, index: number): VerseRow {
  const field = `verses[${index}]`;
  const row = asObject(value, field);
  const cleanup = asObject(row.cleanup, `${field}.cleanup`);

  return {
    sequence: asNumber(row.sequence ?? index + 1, `${field}.sequence`),
    ref_key: asString(row.ref_key, `${field}.ref_key`),
    outputPath: asString(row.outputPath, `${field}.outputPath`),
    carryIn: parseCarryIds(row.carryIn ?? {}, `${field}.carryIn`),
    carryOut: parseCarryIds(row.carryOut ?? {}, `${field}.carryOut`),
    stateSize: parseStateSize(row.stateSize ?? {}, `${field}.stateSize`),
    cleanup: {
      keptCount: asNullableNumber(cleanup.keptCount, `${field}.cleanup.keptCount`),
      droppedCount: asNullableNumber(cleanup.droppedCount, `${field}.cleanup.droppedCount`)
    },
    runtimeError: normalizeStringOrNull(row.runtimeError, `${field}.runtimeError`)
  };
}

function parseSummaryContinuity(value: unknown): SummaryContinuity {
  const row = asObject(value, "continuity");
  const mismatches = asObject(row.mismatches, "continuity.mismatches");
  return {
    expectedTransitions: asNumber(row.expectedTransitions ?? 0, "continuity.expectedTransitions"),
    omegaMatches: asNumber(row.omegaMatches ?? 0, "continuity.omegaMatches"),
    focusMatches: asNumber(row.focusMatches ?? 0, "continuity.focusMatches"),
    domainMatches: asNumber(row.domainMatches ?? 0, "continuity.domainMatches"),
    mismatches: {
      omega: asStringArray(mismatches.omega ?? [], "continuity.mismatches.omega"),
      focus: asStringArray(mismatches.focus ?? [], "continuity.mismatches.focus"),
      domain: asStringArray(mismatches.domain ?? [], "continuity.mismatches.domain")
    }
  };
}

function parseSummarySanity(value: unknown): SummarySanity {
  const row = asObject(value, "sanity");
  const handleCounts = Array.isArray(row.handleCounts)
    ? row.handleCounts.map((entry, index) => asNumber(entry, `sanity.handleCounts[${index}]`))
    : [];
  return {
    handleCounts,
    nonIncreasingHandleCount: asBoolean(
      row.nonIncreasingHandleCount ?? false,
      "sanity.nonIncreasingHandleCount"
    )
  };
}

function parseSummaryObject(value: unknown): Summary {
  const root = asObject(value, "summary");
  if (!Array.isArray(root.verses)) {
    throw new Error("expected array at 'verses'");
  }
  const verses = root.verses
    .map((row, index) => parseVerseRow(row, index))
    .sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return compareText(left.ref_key, right.ref_key);
    });

  return {
    mode: asString(root.mode, "mode"),
    from: asString(root.from, "from"),
    to: asString(root.to, "to"),
    input: asString(root.input, "input"),
    outDir: asString(root.outDir, "outDir"),
    versesSelected: asNumber(root.versesSelected ?? verses.length, "versesSelected"),
    runtimeErrors: asNumber(root.runtimeErrors ?? 0, "runtimeErrors"),
    continuity: parseSummaryContinuity(root.continuity ?? {}),
    sanity: parseSummarySanity(root.sanity ?? {}),
    verses
  };
}

export function parseRefKey(refKey: string): VerseRefParts {
  const parts = String(refKey ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < 3) {
    throw new Error(`Invalid ref_key '${refKey}': expected Book/Chapter/Verse.`);
  }

  const verseRaw = parts.pop() ?? "";
  const chapterRaw = parts.pop() ?? "";
  const book = parts.join("/");
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);

  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
    throw new Error(`Invalid ref_key '${refKey}': expected Book/Chapter/Verse.`);
  }

  return {
    book,
    chapter,
    verse
  };
}

export function loadSummary(filePath: string): Summary {
  const resolved = path.resolve(filePath);
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing summary file: ${resolved}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read summary file ${resolved}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid summary JSON at ${resolved}: ${message}`);
  }

  try {
    return parseSummaryObject(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid summary.json at ${resolved}: ${message}`);
  }
}
