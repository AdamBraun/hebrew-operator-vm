import fs from "node:fs/promises";
import path from "node:path";
import { createInitialState, type State } from "../../state/state";
import {
  DEFAULT_VERSE_BOUNDARY_MODE,
  SUPPORTED_VERSE_BOUNDARY_MODES,
  onVerseEndDetailed,
  onVerseStart,
  type CarryState,
  type VerseBoundaryMode
} from "../../runtime/carryState";
import { runProgramWithTrace, type TraceEntry } from "../../vm/vm";
import { collectExecutableVerses } from "../torahCorpus/runtimePart1";
import { workspaceRelativePath } from "../torahCorpus/report";

type LangOption = "he" | "en" | "both";

type VerseRef = {
  book: string;
  chapter: number;
  verse: number;
};

type ExecutableVerse = {
  ref: VerseRef;
  ref_key: string;
  words: string[];
};

type OptionValue = {
  value: string;
  nextIndex: number;
};

export type RunVerseRangeOptions = {
  input: string;
  outDir: string;
  from: string;
  to: string;
  mode: VerseBoundaryMode;
  lang: LangOption;
  normalizeFinals: boolean;
  keepTeamim: boolean;
  allowRuntimeErrors: boolean;
};

export type CarryIdSummary = {
  omega: string | null;
  focus: string | null;
  domain: string | null;
  pinned: string[];
  pinnedCount: number;
};

export type StateSizeSummary = {
  handles: number;
  links: number;
  boundaries: number;
  rules: number;
  cont: number;
  aliasEdges: number;
};

export type VerseRangeSummaryRow = {
  sequence: number;
  ref_key: string;
  outputPath: string;
  carryIn: CarryIdSummary;
  carryOut: CarryIdSummary;
  stateSize: StateSizeSummary;
  cleanup: {
    keptCount: number | null;
    droppedCount: number | null;
  };
  runtimeError: string | null;
};

export type VerseRangeSummary = {
  mode: VerseBoundaryMode;
  from: string;
  to: string;
  input: string;
  outDir: string;
  versesSelected: number;
  runtimeErrors: number;
  continuity: {
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
  sanity: {
    handleCounts: number[];
    nonIncreasingHandleCount: boolean;
  };
  verses: VerseRangeSummaryRow[];
};

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "outputs", "continual-run");
const NULL_REF = null;

function readOptionValue(argv: string[], index: number, optionName: string): OptionValue | null {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return { value: argv[index + 1], nextIndex: index + 1 };
  }
  return null;
}

function parseVerseBoundaryMode(rawMode: string): VerseBoundaryMode {
  const normalized = String(rawMode ?? "")
    .trim()
    .toLowerCase();
  if ((SUPPORTED_VERSE_BOUNDARY_MODES as readonly string[]).includes(normalized)) {
    return normalized as VerseBoundaryMode;
  }
  throw new Error(
    `Invalid --mode value: ${rawMode}. Expected one of: ${SUPPORTED_VERSE_BOUNDARY_MODES.join(", ")}`
  );
}

function parseVerseRef(rawRef: string): VerseRef {
  const trimmed = String(rawRef ?? "").trim();
  const match = trimmed.match(/^(.+)\/(\d+)\/(\d+)$/u);
  if (!match) {
    throw new Error(`Invalid verse ref '${rawRef}'. Expected format Book/Chapter/Verse.`);
  }
  const book = String(match[1] ?? "").trim();
  const chapter = Number(match[2] ?? "");
  const verse = Number(match[3] ?? "");
  if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    throw new Error(`Invalid verse ref '${rawRef}'. Expected format Book/Chapter/Verse.`);
  }
  return { book, chapter, verse };
}

function verseRefKey(ref: VerseRef): string {
  return `${ref.book}/${ref.chapter}/${ref.verse}`;
}

function normalizeHandleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return NULL_REF;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : NULL_REF;
}

function normalizePinnedHandleIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const handleId = normalizeHandleId(item);
    if (!handleId || seen.has(handleId)) {
      continue;
    }
    seen.add(handleId);
    out.push(handleId);
  }
  return out;
}

function projectCarryStateForMode(mode: VerseBoundaryMode, carryState: CarryState): CarryState {
  const projected: CarryState = {
    omegaHandleId: carryState.omegaHandleId,
    pinnedHandleIds: carryState.pinnedHandleIds
  };
  if (mode === "carry_omega_focus" || mode === "carry_omega_focus_domain") {
    projected.focusHandleId = carryState.focusHandleId;
  }
  if (mode === "carry_omega_focus_domain") {
    projected.domainHandleId = carryState.domainHandleId;
  }
  return projected;
}

function summarizeCarry(carry: CarryState): CarryIdSummary {
  const pinned = normalizePinnedHandleIds(carry.pinnedHandleIds);
  return {
    omega: normalizeHandleId(carry.omegaHandleId),
    focus: normalizeHandleId(carry.focusHandleId),
    domain: normalizeHandleId(carry.domainHandleId),
    pinned,
    pinnedCount: pinned.length
  };
}

function collectStateSize(state: State): StateSizeSummary {
  return {
    handles: state.handles.size,
    links: state.links.length,
    boundaries: state.boundaries.length,
    rules: state.rules.length,
    cont: state.cont.size,
    aliasEdges: state.vm.aliasEdges.length
  };
}

function sanitizeRefForFilename(ref: string): string {
  return String(ref ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isRuntimeError(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "name" in value && (value as { name?: unknown }).name === "RuntimeError";
}

function readModeLabel(mode: VerseBoundaryMode): string {
  return mode;
}

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/run-verse-range.mjs --from=Book/Chapter/Verse --to=Book/Chapter/Verse [--mode=reset|carry_omega|carry_omega_focus|carry_omega_focus_domain]"
  );
  console.log(
    "  node scripts/run-verse-range.mjs [--input=path] [--out-dir=path] [--lang=he|en|both]"
  );
  console.log(
    "  node scripts/run-verse-range.mjs [--normalize-finals] [--keep-teamim|--strip-teamim] [--allow-runtime-errors]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --out-dir=${DEFAULT_OUT_DIR}`);
  console.log(`  --mode=${DEFAULT_VERSE_BOUNDARY_MODE}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=false");
  console.log("  keep-teamim=false");
  console.log("  allow-runtime-errors=false");
}

export function parseArgs(argv: string[]): RunVerseRangeOptions {
  const opts: RunVerseRangeOptions = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    from: "",
    to: "",
    mode: DEFAULT_VERSE_BOUNDARY_MODE,
    lang: "he",
    normalizeFinals: false,
    keepTeamim: false,
    allowRuntimeErrors: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const inputOpt = readOptionValue(argv, index, "--input");
    if (inputOpt) {
      opts.input = inputOpt.value;
      index = inputOpt.nextIndex;
      continue;
    }
    const outDirOpt = readOptionValue(argv, index, "--out-dir");
    if (outDirOpt) {
      opts.outDir = outDirOpt.value;
      index = outDirOpt.nextIndex;
      continue;
    }
    const fromOpt = readOptionValue(argv, index, "--from");
    if (fromOpt) {
      opts.from = fromOpt.value;
      index = fromOpt.nextIndex;
      continue;
    }
    const toOpt = readOptionValue(argv, index, "--to");
    if (toOpt) {
      opts.to = toOpt.value;
      index = toOpt.nextIndex;
      continue;
    }
    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.mode = parseVerseBoundaryMode(modeOpt.value);
      index = modeOpt.nextIndex;
      continue;
    }
    const boundaryModeOpt = readOptionValue(argv, index, "--verse-boundary-mode");
    if (boundaryModeOpt) {
      opts.mode = parseVerseBoundaryMode(boundaryModeOpt.value);
      index = boundaryModeOpt.nextIndex;
      continue;
    }
    const langOpt = readOptionValue(argv, index, "--lang");
    if (langOpt) {
      const lang = langOpt.value as LangOption;
      if (lang !== "he" && lang !== "en" && lang !== "both") {
        throw new Error(`Invalid --lang value: ${langOpt.value}`);
      }
      opts.lang = lang;
      index = langOpt.nextIndex;
      continue;
    }
    if (arg === "--normalize-finals") {
      opts.normalizeFinals = true;
      continue;
    }
    if (arg === "--no-normalize-finals") {
      opts.normalizeFinals = false;
      continue;
    }
    if (arg === "--keep-teamim") {
      opts.keepTeamim = true;
      continue;
    }
    if (arg === "--strip-teamim") {
      opts.keepTeamim = false;
      continue;
    }
    if (arg === "--allow-runtime-errors") {
      opts.allowRuntimeErrors = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!opts.from) {
    throw new Error("Missing required --from value.");
  }
  if (!opts.to) {
    throw new Error("Missing required --to value.");
  }
  parseVerseRef(opts.from);
  parseVerseRef(opts.to);

  return opts;
}

function resolveSelectedVerses(
  verses: ExecutableVerse[],
  fromRefKey: string,
  toRefKey: string
): ExecutableVerse[] {
  const fromIndex = verses.findIndex((verse) => verse.ref_key === fromRefKey);
  if (fromIndex < 0) {
    throw new Error(`Unable to locate --from verse in input corpus: ${fromRefKey}`);
  }
  const toIndex = verses.findIndex((verse) => verse.ref_key === toRefKey);
  if (toIndex < 0) {
    throw new Error(`Unable to locate --to verse in input corpus: ${toRefKey}`);
  }
  if (fromIndex > toIndex) {
    throw new Error(
      `Verse range is out of order: --from ${fromRefKey} occurs after --to ${toRefKey} in corpus ordering`
    );
  }
  return verses.slice(fromIndex, toIndex + 1);
}

function buildVerseOutputPayload(args: {
  sequence: number;
  verse: ExecutableVerse;
  mode: VerseBoundaryMode;
  words: string[];
  trace: TraceEntry[];
  carryIn: CarryIdSummary;
  carryOut: CarryIdSummary;
  stateSize: StateSizeSummary;
  cleanup: { keptCount: number | null; droppedCount: number | null };
  verseBoundary: unknown;
  runtimeError: string | null;
}): Record<string, unknown> {
  return {
    sequence: args.sequence,
    mode: args.mode,
    ref: args.verse.ref,
    ref_key: args.verse.ref_key,
    verse_text: args.words.join(" "),
    words: args.words,
    runtimeError: args.runtimeError,
    carryIn: args.carryIn,
    carryOut: args.carryOut,
    cleanup: args.cleanup,
    stateSize: args.stateSize,
    verseBoundary: args.verseBoundary,
    trace: args.trace
  };
}

export async function runVerseRange(opts: RunVerseRangeOptions): Promise<VerseRangeSummary> {
  const inputPath = path.resolve(opts.input);
  const outDir = path.resolve(opts.outDir);
  const versesDir = path.join(outDir, "verses");

  const raw = await fs.readFile(inputPath, "utf8");
  const payload = JSON.parse(raw);
  const collected = collectExecutableVerses(payload, opts) as {
    verses: ExecutableVerse[];
  };

  const fromRef = parseVerseRef(opts.from);
  const toRef = parseVerseRef(opts.to);
  const fromRefKey = verseRefKey(fromRef);
  const toRefKey = verseRefKey(toRef);
  const selectedVerses = resolveSelectedVerses(collected.verses, fromRefKey, toRefKey);

  let carryState: CarryState = {};
  const summaryRows: VerseRangeSummaryRow[] = [];
  const handleCounts: number[] = [];
  const continuityMismatches = {
    omega: [] as string[],
    focus: [] as string[],
    domain: [] as string[]
  };
  let omegaMatches = 0;
  let focusMatches = 0;
  let domainMatches = 0;
  let runtimeErrors = 0;
  let previousCarryOut: CarryIdSummary | null = null;

  await fs.mkdir(versesDir, { recursive: true });

  for (let index = 0; index < selectedVerses.length; index += 1) {
    const verse = selectedVerses[index];
    const sequence = index + 1;
    const carryInProjected = projectCarryStateForMode(opts.mode, carryState);
    const carryIn = summarizeCarry(carryInProjected);
    const state = createInitialState();

    onVerseStart(verse.ref_key, state, opts.mode, carryState);

    const verseText = verse.words.join(" ");
    let trace: TraceEntry[] = [];
    let runtimeError: string | null = null;
    try {
      trace = runProgramWithTrace(verseText, state).trace;
    } catch (error) {
      if (!opts.allowRuntimeErrors || !isRuntimeError(error)) {
        throw error;
      }
      runtimeErrors += 1;
      runtimeError = String((error as { message?: unknown })?.message ?? "RuntimeError");
    }

    const verseEnd = onVerseEndDetailed(verse.ref_key, state, opts.mode);
    carryState = verseEnd.carryState;
    const carryOutProjected = projectCarryStateForMode(opts.mode, carryState);
    const carryOut = summarizeCarry(carryOutProjected);
    const stateSize = collectStateSize(state);
    handleCounts.push(stateSize.handles);

    if (previousCarryOut) {
      if (carryIn.omega === previousCarryOut.omega) {
        omegaMatches += 1;
      } else {
        continuityMismatches.omega.push(
          `${selectedVerses[index - 1].ref_key} -> ${verse.ref_key}: expected ${String(
            previousCarryOut.omega
          )}, got ${String(carryIn.omega)}`
        );
      }
      if (carryIn.focus === previousCarryOut.focus) {
        focusMatches += 1;
      } else {
        continuityMismatches.focus.push(
          `${selectedVerses[index - 1].ref_key} -> ${verse.ref_key}: expected ${String(
            previousCarryOut.focus
          )}, got ${String(carryIn.focus)}`
        );
      }
      if (carryIn.domain === previousCarryOut.domain) {
        domainMatches += 1;
      } else {
        continuityMismatches.domain.push(
          `${selectedVerses[index - 1].ref_key} -> ${verse.ref_key}: expected ${String(
            previousCarryOut.domain
          )}, got ${String(carryIn.domain)}`
        );
      }
    }
    previousCarryOut = carryOut;

    const safeRef = sanitizeRefForFilename(verse.ref_key);
    const outputFilePath = path.join(
      versesDir,
      `${String(sequence).padStart(3, "0")}-${safeRef}.json`
    );
    const outputPayload = buildVerseOutputPayload({
      sequence,
      verse,
      mode: opts.mode,
      words: verse.words,
      trace,
      carryIn,
      carryOut,
      stateSize,
      cleanup: {
        keptCount: verseEnd.cleanup?.keptCount ?? null,
        droppedCount: verseEnd.cleanup?.droppedCount ?? null
      },
      verseBoundary: verseEnd.verseBoundary,
      runtimeError
    });
    await fs.writeFile(outputFilePath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");

    summaryRows.push({
      sequence,
      ref_key: verse.ref_key,
      outputPath: workspaceRelativePath(outputFilePath),
      carryIn,
      carryOut,
      stateSize,
      cleanup: {
        keptCount: verseEnd.cleanup?.keptCount ?? null,
        droppedCount: verseEnd.cleanup?.droppedCount ?? null
      },
      runtimeError
    });
  }

  const nonIncreasingHandleCount = handleCounts.every(
    (count, index) => index === 0 || count <= handleCounts[index - 1]
  );

  const summary: VerseRangeSummary = {
    mode: opts.mode,
    from: fromRefKey,
    to: toRefKey,
    input: workspaceRelativePath(inputPath),
    outDir: workspaceRelativePath(outDir),
    versesSelected: selectedVerses.length,
    runtimeErrors,
    continuity: {
      expectedTransitions: Math.max(0, selectedVerses.length - 1),
      omegaMatches,
      focusMatches,
      domainMatches,
      mismatches: continuityMismatches
    },
    sanity: {
      handleCounts,
      nonIncreasingHandleCount
    },
    verses: summaryRows
  };

  const summaryPath = path.join(outDir, "summary.json");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return summary;
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const summary = await runVerseRange(opts);
  const summaryPath = path.resolve(opts.outDir, "summary.json");
  console.log(
    [
      `run-verse-range: verses=${summary.versesSelected}`,
      `mode=${readModeLabel(summary.mode)}`,
      `from=${summary.from}`,
      `to=${summary.to}`,
      `summary=${workspaceRelativePath(summaryPath)}`
    ].join(" ")
  );
}
