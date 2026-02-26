import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { formatDeepTraceReport, parseRefKey, runPasukTrace } from "../pasukTrace/runtime";
import type { WordSection } from "../pasukTrace/runtime";

type RunLanguage = "he" | "en" | "both";
type GraphTheme = "light" | "dark" | "kabbalah";
type GraphMode = "full" | "compact" | "summary";
type GraphBoundaryMode = "auto" | "cluster" | "node" | "both";
type GraphPruneMode = "orphans" | "none";
type GraphWordsMode = "off" | "cluster" | "label";

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

type CollectedRef = {
  refKey: string;
  book: string;
  chapter: number;
  verse: number;
  bookSlug: string;
};

type RenderDotFromTraceJson = (input: unknown, opts?: Record<string, unknown>) => string;
type DynamicImport = (specifier: string) => Promise<unknown>;

type RendererIds = {
  graphRendererId: string;
  reportRendererId: string;
};

type TraceExecutionMode = "in-process" | "subprocess";

type TracePayloadLike = {
  schema_version?: unknown;
  generated_at?: unknown;
  ref_key?: unknown;
  options?: unknown;
  source_text?: unknown;
  cleaned_text?: unknown;
  prepared_tokens?: unknown;
  word_sections?: unknown;
  final_dump_state?: unknown;
  post_reset_state?: unknown;
  final_state?: unknown;
  deep_trace?: unknown;
  verse_snapshots?: unknown;
};

type DotProvenance = {
  trace_file_sha256: string;
  graph_opts_sha256: string;
  graph_renderer_id: string;
  dot_schema: number;
  trace_semantic_sha256?: string;
};

type ReportProvenance = {
  trace_file_sha256: string;
  report_renderer_id: string;
  report_schema: number;
  trace_semantic_sha256?: string;
};

type ParsedDotProvenance = {
  trace_file_sha256?: string;
  graph_opts_sha256?: string;
  graph_renderer_id?: string;
  dot_schema?: number;
  trace_semantic_sha256?: string;
};

type ParsedReportProvenance = {
  trace_file_sha256?: string;
  report_renderer_id?: string;
  report_schema?: number;
  trace_semantic_sha256?: string;
};

type ExistingArtifacts = {
  traceJsonText: string | null;
  tracePayload: TracePayloadLike | null;
  reportText: string | null;
  dotText: string | null;
};

type ExistingSkipArtifacts = {
  traceJsonExists: boolean;
  reportText: string | null;
  dotText: string | null;
};

type ExistingCheckResult = {
  skippable: boolean;
  canRepairFromTrace: boolean;
  reasons: string[];
  traceFileSha256: string | null;
  traceSemanticSha256: string | null;
  parsedDotProvenance: ParsedDotProvenance | null;
  parsedReportProvenance: ParsedReportProvenance | null;
};

type ExistingSkipCheckResult = {
  skippable: boolean;
  reasons: string[];
  parsedDotProvenance: ParsedDotProvenance | null;
  parsedReportProvenance: ParsedReportProvenance | null;
};

function isFullCorpusSelection(
  opts: Pick<PasukTraceCorpusOptions, "books" | "fromRef" | "toRef" | "limit">
): boolean {
  return (
    opts.books.length === 0 &&
    opts.fromRef.trim().length === 0 &&
    opts.toRef.trim().length === 0 &&
    opts.limit === 0
  );
}

function shouldResetOutputBeforeRun(
  opts: Pick<
    PasukTraceCorpusOptions,
    "books" | "fromRef" | "toRef" | "limit" | "skipExisting" | "verifyExisting" | "repairExisting"
  >
): boolean {
  return (
    isFullCorpusSelection(opts) &&
    !opts.skipExisting &&
    !opts.verifyExisting &&
    !opts.repairExisting
  );
}

async function resetOutputDirForFullRun(outDir: string): Promise<void> {
  await fs.rm(path.join(outDir, "refs"), { recursive: true, force: true });
  await fs.rm(path.join(outDir, "manifest.json"), { force: true });
}

type ExpectedProvenance = {
  traceFileSha256: string;
  traceSemanticSha256: string;
  graphOptsSha256: string;
  graphRendererId: string;
  reportRendererId: string;
};

export type PasukTraceCorpusDeps = {
  renderDotFromTraceJson?: RenderDotFromTraceJson;
  rendererIds?: RendererIds;
  traceExecutionMode?: TraceExecutionMode;
};

export type PasukTraceCorpusOptions = {
  input: string;
  outDir: string;
  lang: RunLanguage;
  normalizeFinals: boolean;
  keepTeamim: boolean;
  includeSnapshots: boolean;
  showPostReset: boolean;
  continueOnError: boolean;
  skipExisting: boolean;
  verifyExisting: boolean;
  repairExisting: boolean;
  books: string[];
  fromRef: string;
  toRef: string;
  limit: number;
  concurrency: number;
  progressEvery: number;
  printProgress: boolean;
  emitDot: boolean;
  graphTheme: GraphTheme;
  graphMode: GraphMode;
  graphBoundary: GraphBoundaryMode;
  graphPrune: GraphPruneMode;
  graphPruneKeepKinds: string;
  graphPruneKeepIds: string;
  graphLayout: "plain" | "boot";
  graphPrettyIds: boolean;
  graphLegend: boolean | null;
  graphWords: GraphWordsMode;
};

type RefIndexRow = {
  ref_key: string;
  book: string;
  book_slug: string;
  chapter: number;
  verse: number;
  output: {
    trace_json: string;
    trace_report: string;
    graph_dot: string | null;
  };
  stats: {
    words: number;
    trace_entries: number;
    snapshots: number;
  };
  sha256: {
    trace_json: string;
    trace_report: string;
    graph_dot: string | null;
  };
  provenance?: {
    trace_file_sha256: string;
    trace_semantic_sha256: string | null;
    graph_opts_sha256: string | null;
    graph_renderer_id: string | null;
    dot_schema: number | null;
    report_renderer_id: string;
    report_schema: number;
  };
};

type RunError = {
  ref_key: string;
  message: string;
};

type CorpusManifest = {
  schema_version: 1;
  corpus: "torah";
  artifact_set: "pasuk-trace-corpus";
  generated_at: string;
  input: {
    path: string;
  };
  options: {
    lang: RunLanguage;
    normalize_finals: boolean;
    keep_teamim: boolean;
    include_snapshots: boolean;
    show_post_reset: boolean;
    continue_on_error: boolean;
    skip_existing: boolean;
    verify_existing: boolean;
    repair_existing: boolean;
    books: string[];
    from_ref: string;
    to_ref: string;
    limit: number;
    concurrency: number;
    emit_dot: boolean;
    graph: {
      theme: GraphTheme;
      mode: GraphMode;
      boundary: GraphBoundaryMode;
      prune: GraphPruneMode;
      prune_keep_kinds: string;
      prune_keep_ids: string;
      layout: "plain" | "boot";
      pretty_ids: boolean;
      legend: boolean | null;
      words: GraphWordsMode;
    };
  };
  totals: {
    discovered_refs: number;
    queued_refs: number;
    processed: number;
    repaired_existing: number;
    skipped_existing: number;
    errors: number;
    duration_ms: number;
  };
  index: {
    path: string;
    rows: number;
  };
  errors: RunError[];
};

const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "outputs", "pasuk-trace-corpus", "latest");
const DEFAULT_CONCURRENCY = 50;
const DEFAULT_PROGRESS_EVERY = 25;
const OMEGA_HANDLE_ID = "Ω";
const LEGACY_TRACE_DUMP_SCHEMA = 1;
const TRACE_DUMP_SCHEMA = 2;
const SUPPORTED_TRACE_DUMP_SCHEMAS = new Set<number>([LEGACY_TRACE_DUMP_SCHEMA, TRACE_DUMP_SCHEMA]);
const DOT_SCHEMA = 2;
const REPORT_SCHEMA = 2;
const SUPPORTED_DOT_SCHEMAS = new Set<number>([DOT_SCHEMA]);
const SUPPORTED_REPORT_SCHEMAS = new Set<number>([REPORT_SCHEMA]);

const dynamicImport = new Function("specifier", "return import(specifier);") as DynamicImport;

let rendererIdsCache: Promise<RendererIds> | null = null;

function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--input=path] [--out-dir=path] [--lang=he|en|both]"
  );
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--keep-teamim|--strip-teamim] [--include-snapshots|--no-snapshots]"
  );
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--show-post-reset|--hide-post-reset] [--skip-existing] [--verify-existing] [--repair-existing]"
  );
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--book=Genesis --book=Exodus] [--from-ref=Book/Chapter/Verse] [--to-ref=Book/Chapter/Verse] [--limit=N] [--concurrency=N]"
  );
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--layout=boot|plain] [--boundary=auto|cluster|node|both] [--pretty-ids|--no-pretty-ids]"
  );
  console.log(
    "  node scripts/pasuk-trace-corpus.mjs [--theme=light|dark|kabbalah] [--mode=full|compact|summary] [--words=off|cluster|label]"
  );
  console.log("  node scripts/pasuk-trace-corpus.mjs [--no-dot]");
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --out-dir=${DEFAULT_OUT_DIR}`);
  console.log("  --lang=he");
  console.log("  keep-teamim=true");
  console.log("  include-snapshots=true");
  console.log("  show-post-reset=true");
  console.log("  continue-on-error=false");
  console.log("  skip-existing=false");
  console.log("  verify-existing=false");
  console.log("  repair-existing=false");
  console.log("  emit-dot=true");
  console.log("  --layout=boot");
  console.log("  --boundary=cluster");
  console.log("  --pretty-ids=true");
  console.log(`  --concurrency=${DEFAULT_CONCURRENCY}`);
  console.log(`  --progress-every=${DEFAULT_PROGRESS_EVERY}`);
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

function parsePositiveInt(value: string, optionName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${optionName} value: ${value}`);
  }
  return parsed;
}

function ensureLanguage(value: string): RunLanguage {
  if (value === "he" || value === "en" || value === "both") {
    return value;
  }
  throw new Error(`Invalid --lang value: ${value}`);
}

function ensureGraphTheme(value: string): GraphTheme {
  if (value === "light" || value === "dark" || value === "kabbalah") {
    return value;
  }
  throw new Error(`Invalid --theme value: ${value}`);
}

function ensureGraphMode(value: string): GraphMode {
  if (value === "full" || value === "compact" || value === "summary") {
    return value;
  }
  throw new Error(`Invalid --mode value: ${value}`);
}

function ensureGraphBoundary(value: string): GraphBoundaryMode {
  if (value === "auto" || value === "cluster" || value === "node" || value === "both") {
    return value;
  }
  throw new Error(`Invalid --boundary value: ${value}`);
}

function ensureGraphPrune(value: string): GraphPruneMode {
  if (value === "orphans" || value === "none") {
    return value;
  }
  throw new Error(`Invalid --prune value: ${value}`);
}

function ensureGraphWords(value: string): GraphWordsMode {
  if (value === "off" || value === "cluster" || value === "label") {
    return value;
  }
  throw new Error(`Invalid --words value: ${value}`);
}

function ensureLayout(value: string): "plain" | "boot" {
  if (value === "plain" || value === "boot") {
    return value;
  }
  throw new Error(`Invalid --layout value: ${value}`);
}

function normalizeBookName(value: string): string {
  return value.trim().toLowerCase();
}

function slugifyBook(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "book";
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

function toPosixRelative(baseDir: string, target: string): string {
  return path.relative(baseDir, target).split(path.sep).join("/");
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeRefKey(ref: string): string {
  const parsed = parseRefKey(ref);
  return `${parsed.book}/${parsed.chapter}/${parsed.verse}`;
}

function equalRef(left: string, right: string): boolean {
  const l = parseRefKey(left);
  const r = parseRefKey(right);
  return (
    l.chapter === r.chapter && l.verse === r.verse && l.book.toLowerCase() === r.book.toLowerCase()
  );
}

function selectRefWindow(args: {
  refs: CollectedRef[];
  fromRef: string;
  toRef: string;
  limit: number;
}): CollectedRef[] {
  const { refs, fromRef, toRef, limit } = args;
  if (refs.length === 0) {
    return refs;
  }

  let startIndex = 0;
  if (fromRef.trim()) {
    const normalizedFrom = normalizeRefKey(fromRef);
    const found = refs.findIndex((item) => equalRef(item.refKey, normalizedFrom));
    if (found < 0) {
      throw new Error(`--from-ref not found in input corpus: ${normalizedFrom}`);
    }
    startIndex = found;
  }

  let endIndex = refs.length - 1;
  if (toRef.trim()) {
    const normalizedTo = normalizeRefKey(toRef);
    const found = refs.findIndex((item) => equalRef(item.refKey, normalizedTo));
    if (found < 0) {
      throw new Error(`--to-ref not found in input corpus: ${normalizedTo}`);
    }
    endIndex = found;
  }

  if (endIndex < startIndex) {
    throw new Error("--to-ref points to a verse before --from-ref");
  }

  const sliced = refs.slice(startIndex, endIndex + 1);
  if (limit > 0 && sliced.length > limit) {
    return sliced.slice(0, limit);
  }
  return sliced;
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableClone(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
    const nested = input[key];
    if (nested === undefined) {
      continue;
    }
    out[key] = stableClone(nested);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableClone(value));
}

function stripVolatileTraceFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripVolatileTraceFields(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (key === "generated_at") {
      continue;
    }
    out[key] = stripVolatileTraceFields(input[key]);
  }
  return out;
}

function computeTraceSemanticSha256(tracePayload: unknown): string {
  const normalized =
    tracePayload && typeof tracePayload === "object"
      ? normalizeTracePayloadForDerivedArtifacts(tracePayload as TracePayloadLike)
      : tracePayload;
  return sha256Text(stableStringify(stripVolatileTraceFields(normalized)));
}

function withTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing or not an object`);
  }
  return value as Record<string, unknown>;
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePointer(value: unknown, fallback: string = OMEGA_HANDLE_ID): string {
  return asNonEmptyString(value) ?? fallback;
}

function resolveLegacyDomainPointer(source: Record<string, unknown> | null): string {
  if (!source) {
    return OMEGA_HANDLE_ID;
  }
  return (
    asNonEmptyString(source.D) ??
    asNonEmptyString(source.domain) ??
    asNonEmptyString(source.Omega) ??
    asNonEmptyString(source.omega) ??
    asNonEmptyString(source.OmegaId) ??
    OMEGA_HANDLE_ID
  );
}

function resolveLegacyFocusPointer(source: Record<string, unknown> | null): string {
  if (!source) {
    return OMEGA_HANDLE_ID;
  }
  return asNonEmptyString(source.F) ?? asNonEmptyString(source.focus) ?? OMEGA_HANDLE_ID;
}

function normalizeTraceSchemaVersion(tracePayload: TracePayloadLike): number {
  const rawVersion = tracePayload.schema_version;
  if (rawVersion === undefined || rawVersion === null) {
    return LEGACY_TRACE_DUMP_SCHEMA;
  }
  const parsed = Number(rawVersion);
  if (!Number.isInteger(parsed)) {
    throw new Error(`trace.json schema_version must be an integer (got ${String(rawVersion)})`);
  }
  if (!SUPPORTED_TRACE_DUMP_SCHEMAS.has(parsed)) {
    const supported = Array.from(SUPPORTED_TRACE_DUMP_SCHEMAS.values()).sort((a, b) => a - b);
    throw new Error(
      `trace.json schema_version ${parsed} is unsupported; supported schemas: ${supported.join(", ")}`
    );
  }
  return parsed;
}

function normalizeTraceEntryPointers(value: unknown): Record<string, unknown> | null {
  const entry = asRecordOrNull(value);
  if (!entry) {
    return null;
  }
  return {
    ...entry,
    D: resolveLegacyDomainPointer(entry),
    F: resolveLegacyFocusPointer(entry)
  };
}

function readWordEntryFocus(entry: Record<string, unknown> | null): string | null {
  if (!entry) {
    return null;
  }
  const phases = Array.isArray(entry.phases) ? entry.phases : [];
  for (const phaseValue of phases) {
    const phase = asRecordOrNull(phaseValue);
    if (!phase || phase.phase !== "word_entry_context") {
      continue;
    }
    const detail = asRecordOrNull(phase.detail);
    const focus = asNonEmptyString(detail?.entry_focus);
    if (focus) {
      return focus;
    }
  }
  return null;
}

function normalizeExitKind(
  value: unknown,
  exitBoundary: Record<string, unknown> | null
): "cut" | "glue" | "glue_maqqef" {
  const explicit = asNonEmptyString(value);
  if (explicit === "glue" || explicit === "glue_maqqef" || explicit === "cut") {
    return explicit;
  }
  const mode =
    asNonEmptyString(exitBoundary?.boundary_mode) ?? asNonEmptyString(exitBoundary?.mode);
  if (mode === "glue" || mode === "glue_maqqef") {
    return mode;
  }
  return "cut";
}

function normalizeWordIndex(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Number(parsed);
}

function normalizeWordSection(
  sectionValue: unknown,
  sectionIndex: number
): Record<string, unknown> {
  const section = asRecordOrNull(sectionValue);
  if (!section) {
    throw new Error(`word_sections[${sectionIndex}] must be an object`);
  }

  const rawEntries = Array.isArray(section.op_entries) ? section.op_entries : [];
  const opEntries = rawEntries.map((entry) => normalizeTraceEntryPointers(entry) ?? entry);
  const firstOp = asRecordOrNull(opEntries[0]);
  const lastOp = asRecordOrNull(opEntries[opEntries.length - 1]);
  const exitBoundary = normalizeTraceEntryPointers(section.exit_boundary);

  const incomingD =
    asNonEmptyString(section.incoming_D) ??
    asNonEmptyString(section.incomingD) ??
    resolveLegacyDomainPointer(firstOp);
  const incomingF =
    asNonEmptyString(section.incoming_F) ??
    asNonEmptyString(section.incomingF) ??
    readWordEntryFocus(firstOp) ??
    resolveLegacyFocusPointer(firstOp);
  const outgoingD =
    asNonEmptyString(section.outgoing_D) ??
    asNonEmptyString(section.outgoingD) ??
    resolveLegacyDomainPointer(exitBoundary ?? lastOp);
  const outgoingF =
    asNonEmptyString(section.outgoing_F) ??
    asNonEmptyString(section.outgoingF) ??
    resolveLegacyFocusPointer(exitBoundary ?? lastOp);

  return {
    ...section,
    word_index: normalizeWordIndex(
      section.word_index ?? section.wordIndex ?? section.index,
      sectionIndex + 1
    ),
    surface: String(section.surface ?? section.word ?? ""),
    op_entries: opEntries,
    exit_boundary: exitBoundary,
    incoming_D: incomingD,
    incoming_F: incomingF,
    outgoing_D: outgoingD,
    outgoing_F: outgoingF,
    exit_kind: normalizeExitKind(section.exit_kind ?? section.exitKind, exitBoundary)
  };
}

function normalizeVmStateDumpPointers(value: unknown, label: string): Record<string, unknown> {
  const stateDump = asRecord(value, label);
  const vm = asRecordOrNull(stateDump.vm) ?? {};
  return {
    ...stateDump,
    vm: {
      ...vm,
      D: normalizePointer(resolveLegacyDomainPointer(vm)),
      F: normalizePointer(resolveLegacyFocusPointer(vm)),
      OmegaId: normalizePointer(vm.OmegaId, OMEGA_HANDLE_ID)
    }
  };
}

function hasWordSectionPointerFields(section: Record<string, unknown>): boolean {
  return (
    ("incoming_D" in section || "incomingD" in section) &&
    ("incoming_F" in section || "incomingF" in section) &&
    ("outgoing_D" in section || "outgoingD" in section) &&
    ("outgoing_F" in section || "outgoingF" in section)
  );
}

function assertSchema2Pointers(args: {
  schemaVersion: number;
  wordSections: unknown[];
  finalDumpStateRaw: unknown;
  postResetStateRaw: unknown;
}): void {
  const { schemaVersion, wordSections, finalDumpStateRaw, postResetStateRaw } = args;
  if (schemaVersion !== TRACE_DUMP_SCHEMA) {
    return;
  }

  for (const [index, sectionValue] of wordSections.entries()) {
    const section = asRecordOrNull(sectionValue);
    if (!section) {
      throw new Error(
        `trace.json schema_version ${TRACE_DUMP_SCHEMA}: word_sections[${index}] must be an object`
      );
    }
    if (!hasWordSectionPointerFields(section)) {
      throw new Error(
        `trace.json schema_version ${TRACE_DUMP_SCHEMA}: word_sections[${index}] is missing incoming/outgoing D/F fields`
      );
    }
  }

  const finalDumpState = asRecord(finalDumpStateRaw, "final_dump_state");
  const finalVm = asRecordOrNull(finalDumpState.vm);
  if (!asNonEmptyString(finalVm?.D) || !asNonEmptyString(finalVm?.F)) {
    throw new Error(
      `trace.json schema_version ${TRACE_DUMP_SCHEMA}: final_dump_state.vm must include non-empty D and F`
    );
  }

  const postResetState = asRecord(postResetStateRaw, "post_reset_state");
  const postVm = asRecordOrNull(postResetState.vm);
  if (!asNonEmptyString(postVm?.D) || !asNonEmptyString(postVm?.F)) {
    throw new Error(
      `trace.json schema_version ${TRACE_DUMP_SCHEMA}: post_reset_state.vm must include non-empty D and F`
    );
  }
}

function normalizeTracePayloadForDerivedArtifacts(
  tracePayload: TracePayloadLike
): TracePayloadLike {
  const schemaVersion = normalizeTraceSchemaVersion(tracePayload);
  const wordSectionsRaw = tracePayload.word_sections;
  if (!Array.isArray(wordSectionsRaw)) {
    throw new Error("word_sections is missing or not an array");
  }

  const finalDumpState = normalizeVmStateDumpPointers(
    tracePayload.final_dump_state,
    "final_dump_state"
  );
  const postResetState = normalizeVmStateDumpPointers(
    tracePayload.post_reset_state,
    "post_reset_state"
  );

  assertSchema2Pointers({
    schemaVersion,
    wordSections: wordSectionsRaw,
    finalDumpStateRaw: tracePayload.final_dump_state,
    postResetStateRaw: tracePayload.post_reset_state
  });

  const normalizedWordSections = wordSectionsRaw.map((section, index) =>
    normalizeWordSection(section, index)
  );
  const deepTrace = Array.isArray(tracePayload.deep_trace)
    ? tracePayload.deep_trace.map((entry) => normalizeTraceEntryPointers(entry) ?? entry)
    : tracePayload.deep_trace;
  const finalState = normalizeVmStateDumpPointers(
    tracePayload.final_state ?? tracePayload.final_dump_state,
    "final_state"
  );

  return {
    ...tracePayload,
    schema_version: TRACE_DUMP_SCHEMA,
    word_sections: normalizedWordSections,
    deep_trace: deepTrace,
    final_dump_state: finalDumpState,
    post_reset_state: postResetState,
    final_state: finalState
  };
}

function asWordSections(value: unknown): WordSection[] {
  if (!Array.isArray(value)) {
    throw new Error("word_sections is missing or not an array");
  }
  return value as WordSection[];
}

function renderReportFromTracePayload(args: {
  tracePayload: TracePayloadLike;
  showPostReset: boolean;
}): string {
  const normalizedTrace = normalizeTracePayloadForDerivedArtifacts(args.tracePayload);
  const refKey = String(normalizedTrace.ref_key ?? "unknown");
  const cleanedText = String(normalizedTrace.cleaned_text ?? "");
  const sections = asWordSections(normalizedTrace.word_sections);
  const finalDumpState = asRecord(normalizedTrace.final_dump_state, "final_dump_state");
  const postResetState = asRecord(normalizedTrace.post_reset_state, "post_reset_state");

  return formatDeepTraceReport({
    refKey,
    cleanedText,
    sections,
    finalDumpState,
    postResetState,
    showPostReset: args.showPostReset
  });
}

function buildDotProvenanceHeader(provenance: DotProvenance): string {
  const lines = [
    `// trace_file_sha256: ${provenance.trace_file_sha256}`,
    `// graph_opts_sha256: ${provenance.graph_opts_sha256}`,
    `// graph_renderer_id: ${provenance.graph_renderer_id}`,
    `// dot_schema: ${provenance.dot_schema}`
  ];
  if (provenance.trace_semantic_sha256) {
    lines.push(`// trace_semantic_sha256: ${provenance.trace_semantic_sha256}`);
  }
  return `${lines.join("\n")}\n\n`;
}

function buildReportProvenanceHeader(provenance: ReportProvenance): string {
  const lines = [
    `# trace_file_sha256: ${provenance.trace_file_sha256}`,
    `# report_renderer_id: ${provenance.report_renderer_id}`,
    `# report_schema: ${provenance.report_schema}`
  ];
  if (provenance.trace_semantic_sha256) {
    lines.push(`# trace_semantic_sha256: ${provenance.trace_semantic_sha256}`);
  }
  return `${lines.join("\n")}\n\n`;
}

function wrapDotWithProvenance(dotBody: string, provenance: DotProvenance): string {
  return withTrailingNewline(`${buildDotProvenanceHeader(provenance)}${dotBody}`);
}

function wrapReportWithProvenance(reportBody: string, provenance: ReportProvenance): string {
  const trimmedBody = reportBody.endsWith("\n") ? reportBody.slice(0, -1) : reportBody;
  return withTrailingNewline(`${buildReportProvenanceHeader(provenance)}${trimmedBody}`);
}

function parseDotHeaderMap(dotText: string): Record<string, string> {
  const lines = dotText.split(/\r?\n/u);
  const out: Record<string, string> = {};
  for (const line of lines.slice(0, 64)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (!trimmed.startsWith("//")) {
      break;
    }
    const match = trimmed.match(/^\/\/\s*([a-z0-9_]+)\s*:\s*(.+?)\s*$/u);
    if (!match) {
      continue;
    }
    out[match[1]] = match[2];
  }
  return out;
}

function parseReportHeaderMap(reportText: string): Record<string, string> {
  const lines = reportText.split(/\r?\n/u);
  const out: Record<string, string> = {};
  for (const line of lines.slice(0, 64)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (!trimmed.startsWith("#")) {
      break;
    }
    const match = trimmed.match(/^#\s*([a-z0-9_]+)\s*:\s*(.+?)\s*$/u);
    if (!match) {
      continue;
    }
    out[match[1]] = match[2];
  }
  return out;
}

export function parseDotProvenance(dotText: string): ParsedDotProvenance {
  const map = parseDotHeaderMap(dotText);
  const schemaRaw = map.dot_schema;
  const parsedSchema = schemaRaw === undefined ? undefined : Number(schemaRaw);
  return {
    trace_file_sha256: map.trace_file_sha256,
    graph_opts_sha256: map.graph_opts_sha256,
    graph_renderer_id: map.graph_renderer_id,
    dot_schema:
      parsedSchema !== undefined && Number.isInteger(parsedSchema)
        ? Number(parsedSchema)
        : undefined,
    trace_semantic_sha256: map.trace_semantic_sha256
  };
}

export function parseReportProvenance(reportText: string): ParsedReportProvenance {
  const map = parseReportHeaderMap(reportText);
  const schemaRaw = map.report_schema;
  const parsedSchema = schemaRaw === undefined ? undefined : Number(schemaRaw);
  return {
    trace_file_sha256: map.trace_file_sha256,
    report_renderer_id: map.report_renderer_id,
    report_schema:
      parsedSchema !== undefined && Number.isInteger(parsedSchema)
        ? Number(parsedSchema)
        : undefined,
    trace_semantic_sha256: map.trace_semantic_sha256
  };
}

function verifyDotProvenanceForSkip(args: {
  parsed: ParsedDotProvenance;
  expectedGraphOptsSha256: string;
  graphRendererId: string;
}): string[] {
  const reasons: string[] = [];
  const { parsed } = args;

  if (!parsed.trace_file_sha256) {
    reasons.push("graph.dot missing trace_file_sha256 provenance");
  }

  if (!parsed.graph_opts_sha256) {
    reasons.push("graph.dot missing graph_opts_sha256 provenance");
  } else if (parsed.graph_opts_sha256 !== args.expectedGraphOptsSha256) {
    reasons.push(
      `graph.dot graph_opts_sha256 mismatch (expected ${args.expectedGraphOptsSha256}, got ${parsed.graph_opts_sha256})`
    );
  }

  if (!parsed.graph_renderer_id) {
    reasons.push("graph.dot missing graph_renderer_id provenance");
  } else if (parsed.graph_renderer_id !== args.graphRendererId) {
    reasons.push(
      `graph.dot graph_renderer_id mismatch (expected ${args.graphRendererId}, got ${parsed.graph_renderer_id})`
    );
  }

  if (parsed.dot_schema === undefined) {
    reasons.push("graph.dot missing dot_schema provenance");
  } else if (!SUPPORTED_DOT_SCHEMAS.has(parsed.dot_schema)) {
    reasons.push(`graph.dot dot_schema unsupported (${parsed.dot_schema})`);
  }

  return reasons;
}

function verifyReportProvenanceForSkip(args: {
  parsed: ParsedReportProvenance;
  reportRendererId: string;
}): string[] {
  const reasons: string[] = [];
  const { parsed } = args;

  if (!parsed.trace_file_sha256) {
    reasons.push("trace.txt missing trace_file_sha256 provenance");
  }

  if (!parsed.report_renderer_id) {
    reasons.push("trace.txt missing report_renderer_id provenance");
  } else if (parsed.report_renderer_id !== args.reportRendererId) {
    reasons.push(
      `trace.txt report_renderer_id mismatch (expected ${args.reportRendererId}, got ${parsed.report_renderer_id})`
    );
  }

  if (parsed.report_schema === undefined) {
    reasons.push("trace.txt missing report_schema provenance");
  } else if (!SUPPORTED_REPORT_SCHEMAS.has(parsed.report_schema)) {
    reasons.push(`trace.txt report_schema unsupported (${parsed.report_schema})`);
  }

  return reasons;
}

function verifyExistingSkipArtifacts(args: {
  existing: ExistingSkipArtifacts;
  expectedGraphOptsSha256: string;
  rendererIds: RendererIds;
  requireDot: boolean;
}): ExistingSkipCheckResult {
  const reasons: string[] = [];
  const { existing } = args;

  if (!existing.traceJsonExists) {
    if (existing.reportText || existing.dotText) {
      reasons.push("trace.json is missing while derived artifacts exist");
    }
    return {
      skippable: false,
      reasons,
      parsedDotProvenance: existing.dotText ? parseDotProvenance(existing.dotText) : null,
      parsedReportProvenance: existing.reportText
        ? parseReportProvenance(existing.reportText)
        : null
    };
  }

  let parsedReportProvenance: ParsedReportProvenance | null = null;
  if (!existing.reportText) {
    reasons.push("trace.txt is missing");
  } else {
    parsedReportProvenance = parseReportProvenance(existing.reportText);
    reasons.push(
      ...verifyReportProvenanceForSkip({
        parsed: parsedReportProvenance,
        reportRendererId: args.rendererIds.reportRendererId
      })
    );
  }

  let parsedDotProvenance: ParsedDotProvenance | null = null;
  if (args.requireDot) {
    if (!existing.dotText) {
      reasons.push("graph.dot is missing");
    } else {
      parsedDotProvenance = parseDotProvenance(existing.dotText);
      reasons.push(
        ...verifyDotProvenanceForSkip({
          parsed: parsedDotProvenance,
          expectedGraphOptsSha256: args.expectedGraphOptsSha256,
          graphRendererId: args.rendererIds.graphRendererId
        })
      );
    }
  }

  if (
    parsedReportProvenance?.trace_file_sha256 &&
    parsedDotProvenance?.trace_file_sha256 &&
    parsedReportProvenance.trace_file_sha256 !== parsedDotProvenance.trace_file_sha256
  ) {
    reasons.push(
      `trace_file_sha256 mismatch between trace.txt and graph.dot (${parsedReportProvenance.trace_file_sha256} vs ${parsedDotProvenance.trace_file_sha256})`
    );
  }

  if (
    parsedReportProvenance?.trace_semantic_sha256 &&
    parsedDotProvenance?.trace_semantic_sha256 &&
    parsedReportProvenance.trace_semantic_sha256 !== parsedDotProvenance.trace_semantic_sha256
  ) {
    reasons.push(
      `trace_semantic_sha256 mismatch between trace.txt and graph.dot (${parsedReportProvenance.trace_semantic_sha256} vs ${parsedDotProvenance.trace_semantic_sha256})`
    );
  }

  return {
    skippable: reasons.length === 0,
    reasons,
    parsedDotProvenance,
    parsedReportProvenance
  };
}

function verifyDotProvenance(args: {
  parsed: ParsedDotProvenance;
  expected: ExpectedProvenance;
}): string[] {
  const reasons: string[] = [];
  const { parsed, expected } = args;

  if (!parsed.trace_file_sha256) {
    reasons.push("graph.dot missing trace_file_sha256 provenance");
  } else if (parsed.trace_file_sha256 !== expected.traceFileSha256) {
    reasons.push(
      `graph.dot trace_file_sha256 mismatch (expected ${expected.traceFileSha256}, got ${parsed.trace_file_sha256})`
    );
  }

  if (!parsed.graph_opts_sha256) {
    reasons.push("graph.dot missing graph_opts_sha256 provenance");
  } else if (parsed.graph_opts_sha256 !== expected.graphOptsSha256) {
    reasons.push(
      `graph.dot graph_opts_sha256 mismatch (expected ${expected.graphOptsSha256}, got ${parsed.graph_opts_sha256})`
    );
  }

  if (!parsed.graph_renderer_id) {
    reasons.push("graph.dot missing graph_renderer_id provenance");
  } else if (parsed.graph_renderer_id !== expected.graphRendererId) {
    reasons.push(
      `graph.dot graph_renderer_id mismatch (expected ${expected.graphRendererId}, got ${parsed.graph_renderer_id})`
    );
  }

  if (parsed.dot_schema === undefined) {
    reasons.push("graph.dot missing dot_schema provenance");
  } else if (!SUPPORTED_DOT_SCHEMAS.has(parsed.dot_schema)) {
    reasons.push(`graph.dot dot_schema unsupported (${parsed.dot_schema})`);
  }

  if (
    parsed.trace_semantic_sha256 !== undefined &&
    parsed.trace_semantic_sha256 !== expected.traceSemanticSha256
  ) {
    reasons.push(
      `graph.dot trace_semantic_sha256 mismatch (expected ${expected.traceSemanticSha256}, got ${parsed.trace_semantic_sha256})`
    );
  }

  return reasons;
}

function verifyReportProvenance(args: {
  parsed: ParsedReportProvenance;
  expected: ExpectedProvenance;
}): string[] {
  const reasons: string[] = [];
  const { parsed, expected } = args;

  if (!parsed.trace_file_sha256) {
    reasons.push("trace.txt missing trace_file_sha256 provenance");
  } else if (parsed.trace_file_sha256 !== expected.traceFileSha256) {
    reasons.push(
      `trace.txt trace_file_sha256 mismatch (expected ${expected.traceFileSha256}, got ${parsed.trace_file_sha256})`
    );
  }

  if (!parsed.report_renderer_id) {
    reasons.push("trace.txt missing report_renderer_id provenance");
  } else if (parsed.report_renderer_id !== expected.reportRendererId) {
    reasons.push(
      `trace.txt report_renderer_id mismatch (expected ${expected.reportRendererId}, got ${parsed.report_renderer_id})`
    );
  }

  if (parsed.report_schema === undefined) {
    reasons.push("trace.txt missing report_schema provenance");
  } else if (!SUPPORTED_REPORT_SCHEMAS.has(parsed.report_schema)) {
    reasons.push(`trace.txt report_schema unsupported (${parsed.report_schema})`);
  }

  if (
    parsed.trace_semantic_sha256 !== undefined &&
    parsed.trace_semantic_sha256 !== expected.traceSemanticSha256
  ) {
    reasons.push(
      `trace.txt trace_semantic_sha256 mismatch (expected ${expected.traceSemanticSha256}, got ${parsed.trace_semantic_sha256})`
    );
  }

  return reasons;
}

async function resolveRendererIds(): Promise<RendererIds> {
  if (!rendererIdsCache) {
    rendererIdsCache = (async () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      let packageName = "hebrew-operator-vm";
      let packageVersion = "unknown";
      try {
        const raw = await fs.readFile(pkgPath, "utf8");
        const parsed = JSON.parse(raw) as { name?: string; version?: string };
        if (typeof parsed.name === "string" && parsed.name.trim()) {
          packageName = parsed.name.trim();
        }
        if (typeof parsed.version === "string" && parsed.version.trim()) {
          packageVersion = parsed.version.trim();
        }
      } catch {
        // fallback below
      }

      const gitHint =
        process.env.GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? process.env.SOURCE_COMMIT ?? "";
      const normalizedHint =
        typeof gitHint === "string" && gitHint.trim() ? `+${gitHint.trim()}` : "";
      const base = `${packageName}@${packageVersion}${normalizedHint}`;
      return {
        graphRendererId: `${base}/pasuk-graph`,
        reportRendererId: `${base}/pasuk-report`
      };
    })();
  }
  return rendererIdsCache;
}

export function parseArgs(argv: string[]): PasukTraceCorpusOptions {
  const opts: PasukTraceCorpusOptions = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    lang: "he",
    normalizeFinals: false,
    keepTeamim: true,
    includeSnapshots: true,
    showPostReset: true,
    continueOnError: false,
    skipExisting: false,
    verifyExisting: false,
    repairExisting: false,
    books: [],
    fromRef: "",
    toRef: "",
    limit: 0,
    concurrency: DEFAULT_CONCURRENCY,
    progressEvery: DEFAULT_PROGRESS_EVERY,
    printProgress: true,
    emitDot: true,
    graphTheme: "light",
    graphMode: "full",
    graphBoundary: "cluster",
    graphPrune: "orphans",
    graphPruneKeepKinds: "",
    graphPruneKeepIds: "",
    graphLayout: "boot",
    graphPrettyIds: true,
    graphLegend: null,
    graphWords: "cluster"
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

    const outDirOpt = readOptionValue(argv, index, "--out-dir");
    if (outDirOpt) {
      opts.outDir = outDirOpt.value;
      index = outDirOpt.nextIndex;
      continue;
    }

    const langOpt = readOptionValue(argv, index, "--lang");
    if (langOpt) {
      opts.lang = ensureLanguage(langOpt.value);
      index = langOpt.nextIndex;
      continue;
    }

    const bookOpt = readOptionValue(argv, index, "--book");
    if (bookOpt) {
      if (bookOpt.value.trim()) {
        opts.books.push(bookOpt.value.trim());
      }
      index = bookOpt.nextIndex;
      continue;
    }

    const fromOpt = readOptionValue(argv, index, "--from-ref");
    if (fromOpt) {
      opts.fromRef = fromOpt.value;
      index = fromOpt.nextIndex;
      continue;
    }

    const toOpt = readOptionValue(argv, index, "--to-ref");
    if (toOpt) {
      opts.toRef = toOpt.value;
      index = toOpt.nextIndex;
      continue;
    }

    const limitOpt = readOptionValue(argv, index, "--limit");
    if (limitOpt) {
      opts.limit = parsePositiveInt(limitOpt.value, "--limit");
      index = limitOpt.nextIndex;
      continue;
    }

    const concurrencyOpt = readOptionValue(argv, index, "--concurrency");
    if (concurrencyOpt) {
      opts.concurrency = parsePositiveInt(concurrencyOpt.value, "--concurrency");
      index = concurrencyOpt.nextIndex;
      continue;
    }

    const progressEveryOpt = readOptionValue(argv, index, "--progress-every");
    if (progressEveryOpt) {
      opts.progressEvery = parsePositiveInt(progressEveryOpt.value, "--progress-every");
      index = progressEveryOpt.nextIndex;
      continue;
    }

    const themeOpt = readOptionValue(argv, index, "--theme");
    if (themeOpt) {
      opts.graphTheme = ensureGraphTheme(themeOpt.value);
      index = themeOpt.nextIndex;
      continue;
    }

    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.graphMode = ensureGraphMode(modeOpt.value);
      index = modeOpt.nextIndex;
      continue;
    }

    const boundaryOpt = readOptionValue(argv, index, "--boundary");
    if (boundaryOpt) {
      opts.graphBoundary = ensureGraphBoundary(boundaryOpt.value);
      index = boundaryOpt.nextIndex;
      continue;
    }

    const pruneOpt = readOptionValue(argv, index, "--prune");
    if (pruneOpt) {
      opts.graphPrune = ensureGraphPrune(pruneOpt.value);
      index = pruneOpt.nextIndex;
      continue;
    }

    const pruneKeepKindsOpt = readOptionValue(argv, index, "--prune-keep-kinds");
    if (pruneKeepKindsOpt) {
      opts.graphPruneKeepKinds = pruneKeepKindsOpt.value;
      index = pruneKeepKindsOpt.nextIndex;
      continue;
    }

    const pruneKeepIdsOpt = readOptionValue(argv, index, "--prune-keep-ids");
    if (pruneKeepIdsOpt) {
      opts.graphPruneKeepIds = pruneKeepIdsOpt.value;
      index = pruneKeepIdsOpt.nextIndex;
      continue;
    }

    const layoutOpt = readOptionValue(argv, index, "--layout");
    if (layoutOpt) {
      opts.graphLayout = ensureLayout(layoutOpt.value);
      index = layoutOpt.nextIndex;
      continue;
    }

    const wordsOpt = readOptionValue(argv, index, "--words");
    if (wordsOpt) {
      opts.graphWords = ensureGraphWords(wordsOpt.value);
      index = wordsOpt.nextIndex;
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
    if (arg === "--include-snapshots") {
      opts.includeSnapshots = true;
      continue;
    }
    if (arg === "--no-snapshots") {
      opts.includeSnapshots = false;
      continue;
    }
    if (arg === "--show-post-reset") {
      opts.showPostReset = true;
      continue;
    }
    if (arg === "--hide-post-reset" || arg === "--no-show-post-reset") {
      opts.showPostReset = false;
      continue;
    }
    if (arg === "--continue-on-error") {
      opts.continueOnError = true;
      continue;
    }
    if (arg === "--skip-existing") {
      opts.skipExisting = true;
      continue;
    }
    if (arg === "--verify-existing") {
      opts.verifyExisting = true;
      continue;
    }
    if (arg === "--repair-existing") {
      opts.repairExisting = true;
      continue;
    }
    if (arg === "--pretty-ids") {
      opts.graphPrettyIds = true;
      continue;
    }
    if (arg === "--no-pretty-ids") {
      opts.graphPrettyIds = false;
      continue;
    }
    if (arg === "--legend") {
      opts.graphLegend = true;
      continue;
    }
    if (arg === "--no-legend") {
      opts.graphLegend = false;
      continue;
    }
    if (arg === "--no-dot") {
      opts.emitDot = false;
      continue;
    }
    if (arg === "--no-print-progress") {
      opts.printProgress = false;
      continue;
    }
  }

  if (opts.verifyExisting && opts.repairExisting) {
    throw new Error("--verify-existing and --repair-existing cannot be used together.");
  }

  return opts;
}

export async function collectRefs(
  payload: TorahPayload,
  opts: Pick<PasukTraceCorpusOptions, "books" | "fromRef" | "toRef" | "limit">
): Promise<CollectedRef[]> {
  const requestedBooks = new Set(opts.books.map((value) => normalizeBookName(value)));
  const refs: CollectedRef[] = [];

  for (const book of payload.books ?? []) {
    const bookName = String(book.name ?? "").trim();
    if (!bookName) {
      continue;
    }
    if (requestedBooks.size > 0 && !requestedBooks.has(normalizeBookName(bookName))) {
      continue;
    }
    const bookSlug = slugifyBook(bookName);
    for (const [chapterIndex, chapter] of (book.chapters ?? []).entries()) {
      const chapterNumber = Number.isInteger(chapter.n) ? Number(chapter.n) : chapterIndex + 1;
      for (const [verseIndex, verse] of (chapter.verses ?? []).entries()) {
        const verseNumber = Number.isInteger(verse.n) ? Number(verse.n) : verseIndex + 1;
        refs.push({
          refKey: `${bookName}/${chapterNumber}/${verseNumber}`,
          book: bookName,
          chapter: chapterNumber,
          verse: verseNumber,
          bookSlug
        });
      }
    }
  }

  return selectRefWindow({
    refs,
    fromRef: opts.fromRef,
    toRef: opts.toRef,
    limit: opts.limit
  });
}

async function loadRenderDotFromTraceJson(): Promise<RenderDotFromTraceJson> {
  const modulePath = path.resolve(process.cwd(), "scripts", "render", "pasukGraph.mjs");
  const loaded = (await dynamicImport(modulePath)) as {
    renderDotFromTraceJson?: RenderDotFromTraceJson;
  };
  if (typeof loaded.renderDotFromTraceJson !== "function") {
    throw new Error(`renderDotFromTraceJson export not found in ${modulePath}`);
  }
  return loaded.renderDotFromTraceJson;
}

function buildTraceDumpPayload(args: {
  result: Awaited<ReturnType<typeof runPasukTrace>>;
  opts: PasukTraceCorpusOptions;
  inputPath: string;
}): TracePayloadLike {
  const { result, opts, inputPath } = args;
  return {
    schema_version: TRACE_DUMP_SCHEMA,
    generated_at: new Date().toISOString(),
    ref_key: result.ref_key,
    options: {
      input: inputPath,
      ref: result.ref_key,
      text: "",
      lang: opts.lang,
      normalize_finals: opts.normalizeFinals,
      keep_teamim: opts.keepTeamim,
      include_snapshots: opts.includeSnapshots,
      show_post_reset: opts.showPostReset
    },
    source_text: result.source_text,
    cleaned_text: result.cleaned_text,
    prepared_tokens: result.prepared_tokens,
    deep_trace: result.trace,
    verse_snapshots: result.verse_snapshots,
    final_dump_state: result.final_dump_state,
    post_reset_state: result.post_reset_state,
    word_sections: result.word_sections,
    final_state: result.final_state
  };
}

type TraceArtifacts = {
  tracePayload: TracePayloadLike;
  traceJsonText: string;
  reportBody: string;
};

function appendChunk(buffer: string, chunk: Buffer | string, limit = 8192): string {
  if (buffer.length >= limit) {
    return buffer;
  }
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  const combined = `${buffer}${text}`;
  return combined.length > limit ? combined.slice(0, limit) : combined;
}

function formatChildOutput(stderr: string, stdout: string): string {
  const parts: string[] = [];
  const stderrTrimmed = stderr.trim();
  if (stderrTrimmed.length > 0) {
    parts.push(`stderr=${JSON.stringify(stderrTrimmed)}`);
  }
  const stdoutTrimmed = stdout.trim();
  if (stdoutTrimmed.length > 0) {
    parts.push(`stdout=${JSON.stringify(stdoutTrimmed)}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

async function runPasukTraceSubprocess(args: {
  inputPath: string;
  refKey: string;
  opts: PasukTraceCorpusOptions;
  traceJsonPath: string;
  traceReportPath: string;
}): Promise<void> {
  const scriptPath = path.resolve(process.cwd(), "scripts", "pasuk-trace.mjs");
  const cliArgs = [
    scriptPath,
    `--input=${args.inputPath}`,
    `--ref=${args.refKey}`,
    `--lang=${args.opts.lang}`,
    `--out-json=${args.traceJsonPath}`,
    `--out-report=${args.traceReportPath}`,
    args.opts.normalizeFinals ? "--normalize-finals" : "--no-normalize-finals",
    args.opts.keepTeamim ? "--keep-teamim" : "--strip-teamim",
    args.opts.includeSnapshots ? "--include-snapshots" : "--no-snapshots",
    args.opts.showPostReset ? "--show-post-reset" : "--hide-post-reset",
    "--no-print-report"
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, cliArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    let stdout = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = appendChunk(stderr, chunk);
    });
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = appendChunk(stdout, chunk);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const status = signal ? `signal=${signal}` : `code=${String(code)}`;
      reject(
        new Error(
          `pasuk-trace subprocess failed for ${args.refKey} (${status}).${formatChildOutput(
            stderr,
            stdout
          )}`
        )
      );
    });
  });
}

async function executeTraceInProcess(args: {
  inputPath: string;
  refKey: string;
  opts: PasukTraceCorpusOptions;
}): Promise<TraceArtifacts> {
  const result = await runPasukTrace({
    input: args.inputPath,
    ref: args.refKey,
    text: "",
    lang: args.opts.lang,
    normalizeFinals: args.opts.normalizeFinals,
    keepTeamim: args.opts.keepTeamim,
    allowRuntimeErrors: false,
    includeSnapshots: args.opts.includeSnapshots,
    showPostReset: args.opts.showPostReset,
    outJson: "",
    outReport: "",
    printReport: false
  });

  const tracePayload = buildTraceDumpPayload({
    result,
    opts: args.opts,
    inputPath: args.inputPath
  });

  return {
    tracePayload,
    traceJsonText: withTrailingNewline(JSON.stringify(tracePayload, null, 2)),
    reportBody: result.report_text
  };
}

async function executeTraceInSubprocess(args: {
  inputPath: string;
  refKey: string;
  opts: PasukTraceCorpusOptions;
  traceJsonPath: string;
  traceReportPath: string;
}): Promise<TraceArtifacts> {
  await runPasukTraceSubprocess({
    inputPath: args.inputPath,
    refKey: args.refKey,
    opts: args.opts,
    traceJsonPath: args.traceJsonPath,
    traceReportPath: args.traceReportPath
  });

  const [traceJsonTextRaw, reportTextRaw] = await Promise.all([
    fs.readFile(args.traceJsonPath, "utf8"),
    fs.readFile(args.traceReportPath, "utf8")
  ]);

  const tracePayload = parseTracePayloadIfPossible(traceJsonTextRaw);
  if (!tracePayload) {
    throw new Error(`pasuk-trace subprocess produced invalid trace.json for ${args.refKey}`);
  }

  return {
    tracePayload,
    traceJsonText: withTrailingNewline(traceJsonTextRaw),
    reportBody: reportTextRaw
  };
}

async function executeTrace(args: {
  mode: TraceExecutionMode;
  inputPath: string;
  refKey: string;
  opts: PasukTraceCorpusOptions;
  traceJsonPath: string;
  traceReportPath: string;
}): Promise<TraceArtifacts> {
  if (args.mode === "subprocess") {
    return executeTraceInSubprocess({
      inputPath: args.inputPath,
      refKey: args.refKey,
      opts: args.opts,
      traceJsonPath: args.traceJsonPath,
      traceReportPath: args.traceReportPath
    });
  }
  return executeTraceInProcess({
    inputPath: args.inputPath,
    refKey: args.refKey,
    opts: args.opts
  });
}

function buildGraphOptions(opts: PasukTraceCorpusOptions): Record<string, unknown> {
  const legendValue = opts.graphLegend === null ? opts.graphLayout === "boot" : opts.graphLegend;
  return {
    theme: opts.graphTheme,
    mode: opts.graphMode,
    boundary: opts.graphBoundary,
    prune: opts.graphPrune,
    pruneKeepKinds: opts.graphPruneKeepKinds,
    pruneKeepIds: opts.graphPruneKeepIds,
    layout: opts.graphLayout,
    prettyIds: opts.graphPrettyIds,
    legend: legendValue,
    wordsMode: opts.graphWords
  };
}

function formatProgress(args: {
  total: number;
  done: number;
  processed: number;
  repairedExisting: number;
  skippedExisting: number;
  errors: number;
  elapsedMs: number;
  refKey: string;
}): string {
  const percent = args.total > 0 ? ((args.done / args.total) * 100).toFixed(2) : "100.00";
  const elapsedSec = (args.elapsedMs / 1000).toFixed(1);
  return [
    "pasuk-trace-corpus:",
    `done=${args.done}/${args.total}`,
    `(${percent}%)`,
    `processed=${args.processed}`,
    `repaired_existing=${args.repairedExisting}`,
    `skipped_existing=${args.skippedExisting}`,
    `errors=${args.errors}`,
    `elapsed=${elapsedSec}s`,
    `ref=${args.refKey}`
  ].join(" ");
}

function matchesBookSelection(payload: TorahPayload, requestedBooks: string[]): void {
  if (requestedBooks.length === 0) {
    return;
  }
  const available = new Set(
    (payload.books ?? [])
      .map((book) => String(book.name ?? "").trim())
      .filter((name) => name.length > 0)
      .map((name) => normalizeBookName(name))
  );
  const missing = requestedBooks.filter((book) => !available.has(normalizeBookName(book)));
  if (missing.length > 0) {
    throw new Error(`Unknown --book values: ${missing.join(", ")}`);
  }
}

async function readTextIfExists(filePath: string | null): Promise<string | null> {
  if (!filePath) {
    return null;
  }
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fileExists(filePath: string | null): Promise<boolean> {
  if (!filePath) {
    return false;
  }
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function parseTracePayloadIfPossible(traceJsonText: string | null): TracePayloadLike | null {
  if (!traceJsonText) {
    return null;
  }
  try {
    const parsed = JSON.parse(traceJsonText) as TracePayloadLike;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function readExistingArtifacts(args: {
  traceJsonPath: string;
  traceReportPath: string;
  dotPath: string | null;
}): Promise<ExistingArtifacts> {
  const [traceJsonText, reportText, dotText] = await Promise.all([
    readTextIfExists(args.traceJsonPath),
    readTextIfExists(args.traceReportPath),
    readTextIfExists(args.dotPath)
  ]);

  return {
    traceJsonText,
    tracePayload: parseTracePayloadIfPossible(traceJsonText),
    reportText,
    dotText
  };
}

async function readExistingSkipArtifacts(args: {
  traceJsonPath: string;
  traceReportPath: string;
  dotPath: string | null;
}): Promise<ExistingSkipArtifacts> {
  const [traceJsonExists, reportText, dotText] = await Promise.all([
    fileExists(args.traceJsonPath),
    readTextIfExists(args.traceReportPath),
    readTextIfExists(args.dotPath)
  ]);
  return {
    traceJsonExists,
    reportText,
    dotText
  };
}

function verifyExistingArtifacts(args: {
  existing: ExistingArtifacts;
  expectedGraphOptsSha256: string;
  rendererIds: RendererIds;
  requireDot: boolean;
}): ExistingCheckResult {
  const reasons: string[] = [];
  const { existing } = args;

  if (!existing.traceJsonText) {
    if (existing.reportText || existing.dotText) {
      reasons.push("trace.json is missing while derived artifacts exist");
    }
    return {
      skippable: false,
      canRepairFromTrace: false,
      reasons,
      traceFileSha256: null,
      traceSemanticSha256: null,
      parsedDotProvenance: existing.dotText ? parseDotProvenance(existing.dotText) : null,
      parsedReportProvenance: existing.reportText
        ? parseReportProvenance(existing.reportText)
        : null
    };
  }

  if (!existing.tracePayload) {
    reasons.push("trace.json exists but is not valid JSON");
    return {
      skippable: false,
      canRepairFromTrace: false,
      reasons,
      traceFileSha256: null,
      traceSemanticSha256: null,
      parsedDotProvenance: existing.dotText ? parseDotProvenance(existing.dotText) : null,
      parsedReportProvenance: existing.reportText
        ? parseReportProvenance(existing.reportText)
        : null
    };
  }

  const traceFileSha256 = sha256Text(existing.traceJsonText);
  const traceSemanticSha256 = computeTraceSemanticSha256(existing.tracePayload);
  const expected: ExpectedProvenance = {
    traceFileSha256,
    traceSemanticSha256,
    graphOptsSha256: args.expectedGraphOptsSha256,
    graphRendererId: args.rendererIds.graphRendererId,
    reportRendererId: args.rendererIds.reportRendererId
  };

  let parsedReportProvenance: ParsedReportProvenance | null = null;
  if (!existing.reportText) {
    reasons.push("trace.txt is missing");
  } else {
    parsedReportProvenance = parseReportProvenance(existing.reportText);
    reasons.push(...verifyReportProvenance({ parsed: parsedReportProvenance, expected }));
  }

  let parsedDotProvenance: ParsedDotProvenance | null = null;
  if (args.requireDot) {
    if (!existing.dotText) {
      reasons.push("graph.dot is missing");
    } else {
      parsedDotProvenance = parseDotProvenance(existing.dotText);
      reasons.push(...verifyDotProvenance({ parsed: parsedDotProvenance, expected }));
    }
  }

  return {
    skippable: reasons.length === 0,
    canRepairFromTrace: true,
    reasons,
    traceFileSha256,
    traceSemanticSha256,
    parsedDotProvenance,
    parsedReportProvenance
  };
}

function readReportStats(reportText: string): {
  words: number;
  traceEntries: number;
} {
  const lines = reportText.split(/\r?\n/u);
  let words = 0;
  let traceEntries = 0;
  for (const line of lines) {
    if (/^\s*WORD\s+\d+\s+│/u.test(line)) {
      words += 1;
    }
    if (/^\s*τ=\d+\s+│/u.test(line)) {
      traceEntries += 1;
    }
  }
  return {
    words,
    traceEntries
  };
}

function buildRefIndexRowFromSkipArtifacts(args: {
  outDir: string;
  ref: CollectedRef;
  traceJsonPath: string;
  traceReportPath: string;
  dotPath: string | null;
  reportText: string;
  dotText: string | null;
  reportProvenance: ParsedReportProvenance;
  dotProvenance: ParsedDotProvenance | null;
  fallbackSnapshots: number;
}): RefIndexRow {
  const stats = readReportStats(args.reportText);
  const traceFileSha = args.reportProvenance.trace_file_sha256 ?? "";
  const traceSemanticSha =
    args.reportProvenance.trace_semantic_sha256 ?? args.dotProvenance?.trace_semantic_sha256;
  const reportRendererId = args.reportProvenance.report_renderer_id ?? "unknown";
  const reportSchema = args.reportProvenance.report_schema ?? REPORT_SCHEMA;

  return {
    ref_key: args.ref.refKey,
    book: args.ref.book,
    book_slug: args.ref.bookSlug,
    chapter: args.ref.chapter,
    verse: args.ref.verse,
    output: {
      trace_json: toPosixRelative(args.outDir, args.traceJsonPath),
      trace_report: toPosixRelative(args.outDir, args.traceReportPath),
      graph_dot: args.dotPath ? toPosixRelative(args.outDir, args.dotPath) : null
    },
    stats: {
      words: stats.words,
      trace_entries: stats.traceEntries,
      snapshots: args.fallbackSnapshots
    },
    sha256: {
      trace_json: traceFileSha,
      trace_report: sha256Text(args.reportText),
      graph_dot: args.dotText === null ? null : sha256Text(args.dotText)
    },
    provenance: {
      trace_file_sha256: traceFileSha,
      trace_semantic_sha256: traceSemanticSha ?? null,
      graph_opts_sha256: args.dotProvenance?.graph_opts_sha256 ?? null,
      graph_renderer_id: args.dotProvenance?.graph_renderer_id ?? null,
      dot_schema: args.dotProvenance?.dot_schema ?? null,
      report_renderer_id: reportRendererId,
      report_schema: reportSchema
    }
  };
}

async function loadExistingIndexRows(outDir: string): Promise<Map<string, RefIndexRow>> {
  const indexPath = path.join(outDir, "refs", "index.json");
  const text = await readTextIfExists(indexPath);
  const rows = new Map<string, RefIndexRow>();
  if (!text) {
    return rows;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      return rows;
    }
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const row = entry as Partial<RefIndexRow>;
      if (typeof row.ref_key !== "string" || row.ref_key.length === 0) {
        continue;
      }
      rows.set(row.ref_key, row as RefIndexRow);
    }
  } catch {
    return rows;
  }
  return rows;
}

function isCachedRowReusable(args: {
  row: RefIndexRow;
  outDir: string;
  ref: CollectedRef;
  traceJsonPath: string;
  traceReportPath: string;
  dotPath: string | null;
  graphOptsSha256: string;
  rendererIds: RendererIds;
  requireDot: boolean;
}): boolean {
  const expectedTraceJson = toPosixRelative(args.outDir, args.traceJsonPath);
  const expectedTraceReport = toPosixRelative(args.outDir, args.traceReportPath);
  const expectedDot = args.dotPath ? toPosixRelative(args.outDir, args.dotPath) : null;

  if (args.row.ref_key !== args.ref.refKey) {
    return false;
  }
  if (
    args.row.book !== args.ref.book ||
    args.row.chapter !== args.ref.chapter ||
    args.row.verse !== args.ref.verse
  ) {
    return false;
  }
  if (args.row.output.trace_json !== expectedTraceJson) {
    return false;
  }
  if (args.row.output.trace_report !== expectedTraceReport) {
    return false;
  }
  if ((args.row.output.graph_dot ?? null) !== expectedDot) {
    return false;
  }

  const provenance = args.row.provenance;
  if (!provenance) {
    return false;
  }
  if (provenance.report_renderer_id !== args.rendererIds.reportRendererId) {
    return false;
  }
  if (!SUPPORTED_REPORT_SCHEMAS.has(provenance.report_schema)) {
    return false;
  }
  if (args.requireDot) {
    if (provenance.graph_opts_sha256 !== args.graphOptsSha256) {
      return false;
    }
    if (provenance.graph_renderer_id !== args.rendererIds.graphRendererId) {
      return false;
    }
    if (provenance.dot_schema === null || !SUPPORTED_DOT_SCHEMAS.has(provenance.dot_schema)) {
      return false;
    }
  }

  return true;
}

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return "(no details)";
  }
  return reasons.join("; ");
}

function buildRefIndexRow(args: {
  outDir: string;
  ref: CollectedRef;
  traceJsonPath: string;
  traceReportPath: string;
  dotPath: string | null;
  traceJsonText: string;
  tracePayload: TracePayloadLike;
  traceReportText: string;
  graphDotText: string | null;
  traceFileSha256: string;
  traceSemanticSha256: string;
  reportProvenance: ReportProvenance;
  dotProvenance: DotProvenance | null;
}): RefIndexRow {
  const deepTrace = Array.isArray(args.tracePayload.deep_trace) ? args.tracePayload.deep_trace : [];
  const wordSections = Array.isArray(args.tracePayload.word_sections)
    ? args.tracePayload.word_sections
    : [];
  const snapshots = Array.isArray(args.tracePayload.verse_snapshots)
    ? args.tracePayload.verse_snapshots
    : [];

  return {
    ref_key: args.ref.refKey,
    book: args.ref.book,
    book_slug: args.ref.bookSlug,
    chapter: args.ref.chapter,
    verse: args.ref.verse,
    output: {
      trace_json: toPosixRelative(args.outDir, args.traceJsonPath),
      trace_report: toPosixRelative(args.outDir, args.traceReportPath),
      graph_dot: args.dotPath ? toPosixRelative(args.outDir, args.dotPath) : null
    },
    stats: {
      words: wordSections.length,
      trace_entries: deepTrace.length,
      snapshots: snapshots.length
    },
    sha256: {
      trace_json: sha256Text(args.traceJsonText),
      trace_report: sha256Text(args.traceReportText),
      graph_dot: args.graphDotText === null ? null : sha256Text(args.graphDotText)
    },
    provenance: {
      trace_file_sha256: args.traceFileSha256,
      trace_semantic_sha256: args.traceSemanticSha256,
      graph_opts_sha256: args.dotProvenance?.graph_opts_sha256 ?? null,
      graph_renderer_id: args.dotProvenance?.graph_renderer_id ?? null,
      dot_schema: args.dotProvenance?.dot_schema ?? null,
      report_renderer_id: args.reportProvenance.report_renderer_id,
      report_schema: args.reportProvenance.report_schema
    }
  };
}

async function regenerateDerivedFromTrace(args: {
  tracePayload: TracePayloadLike;
  traceJsonText: string;
  traceReportPath: string;
  dotPath: string | null;
  graphOpts: Record<string, unknown>;
  graphOptsSha256: string;
  renderDotFromTraceJson: RenderDotFromTraceJson | null;
  rendererIds: RendererIds;
  showPostReset: boolean;
}): Promise<{
  traceReportText: string;
  graphDotText: string | null;
  rowReportProvenance: ReportProvenance;
  rowDotProvenance: DotProvenance | null;
}> {
  const normalizedTracePayload = normalizeTracePayloadForDerivedArtifacts(args.tracePayload);
  const traceFileSha256 = sha256Text(args.traceJsonText);
  const traceSemanticSha256 = computeTraceSemanticSha256(normalizedTracePayload);

  const reportBody = renderReportFromTracePayload({
    tracePayload: normalizedTracePayload,
    showPostReset: args.showPostReset
  });

  const reportProvenance: ReportProvenance = {
    trace_file_sha256: traceFileSha256,
    report_renderer_id: args.rendererIds.reportRendererId,
    report_schema: REPORT_SCHEMA,
    trace_semantic_sha256: traceSemanticSha256
  };
  const traceReportText = wrapReportWithProvenance(reportBody, reportProvenance);

  let dotProvenance: DotProvenance | null = null;
  let graphDotText: string | null = null;
  if (args.dotPath && args.renderDotFromTraceJson) {
    const dotRaw = args.renderDotFromTraceJson(normalizedTracePayload, args.graphOpts);
    dotProvenance = {
      trace_file_sha256: traceFileSha256,
      graph_opts_sha256: args.graphOptsSha256,
      graph_renderer_id: args.rendererIds.graphRendererId,
      dot_schema: DOT_SCHEMA,
      trace_semantic_sha256: traceSemanticSha256
    };
    graphDotText = wrapDotWithProvenance(dotRaw, dotProvenance);
  }

  await fs.writeFile(args.traceReportPath, traceReportText, "utf8");
  if (args.dotPath && graphDotText !== null) {
    await fs.writeFile(args.dotPath, graphDotText, "utf8");
  }

  return {
    traceReportText,
    graphDotText,
    rowReportProvenance: reportProvenance,
    rowDotProvenance: dotProvenance
  };
}

export async function runPasukTraceCorpus(
  opts: PasukTraceCorpusOptions,
  deps: PasukTraceCorpusDeps = {}
): Promise<{ manifestPath: string; indexPath: string; manifest: CorpusManifest }> {
  const startMs = Date.now();
  const inputPath = path.resolve(opts.input);
  const outDir = path.resolve(opts.outDir);
  const inputRaw = await fs.readFile(inputPath, "utf8");
  const payload = JSON.parse(inputRaw) as TorahPayload;

  matchesBookSelection(payload, opts.books);
  const allRefs = await collectRefs(payload, {
    books: opts.books,
    fromRef: opts.fromRef,
    toRef: opts.toRef,
    limit: opts.limit
  });

  if (allRefs.length === 0) {
    throw new Error("No verses matched the selected filters.");
  }

  const indexRows: RefIndexRow[] = [];
  const errors: RunError[] = [];
  let processed = 0;
  let repairedExisting = 0;
  let skippedExisting = 0;
  let done = 0;

  const rendererIds = deps.rendererIds ?? (await resolveRendererIds());
  const renderDotFromTraceJson = opts.emitDot
    ? (deps.renderDotFromTraceJson ?? (await loadRenderDotFromTraceJson()))
    : null;
  const traceExecutionMode = deps.traceExecutionMode ?? "in-process";
  const graphOpts = buildGraphOptions(opts);
  const graphOptsSha256 = sha256Text(stableStringify(graphOpts));

  if (shouldResetOutputBeforeRun(opts)) {
    await resetOutputDirForFullRun(outDir);
  }

  await fs.mkdir(outDir, { recursive: true });
  const existingIndexRowsByRef = await loadExistingIndexRows(outDir);

  let fatalError: Error | null = null;
  let nextRefIndex = 0;
  const workerCount = Math.min(opts.concurrency, allRefs.length);

  const processRef = async (ref: CollectedRef): Promise<void> => {
    const verseDir = path.join(outDir, "refs", ref.bookSlug, pad3(ref.chapter), pad3(ref.verse));
    const traceJsonPath = path.join(verseDir, "trace.json");
    const traceReportPath = path.join(verseDir, "trace.txt");
    const dotPath = opts.emitDot ? path.join(verseDir, "graph.dot") : null;

    try {
      const existingSkip = await readExistingSkipArtifacts({
        traceJsonPath,
        traceReportPath,
        dotPath
      });

      const hasAnyExisting =
        existingSkip.traceJsonExists ||
        existingSkip.reportText !== null ||
        existingSkip.dotText !== null;

      if (hasAnyExisting && !opts.verifyExisting && !opts.repairExisting) {
        const check = verifyExistingSkipArtifacts({
          existing: existingSkip,
          expectedGraphOptsSha256: graphOptsSha256,
          rendererIds,
          requireDot: opts.emitDot
        });

        if (
          check.skippable &&
          existingSkip.reportText &&
          check.parsedReportProvenance?.trace_file_sha256
        ) {
          const cachedRow = existingIndexRowsByRef.get(ref.refKey);
          if (
            cachedRow &&
            isCachedRowReusable({
              row: cachedRow,
              outDir,
              ref,
              traceJsonPath,
              traceReportPath,
              dotPath,
              graphOptsSha256,
              rendererIds,
              requireDot: opts.emitDot
            })
          ) {
            indexRows.push(cachedRow);
            skippedExisting += 1;
            return;
          }

          indexRows.push(
            buildRefIndexRowFromSkipArtifacts({
              outDir,
              ref,
              traceJsonPath,
              traceReportPath,
              dotPath,
              reportText: existingSkip.reportText,
              dotText: opts.emitDot ? existingSkip.dotText : null,
              reportProvenance: check.parsedReportProvenance,
              dotProvenance: opts.emitDot ? check.parsedDotProvenance : null,
              fallbackSnapshots: cachedRow?.stats.snapshots ?? 1
            })
          );
          skippedExisting += 1;
          return;
        }
      }

      if (hasAnyExisting && opts.skipExisting && (opts.verifyExisting || opts.repairExisting)) {
        const existing = await readExistingArtifacts({
          traceJsonPath,
          traceReportPath,
          dotPath
        });
        const check = verifyExistingArtifacts({
          existing,
          expectedGraphOptsSha256: graphOptsSha256,
          rendererIds,
          requireDot: opts.emitDot
        });

        if (
          check.skippable &&
          existing.traceJsonText &&
          existing.tracePayload &&
          existing.reportText
        ) {
          const reportProvenance =
            check.parsedReportProvenance &&
            check.parsedReportProvenance.trace_file_sha256 &&
            check.parsedReportProvenance.report_renderer_id &&
            check.parsedReportProvenance.report_schema !== undefined
              ? {
                  trace_file_sha256: check.parsedReportProvenance.trace_file_sha256,
                  report_renderer_id: check.parsedReportProvenance.report_renderer_id,
                  report_schema: check.parsedReportProvenance.report_schema,
                  trace_semantic_sha256: check.parsedReportProvenance.trace_semantic_sha256
                }
              : {
                  trace_file_sha256: check.traceFileSha256 ?? sha256Text(existing.traceJsonText),
                  report_renderer_id: rendererIds.reportRendererId,
                  report_schema: REPORT_SCHEMA,
                  trace_semantic_sha256:
                    check.traceSemanticSha256 ?? computeTraceSemanticSha256(existing.tracePayload)
                };

          const dotProvenance =
            opts.emitDot &&
            check.parsedDotProvenance &&
            check.parsedDotProvenance.trace_file_sha256 &&
            check.parsedDotProvenance.graph_opts_sha256 &&
            check.parsedDotProvenance.graph_renderer_id &&
            check.parsedDotProvenance.dot_schema !== undefined
              ? {
                  trace_file_sha256: check.parsedDotProvenance.trace_file_sha256,
                  graph_opts_sha256: check.parsedDotProvenance.graph_opts_sha256,
                  graph_renderer_id: check.parsedDotProvenance.graph_renderer_id,
                  dot_schema: check.parsedDotProvenance.dot_schema,
                  trace_semantic_sha256: check.parsedDotProvenance.trace_semantic_sha256
                }
              : null;

          indexRows.push(
            buildRefIndexRow({
              outDir,
              ref,
              traceJsonPath,
              traceReportPath,
              dotPath,
              traceJsonText: existing.traceJsonText,
              tracePayload: existing.tracePayload,
              traceReportText: existing.reportText,
              graphDotText: opts.emitDot ? existing.dotText : null,
              traceFileSha256: check.traceFileSha256 ?? sha256Text(existing.traceJsonText),
              traceSemanticSha256:
                check.traceSemanticSha256 ?? computeTraceSemanticSha256(existing.tracePayload),
              reportProvenance,
              dotProvenance
            })
          );
          skippedExisting += 1;
          return;
        }

        if (opts.verifyExisting) {
          throw new Error(
            `verify-existing failed for ${ref.refKey}: ${formatReasons(check.reasons)}`
          );
        }

        if (
          opts.repairExisting &&
          check.canRepairFromTrace &&
          existing.traceJsonText &&
          existing.tracePayload
        ) {
          await fs.mkdir(path.dirname(traceReportPath), { recursive: true });
          if (dotPath) {
            await fs.mkdir(path.dirname(dotPath), { recursive: true });
          }

          const repaired = await regenerateDerivedFromTrace({
            tracePayload: existing.tracePayload,
            traceJsonText: existing.traceJsonText,
            traceReportPath,
            dotPath,
            graphOpts,
            graphOptsSha256,
            renderDotFromTraceJson,
            rendererIds,
            showPostReset: opts.showPostReset
          });

          indexRows.push(
            buildRefIndexRow({
              outDir,
              ref,
              traceJsonPath,
              traceReportPath,
              dotPath,
              traceJsonText: existing.traceJsonText,
              tracePayload: existing.tracePayload,
              traceReportText: repaired.traceReportText,
              graphDotText: repaired.graphDotText,
              traceFileSha256: sha256Text(existing.traceJsonText),
              traceSemanticSha256: computeTraceSemanticSha256(existing.tracePayload),
              reportProvenance: repaired.rowReportProvenance,
              dotProvenance: repaired.rowDotProvenance
            })
          );

          repairedExisting += 1;
          skippedExisting += 1;
          return;
        }
      }

      const traceArtifacts = await executeTrace({
        mode: traceExecutionMode,
        inputPath,
        refKey: ref.refKey,
        opts,
        traceJsonPath,
        traceReportPath
      });
      const normalizedTracePayload = normalizeTracePayloadForDerivedArtifacts(
        traceArtifacts.tracePayload
      );
      const traceJsonText = traceArtifacts.traceJsonText;
      const traceFileSha256 = sha256Text(traceJsonText);
      const traceSemanticSha256 = computeTraceSemanticSha256(normalizedTracePayload);

      const reportProvenance: ReportProvenance = {
        trace_file_sha256: traceFileSha256,
        report_renderer_id: rendererIds.reportRendererId,
        report_schema: REPORT_SCHEMA,
        trace_semantic_sha256: traceSemanticSha256
      };
      const traceReportText = wrapReportWithProvenance(traceArtifacts.reportBody, reportProvenance);

      let dotProvenance: DotProvenance | null = null;
      let graphDotText: string | null = null;
      if (opts.emitDot && renderDotFromTraceJson) {
        const dotRaw = renderDotFromTraceJson(normalizedTracePayload, graphOpts);
        dotProvenance = {
          trace_file_sha256: traceFileSha256,
          graph_opts_sha256: graphOptsSha256,
          graph_renderer_id: rendererIds.graphRendererId,
          dot_schema: DOT_SCHEMA,
          trace_semantic_sha256: traceSemanticSha256
        };
        graphDotText = wrapDotWithProvenance(dotRaw, dotProvenance);
      }

      await fs.mkdir(verseDir, { recursive: true });
      await fs.writeFile(traceJsonPath, traceJsonText, "utf8");
      await fs.writeFile(traceReportPath, traceReportText, "utf8");
      if (dotPath && graphDotText !== null) {
        await fs.writeFile(dotPath, graphDotText, "utf8");
      }

      indexRows.push(
        buildRefIndexRow({
          outDir,
          ref,
          traceJsonPath,
          traceReportPath,
          dotPath,
          traceJsonText,
          tracePayload: traceArtifacts.tracePayload,
          traceReportText,
          graphDotText,
          traceFileSha256,
          traceSemanticSha256,
          reportProvenance,
          dotProvenance
        })
      );
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        ref_key: ref.refKey,
        message
      });
      if (!opts.continueOnError) {
        fatalError ??= new Error(`pasuk-trace-corpus failed at ${ref.refKey}: ${message}`);
      }
    } finally {
      done += 1;
      if (opts.printProgress && (done % opts.progressEvery === 0 || done === allRefs.length)) {
        console.log(
          formatProgress({
            total: allRefs.length,
            done,
            processed,
            repairedExisting,
            skippedExisting,
            errors: errors.length,
            elapsedMs: Date.now() - startMs,
            refKey: ref.refKey
          })
        );
      }
    }
  };

  const runWorker = async (): Promise<void> => {
    while (!fatalError) {
      const currentRefIndex = nextRefIndex;
      if (currentRefIndex >= allRefs.length) {
        return;
      }
      nextRefIndex += 1;
      const ref = allRefs[currentRefIndex];
      if (!ref) {
        return;
      }
      await processRef(ref);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  if (fatalError) {
    throw fatalError;
  }

  indexRows.sort((left, right) => {
    if (left.book !== right.book) {
      return left.book.localeCompare(right.book);
    }
    if (left.chapter !== right.chapter) {
      return left.chapter - right.chapter;
    }
    return left.verse - right.verse;
  });

  const indexPath = path.join(outDir, "refs", "index.json");
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, `${JSON.stringify(indexRows, null, 2)}\n`, "utf8");

  const manifest: CorpusManifest = {
    schema_version: 1,
    corpus: "torah",
    artifact_set: "pasuk-trace-corpus",
    generated_at: new Date().toISOString(),
    input: {
      path: inputPath
    },
    options: {
      lang: opts.lang,
      normalize_finals: opts.normalizeFinals,
      keep_teamim: opts.keepTeamim,
      include_snapshots: opts.includeSnapshots,
      show_post_reset: opts.showPostReset,
      continue_on_error: opts.continueOnError,
      skip_existing: opts.skipExisting,
      verify_existing: opts.verifyExisting,
      repair_existing: opts.repairExisting,
      books: opts.books,
      from_ref: opts.fromRef,
      to_ref: opts.toRef,
      limit: opts.limit,
      concurrency: opts.concurrency,
      emit_dot: opts.emitDot,
      graph: {
        theme: opts.graphTheme,
        mode: opts.graphMode,
        boundary: opts.graphBoundary,
        prune: opts.graphPrune,
        prune_keep_kinds: opts.graphPruneKeepKinds,
        prune_keep_ids: opts.graphPruneKeepIds,
        layout: opts.graphLayout,
        pretty_ids: opts.graphPrettyIds,
        legend: opts.graphLegend,
        words: opts.graphWords
      }
    },
    totals: {
      discovered_refs: allRefs.length,
      queued_refs: allRefs.length,
      processed,
      repaired_existing: repairedExisting,
      skipped_existing: skippedExisting,
      errors: errors.length,
      duration_ms: Date.now() - startMs
    },
    index: {
      path: toPosixRelative(outDir, indexPath),
      rows: indexRows.length
    },
    errors
  };

  const manifestPath = path.join(outDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    manifestPath,
    indexPath,
    manifest
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(rawArgv);
  const result = await runPasukTraceCorpus(opts, {
    traceExecutionMode: "subprocess"
  });

  console.log(
    [
      "pasuk-trace-corpus: complete",
      `processed=${result.manifest.totals.processed}`,
      `repaired_existing=${result.manifest.totals.repaired_existing}`,
      `skipped_existing=${result.manifest.totals.skipped_existing}`,
      `errors=${result.manifest.totals.errors}`,
      `index=${result.indexPath}`,
      `manifest=${result.manifestPath}`
    ].join(" ")
  );
}
