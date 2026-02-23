import fs from "node:fs/promises";
import path from "node:path";
import { IterateTorahOptions, sanitizeText } from "../iterateTorah/runtime";
import { DeepTraceEntry, PreparedTraceToken, runProgramWithDeepTrace } from "../../vm/vm";
import { createInitialState } from "../../state/state";
import { VerseSnapshot, finalizeVerse } from "../../runtime/finalizeVerse";

type RunLanguage = "he" | "en" | "both";

type Verse = {
  n?: number;
  he?: string;
  en?: string;
};

type Chapter = {
  n?: number;
  verses?: Verse[];
};

type Book = {
  name?: string;
  chapters?: Chapter[];
};

type TorahPayload = {
  books?: Book[];
};

export type RefKey = {
  book: string;
  chapter: number;
  verse: number;
};

export type PasukTraceOptions = {
  input: string;
  ref: string;
  text: string;
  lang: RunLanguage;
  normalizeFinals: boolean;
  keepTeamim: boolean;
  allowRuntimeErrors: boolean;
  includeSnapshots: boolean;
  outJson: string;
  outReport: string;
  printReport: boolean;
};

export type WordSection = {
  word_index: number;
  surface: string;
  op_entries: DeepTraceEntry[];
  exit_boundary: DeepTraceEntry | null;
};

export type PasukTraceRunResult = {
  ref_key: string;
  source_text: string;
  cleaned_text: string;
  prepared_tokens: PreparedTraceToken[];
  trace: DeepTraceEntry[];
  verse_snapshots: VerseSnapshot[];
  final_state: Record<string, any>;
  word_sections: WordSection[];
  report_text: string;
};

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), ".tmp", "pasuk-trace");

function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/pasuk-trace.mjs [--ref=Book/Chapter/Verse] [--input=path] [--lang=he|en|both]"
  );
  console.log(
    "  node scripts/pasuk-trace.mjs [--text='...'] [--keep-teamim] [--normalize-finals] [--include-snapshots]"
  );
  console.log(
    "  node scripts/pasuk-trace.mjs [--out-json=path] [--out-report=path] [--print-report]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log("  --ref=Genesis/1/1");
  console.log("  --lang=he");
  console.log("  keep-teamim=false");
  console.log("  normalize-finals=false");
  console.log("  include-snapshots=true");
}

function readOptionValue(
  argv: string[],
  index: number,
  optionName: string
): {
  value: string;
  nextIndex: number;
} | null {
  const arg = argv[index] ?? "";
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return {
      value: arg.slice(prefix.length),
      nextIndex: index
    };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return {
      value: argv[index + 1] ?? "",
      nextIndex: index + 1
    };
  }
  return null;
}

function slugifyRef(refText: string): string {
  const normalized = String(refText ?? "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "manual";
}

function defaultOutPath(refText: string, ext: "json" | "txt"): string {
  return path.join(DEFAULT_OUT_DIR, `${slugifyRef(refText)}.${ext}`);
}

export function parseRefKey(ref: string): RefKey {
  const parts = String(ref ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 3) {
    throw new Error(`Invalid ref '${ref}'. Expected Book/Chapter/Verse.`);
  }

  const verseRaw = parts.pop() ?? "";
  const chapterRaw = parts.pop() ?? "";
  const book = parts.join("/");
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);

  if (!book || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    throw new Error(`Invalid ref '${ref}'. Expected Book/Chapter/Verse with positive integers.`);
  }

  return {
    book,
    chapter,
    verse
  };
}

export function parseArgs(argv: string[]): PasukTraceOptions {
  const opts: PasukTraceOptions = {
    input: DEFAULT_INPUT,
    ref: "Genesis/1/1",
    text: "",
    lang: "he",
    normalizeFinals: false,
    keepTeamim: false,
    allowRuntimeErrors: false,
    includeSnapshots: true,
    outJson: "",
    outReport: "",
    printReport: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
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

    const refOpt = readOptionValue(argv, index, "--ref");
    if (refOpt) {
      opts.ref = refOpt.value;
      index = refOpt.nextIndex;
      continue;
    }

    const textOpt = readOptionValue(argv, index, "--text");
    if (textOpt) {
      opts.text = textOpt.value;
      index = textOpt.nextIndex;
      continue;
    }

    const langOpt = readOptionValue(argv, index, "--lang");
    if (langOpt) {
      const lang = langOpt.value;
      if (lang !== "he" && lang !== "en" && lang !== "both") {
        throw new Error(`Invalid --lang value: ${lang}`);
      }
      opts.lang = lang;
      index = langOpt.nextIndex;
      continue;
    }

    const outJsonOpt = readOptionValue(argv, index, "--out-json");
    if (outJsonOpt) {
      opts.outJson = outJsonOpt.value;
      index = outJsonOpt.nextIndex;
      continue;
    }

    const outReportOpt = readOptionValue(argv, index, "--out-report");
    if (outReportOpt) {
      opts.outReport = outReportOpt.value;
      index = outReportOpt.nextIndex;
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
    if (arg === "--include-snapshots") {
      opts.includeSnapshots = true;
      continue;
    }
    if (arg === "--no-snapshots") {
      opts.includeSnapshots = false;
      continue;
    }
    if (arg === "--print-report") {
      opts.printReport = true;
      continue;
    }
    if (arg === "--no-print-report") {
      opts.printReport = false;
      continue;
    }
  }

  const targetRef = opts.text.trim().length > 0 ? "manual" : opts.ref;
  if (!opts.outJson) {
    opts.outJson = defaultOutPath(targetRef, "json");
  }
  if (!opts.outReport) {
    opts.outReport = defaultOutPath(targetRef, "txt");
  }

  if (!opts.text.trim()) {
    parseRefKey(opts.ref);
  }

  return opts;
}

function resolveRawText(verse: Verse, lang: RunLanguage): string {
  if (lang === "en") {
    return String(verse.en ?? "");
  }
  if (lang === "both") {
    return String(verse.he ?? verse.en ?? "");
  }
  return String(verse.he ?? "");
}

function findBook(payload: TorahPayload, name: string): Book | null {
  const books = payload.books ?? [];
  const exact = books.find((book) => String(book.name ?? "") === name);
  if (exact) {
    return exact;
  }
  const normalized = name.toLowerCase();
  return books.find((book) => String(book.name ?? "").toLowerCase() === normalized) ?? null;
}

function formatBoundaryLabel(entry: DeepTraceEntry | null): string {
  if (!entry) {
    return "(no-boundary)";
  }
  const mode = entry.boundary_mode ?? "hard";
  if (mode === "cut") {
    return `□cut(${entry.rank ?? 1})`;
  }
  return `□${mode}`;
}

export function buildWordSections(trace: DeepTraceEntry[]): WordSection[] {
  const sections: WordSection[] = [];
  let opEntries: DeepTraceEntry[] = [];
  let surface = "";

  for (const entry of trace) {
    if (entry.token === "□") {
      if (opEntries.length > 0) {
        sections.push({
          word_index: sections.length + 1,
          surface,
          op_entries: opEntries,
          exit_boundary: entry
        });
        opEntries = [];
        surface = "";
      }
      continue;
    }

    opEntries.push(entry);
    surface += entry.token_raw;
  }

  if (opEntries.length > 0) {
    sections.push({
      word_index: sections.length + 1,
      surface,
      op_entries: opEntries,
      exit_boundary: null
    });
  }

  return sections;
}

function formatFullJson(value: unknown): string {
  if (value === undefined) {
    return "-";
  }
  try {
    const text = JSON.stringify(value);
    return text && text.length > 0 ? text : "-";
  } catch {
    return String(value);
  }
}

function phaseDetail(entry: DeepTraceEntry, phase: string): Record<string, any> | null {
  const found = entry.phases.find((row) => row.phase === phase);
  return (found?.detail as Record<string, any> | undefined) ?? null;
}

function extractDiacriticKinds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      return String((item as { kind?: unknown }).kind ?? "");
    })
    .filter((kind) => kind.length > 0);
}

function phaseSummaryLabel(entry: DeepTraceEntry): string {
  const rosh = phaseDetail(entry, "rosh");
  const sof = phaseDetail(entry, "sof");
  const roshKinds = extractDiacriticKinds(rosh?.rosh_diacritics);
  const sofKinds = extractDiacriticKinds(sof?.sof_diacritics);
  const labels: string[] = [];
  if (roshKinds.length > 0) {
    labels.push(`rosh:${roshKinds.join(",")}`);
  }
  if (sofKinds.length > 0) {
    labels.push(`sof:${sofKinds.join(",")}`);
  }
  if (entry.shape_op) {
    labels.push(`shape:${entry.shape_op}`);
  }
  if (labels.length === 0) {
    return "";
  }
  return `  [${labels.join("; ")}]`;
}

function formatJoinInStatus(wordEntry: Record<string, any> | null): string {
  const joinAtEntry = wordEntry?.pending_join_at_entry;
  if (!joinAtEntry || typeof joinAtEntry !== "object") {
    return "-";
  }

  const id = String((joinAtEntry as { id?: unknown }).id ?? "");
  const action = String(wordEntry?.pending_join_action ?? "none");
  if (action === "consumed") {
    return `${id} (consumed)`;
  }
  if (action === "blocked_by_barrier") {
    const barrier = wordEntry?.left_context_barrier ?? "-";
    return `${id} (blocked_by_barrier=${barrier})`;
  }
  return `${id} (carried)`;
}

type ScopeEdge = {
  id: string;
  outside: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function buildInsideBoundaryIndex(
  boundaries: Array<Record<string, any>>
): Map<string, ScopeEdge[]> {
  const byInside = new Map<string, ScopeEdge[]>();
  for (const boundary of boundaries) {
    const id = asNonEmptyString(boundary?.id) ?? asNonEmptyString(boundary?.boundaryId);
    const inside = asNonEmptyString(boundary?.inside);
    if (!id || !inside) {
      continue;
    }
    const outside = asNonEmptyString(boundary?.outside);
    const bucket = byInside.get(inside);
    const edge: ScopeEdge = { id, outside };
    if (bucket) {
      bucket.push(edge);
    } else {
      byInside.set(inside, [edge]);
    }
  }
  for (const edges of byInside.values()) {
    edges.sort((a, b) => a.id.localeCompare(b.id));
  }
  return byInside;
}

function compareScopePaths(a: string[], b: string[]): number {
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  const aKey = a.join("\u0000");
  const bKey = b.join("\u0000");
  return bKey.localeCompare(aKey);
}

function inferScopePath(handleId: string, byInside: Map<string, ScopeEdge[]>): string[] {
  type Frame = {
    current: string;
    path: string[];
    seenHandles: Set<string>;
    seenBoundaries: Set<string>;
  };

  const stack: Frame[] = [
    {
      current: handleId,
      path: [],
      seenHandles: new Set([handleId]),
      seenBoundaries: new Set()
    }
  ];
  let bestPath: string[] = [];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) {
      continue;
    }

    const edges = byInside.get(frame.current) ?? [];
    if (edges.length === 0) {
      if (compareScopePaths(frame.path, bestPath) > 0) {
        bestPath = frame.path;
      }
      continue;
    }

    let advanced = false;
    for (const edge of edges) {
      if (frame.seenBoundaries.has(edge.id)) {
        continue;
      }

      const nextPath = [...frame.path, edge.id];
      if (compareScopePaths(nextPath, bestPath) > 0) {
        bestPath = nextPath;
      }

      if (!edge.outside || frame.seenHandles.has(edge.outside)) {
        continue;
      }

      advanced = true;
      const seenHandles = new Set(frame.seenHandles);
      seenHandles.add(edge.outside);
      const seenBoundaries = new Set(frame.seenBoundaries);
      seenBoundaries.add(edge.id);
      stack.push({
        current: edge.outside,
        path: nextPath,
        seenHandles,
        seenBoundaries
      });
    }

    if (!advanced && compareScopePaths(frame.path, bestPath) > 0) {
      bestPath = frame.path;
    }
  }

  return bestPath;
}

function enrichScopeMembership(finalState: Record<string, any>): void {
  const handles = Array.isArray(finalState?.handles)
    ? (finalState.handles as Array<Record<string, any>>)
    : [];
  const boundaries = Array.isArray(finalState?.boundaries)
    ? (finalState.boundaries as Array<Record<string, any>>)
    : [];
  if (handles.length === 0 || boundaries.length === 0) {
    return;
  }

  const byInside = buildInsideBoundaryIndex(boundaries);
  if (byInside.size === 0) {
    return;
  }

  const membersByBoundary = new Map<string, Set<string>>();
  for (const boundary of boundaries) {
    const boundaryId = asNonEmptyString(boundary?.id) ?? asNonEmptyString(boundary?.boundaryId);
    if (!boundaryId) {
      continue;
    }
    const memberSet = membersByBoundary.get(boundaryId) ?? new Set<string>();
    for (const memberId of asStringArray(boundary?.members)) {
      memberSet.add(memberId);
    }
    for (const memberId of asStringArray(boundary?.memberIds)) {
      memberSet.add(memberId);
    }
    for (const memberId of asStringArray(boundary?.contains)) {
      memberSet.add(memberId);
    }
    const inside = asNonEmptyString(boundary?.inside);
    if (inside) {
      memberSet.add(inside);
    }
    membersByBoundary.set(boundaryId, memberSet);
  }

  for (const handle of handles) {
    const handleId = asNonEmptyString(handle?.id);
    if (!handleId) {
      continue;
    }

    const scopePath = inferScopePath(handleId, byInside);
    if (scopePath.length === 0) {
      continue;
    }

    const meta =
      handle?.meta && typeof handle.meta === "object" && !Array.isArray(handle.meta)
        ? handle.meta
        : {};
    handle.meta = { ...meta, scope_path: scopePath };

    for (const boundaryId of scopePath) {
      const memberSet = membersByBoundary.get(boundaryId) ?? new Set<string>();
      memberSet.add(handleId);
      membersByBoundary.set(boundaryId, memberSet);
    }
  }

  for (const boundary of boundaries) {
    const boundaryId = asNonEmptyString(boundary?.id) ?? asNonEmptyString(boundary?.boundaryId);
    if (!boundaryId) {
      continue;
    }
    const memberSet = membersByBoundary.get(boundaryId);
    if (!memberSet || memberSet.size === 0) {
      continue;
    }
    boundary.members = Array.from(memberSet).sort((a, b) => a.localeCompare(b));
  }
}

function withTraceFriendlyVmFlags(finalState: Record<string, any>): Record<string, any> {
  const vm = finalState?.vm;
  if (vm && typeof vm.wordHasContent === "boolean") {
    vm.has_data_payload = vm.wordHasContent;
    delete vm.wordHasContent;
  }
  enrichScopeMembership(finalState);
  return finalState;
}

export function formatDeepTraceReport(args: {
  refKey: string;
  cleanedText: string;
  sections: WordSection[];
  finalState: Record<string, any>;
}): string {
  const lines: string[] = [];
  lines.push("PASUK TRACE REPORT");
  lines.push(`ref: ${args.refKey}`);
  lines.push(`cleaned: ${args.cleanedText}`);
  lines.push("");

  for (const section of args.sections) {
    lines.push("══════════════════════════════════════════════════════════════");
    lines.push(
      ` WORD ${section.word_index} │ ${section.surface} │ exit=${formatBoundaryLabel(section.exit_boundary)}`
    );
    lines.push("══════════════════════════════════════════════════════════════");
    lines.push("");

    const wordEntry = phaseDetail(
      section.op_entries[0] ?? ({} as DeepTraceEntry),
      "word_entry_context"
    );
    lines.push(`  [join_in: ${formatJoinInStatus(wordEntry)}]`);
    lines.push("");

    for (let index = 0; index < section.op_entries.length; index += 1) {
      const entry = section.op_entries[index];
      const select = phaseDetail(entry, "select");
      const rosh = phaseDetail(entry, "rosh");
      const bound = phaseDetail(entry, "bound");
      const toch = phaseDetail(entry, "toch");
      const seal = phaseDetail(entry, "seal");
      const sof = phaseDetail(entry, "sof");
      lines.push(
        `τ=${entry.tauBefore} │ OP_${index + 1}${phaseSummaryLabel(entry)}  (${entry.token_raw})`
      );
      lines.push(`    │ Select : ${formatFullJson(select?.select_operands ?? null)}`);
      lines.push(
        `    │ Rosh   : ${formatFullJson({
          diacritics: rosh?.rosh_diacritics ?? [],
          inside_dot_kind: rosh?.inside_dot_kind ?? entry.inside_dot_kind ?? "none",
          shin_branch: rosh?.shin_branch ?? null
        })}`
      );
      lines.push(`    │ Bound  : ${formatFullJson(bound?.construction ?? null)}`);
      lines.push(
        `    │ Toch   : ${formatFullJson({
          diacritics: toch?.toch_diacritics ?? [],
          dot_kind: toch?.dot_kind ?? entry.dot_kind ?? "none",
          inside_dot_kind: toch?.inside_dot_kind ?? entry.inside_dot_kind ?? "none",
          letter_mode: toch?.letter_mode ?? null
        })}`
      );
      lines.push(
        `    │ Seal   : ${formatFullJson({
          sealed_handle: seal?.sealed_handle ?? null,
          residue: seal?.residue ?? null,
          F: entry.F,
          R: entry.R
        })}`
      );
      lines.push(`    │ Sof    : ${formatFullJson(sof?.sof_diacritics ?? [])}`);
      lines.push(
        `    │ State  : ${formatFullJson({
          KLength: entry.KLength,
          OStackLength: entry.OStackLength,
          barrier: entry.barrier ?? null
        })}`
      );
      lines.push("");
    }

    if (section.exit_boundary) {
      const boundary = section.exit_boundary;
      lines.push(
        `  ─── ${formatBoundaryLabel(boundary)} ───────────────────────────────────────────────────`
      );
      lines.push(
        `    │ τ ${boundary.tauBefore} -> ${boundary.tauAfter}; continuation=${Boolean(
          boundary.continuation
        )}`
      );
      lines.push(
        `    │ pending_join_created=${boundary.pending_join_created ?? "-"}; pending_join_consumed=${
          boundary.pending_join_consumed ?? "-"
        }`
      );
      lines.push(
        `    │ barrier=${boundary.barrier ?? "-"}; events=${formatFullJson(boundary.events)}`
      );
      lines.push("");
    }
  }

  lines.push("══════════════════════════════════════════════════════════════");
  lines.push(" FINAL STATE");
  lines.push("══════════════════════════════════════════════════════════════");
  lines.push(formatFullJson(args.finalState));
  lines.push("");

  return lines.join("\n");
}

async function resolveVerseText(
  opts: PasukTraceOptions
): Promise<{ refKey: string; text: string }> {
  if (opts.text.trim().length > 0) {
    return {
      refKey: "manual",
      text: opts.text
    };
  }

  const parsed = parseRefKey(opts.ref);
  const raw = await fs.readFile(path.resolve(opts.input), "utf8");
  const payload = JSON.parse(raw) as TorahPayload;

  const book = findBook(payload, parsed.book);
  if (!book) {
    throw new Error(`Book '${parsed.book}' not found in ${opts.input}`);
  }
  const chapter = (book.chapters ?? []).find((item) => Number(item.n) === parsed.chapter);
  if (!chapter) {
    throw new Error(`Chapter '${parsed.chapter}' not found in ${parsed.book}`);
  }
  const verse = (chapter.verses ?? []).find((item) => Number(item.n) === parsed.verse);
  if (!verse) {
    throw new Error(`Verse '${parsed.verse}' not found in ${parsed.book} ${parsed.chapter}`);
  }

  const text = resolveRawText(verse, opts.lang);
  if (!text.trim()) {
    throw new Error(`Selected verse ${opts.ref} has no text for lang=${opts.lang}`);
  }

  return {
    refKey: `${parsed.book}/${parsed.chapter}/${parsed.verse}`,
    text
  };
}

function toIterateSanitizeOptions(opts: PasukTraceOptions): IterateTorahOptions {
  return {
    input: opts.input,
    lang: opts.lang,
    normalizeFinals: opts.normalizeFinals,
    keepTeamim: opts.keepTeamim,
    allowRuntimeErrors: opts.allowRuntimeErrors
  };
}

export async function runPasukTrace(opts: PasukTraceOptions): Promise<PasukTraceRunResult> {
  const resolved = await resolveVerseText(opts);
  const cleaned = sanitizeText(resolved.text, toIterateSanitizeOptions(opts));
  if (!cleaned) {
    throw new Error(`Verse ${resolved.refKey} sanitized to empty text`);
  }

  const execution = runProgramWithDeepTrace(cleaned, createInitialState(), {
    includeStateSnapshots: opts.includeSnapshots,
    finalizeAtVerseEnd: true,
    finalizeVerseOptions: { ref: resolved.refKey, cleaned }
  });
  const sections = buildWordSections(execution.deepTrace);
  const verseSnapshots =
    execution.verseSnapshots.length > 0
      ? execution.verseSnapshots
      : [finalizeVerse(execution.state, { ref: resolved.refKey, cleaned })];
  const verseSnapshot = verseSnapshots[verseSnapshots.length - 1];
  const finalState = withTraceFriendlyVmFlags(
    JSON.parse(JSON.stringify(verseSnapshot.state_dump)) as Record<string, any>
  );

  const reportText = formatDeepTraceReport({
    refKey: resolved.refKey,
    cleanedText: cleaned,
    sections,
    finalState
  });

  return {
    ref_key: resolved.refKey,
    source_text: resolved.text,
    cleaned_text: cleaned,
    prepared_tokens: execution.preparedTokens,
    trace: execution.deepTrace,
    verse_snapshots: verseSnapshots,
    final_state: finalState,
    word_sections: sections,
    report_text: reportText
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const result = await runPasukTrace(opts);

  const dumpPayload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    ref_key: result.ref_key,
    options: {
      input: path.resolve(opts.input),
      ref: opts.ref,
      text: opts.text,
      lang: opts.lang,
      normalize_finals: opts.normalizeFinals,
      keep_teamim: opts.keepTeamim,
      include_snapshots: opts.includeSnapshots
    },
    source_text: result.source_text,
    cleaned_text: result.cleaned_text,
    prepared_tokens: result.prepared_tokens,
    deep_trace: result.trace,
    verse_snapshots: result.verse_snapshots,
    word_sections: result.word_sections,
    final_state: result.final_state
  };

  const outJsonPath = path.resolve(opts.outJson);
  const outReportPath = path.resolve(opts.outReport);
  await fs.mkdir(path.dirname(outJsonPath), { recursive: true });
  await fs.mkdir(path.dirname(outReportPath), { recursive: true });
  await fs.writeFile(outJsonPath, JSON.stringify(dumpPayload, null, 2), "utf8");
  await fs.writeFile(outReportPath, `${result.report_text}\n`, "utf8");

  if (opts.printReport) {
    console.log(result.report_text);
  }

  console.log(
    [
      `pasuk-trace: ref=${result.ref_key}`,
      `words=${result.word_sections.length}`,
      `tokens=${result.trace.length}`,
      `json=${outJsonPath}`,
      `report=${outReportPath}`
    ].join(" ")
  );
}
