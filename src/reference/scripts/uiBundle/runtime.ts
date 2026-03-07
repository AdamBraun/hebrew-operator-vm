import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type Command = "run" | "verify";

type VersionContract = {
  trace_version: string;
  semantics_version: string;
  render_version: string;
};

type WordRef = {
  book: string;
  chapter: number;
  verse: number;
  token_index: number;
};

type VerseRef = {
  book: string;
  chapter: number;
  verse: number;
};

type WordTraceEvent = {
  kind: string;
  index: number;
  tau: number;
  source: string;
  payload: Record<string, unknown>;
};

type WordTraceRecord = {
  record_kind: "WORD_TRACE";
  trace_version: string;
  semantics_version: string;
  render_version: string;
  ref: WordRef;
  ref_key: string;
  surface: string;
  token_ids: number[];
  events: WordTraceEvent[];
  skeleton?: string[];
  flow?: string;
  mode?: "WORD" | "VERSE" | "WINDOW";
  window_start?: number;
  canonical_hash?: string;
  extensions?: Record<string, unknown>;
};

type PrimaryAccent = {
  word_index: number;
  class: "DISJUNCTIVE" | "CONJUNCTIVE" | "NONE";
  codepoint: string | null;
  name: string | null;
  precedence: number;
  observed_teamim: string[];
};

type PhraseNodeSpan = {
  start: number;
  end: number;
};

type PhraseLeafNode = {
  id: string;
  node_type: "LEAF";
  span: PhraseNodeSpan;
  word_index: number;
  surface: string;
  accent: PrimaryAccent;
};

type PhraseJoinNode = {
  id: string;
  node_type: "JOIN";
  span: PhraseNodeSpan;
  fold: "LEFT";
  left: PhraseNode;
  right: PhraseNode;
};

type PhraseSplitNode = {
  id: string;
  node_type: "SPLIT";
  span: PhraseNodeSpan;
  split_word_index: number;
  split_accent: {
    codepoint: string;
    name: string | null;
    precedence: number;
  };
  left: PhraseNode;
  right: PhraseNode;
};

type PhraseNode = PhraseLeafNode | PhraseJoinNode | PhraseSplitNode;

type VersePhraseTreeRecord = {
  ref_key: string;
  ref: VerseRef;
  words: string[];
  primary_accents: PrimaryAccent[];
  tree: PhraseNode;
  phrase_version: string;
};

type WordPhraseRoleRecord = {
  ref_key: string;
  word_index: number;
  surface: string;
  primary_accent: PrimaryAccent;
  phrase_role: "HEAD" | "TAIL" | "JOIN" | "SPLIT";
  phrase_path: string[];
  clause_id: string;
  subclause_id: string;
  phrase_version: string;
};

type ParaphraseRecord = {
  ref_key: string;
  style: "strict" | "poetic";
  text: string;
  metadata?: Record<string, unknown>;
};

type BundleFileEntry = {
  path: string;
  kind: string;
  bytes: number;
  sha256: string;
  records?: number;
};

type BundleNavigation = {
  books: Array<{
    book: string;
    verse_count: number;
    word_count: number;
    chapters: Array<{
      chapter: number;
      verse_count: number;
      word_count: number;
    }>;
  }>;
};

type UiBundleManifest = {
  schema_version: 1;
  bundle_type: "letters.ui_bundle";
  bundle_version: "1.0.0";
  corpus: string;
  artifact_set: string;
  generated_at: string;
  versions: VersionContract;
  version_contract: VersionContract;
  chunk_strategy: "book_chapter_verse";
  indexes: {
    refs: string;
  };
  counts: {
    word_traces: number;
    verse_phrase_trees: number;
    word_phrase_roles: number;
    paraphrase_records: number;
    word_chunks: number;
    verse_chunks: number;
    paraphrase_chunks: number;
    optional_index_files: number;
  };
  navigation: BundleNavigation;
  inputs: {
    word_traces: {
      path: string;
      rows: number;
      sha256: string;
    };
    verse_phrase_trees: {
      path: string;
      rows: number;
      sha256: string;
    };
    word_phrase_roles: {
      path: string;
      rows: number;
      sha256: string;
    };
    optional_source_manifest_path?: string;
  };
  files: BundleFileEntry[];
};

type SourceManifestInfo = {
  path: string;
  corpus?: string;
  artifactSet?: string;
  generatedAt?: string;
  versionContract?: VersionContract;
};

type ParseResult = {
  command: Command;
  opts: UiBundleOptions;
};

type JsonlRow = {
  line: number;
  value: unknown;
};

type ReadValidatedJsonlResult<T> = {
  records: T[];
  sha256: string;
};

export type UiBundleOptions = {
  wordTracesPath: string;
  versePhraseTreesPath: string;
  wordPhraseRolesPath: string;
  sourceManifestPath: string;
  bundleDir: string;
  uiPublicDir: string;
  indexDir: string;
  outputsGenesisDir: string;
  renderDir: string;
  skipCopy: boolean;
};

export type RunBundleResult = {
  bundleDir: string;
  uiPublicDir: string;
  manifestPath: string;
  files: number;
  wordChunks: number;
  verseChunks: number;
  paraphraseChunks: number;
  wordRecords: number;
  verseRecords: number;
  roleRecords: number;
  paraphraseRecords: number;
};

export type VerifyBundleResult = {
  checkedFiles: number;
  checkedBytes: number;
  bundleDir: string;
  uiPublicDir: string;
  mirrorChecked: boolean;
};

export const DEFAULT_WORD_TRACES = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
export const DEFAULT_VERSE_PHRASE_TREES = path.resolve(
  process.cwd(),
  "corpus",
  "verse_phrase_trees.jsonl"
);
export const DEFAULT_WORD_PHRASE_ROLES = path.resolve(
  process.cwd(),
  "corpus",
  "word_phrase_roles.jsonl"
);
export const DEFAULT_SOURCE_MANIFEST = path.resolve(process.cwd(), "manifest.json");
export const FALLBACK_SOURCE_MANIFEST = path.resolve(
  process.cwd(),
  "outputs",
  "torah-corpus",
  "latest",
  "manifest.json"
);
export const DEFAULT_BUNDLE_DIR = path.resolve(process.cwd(), "ui-bundles", "latest");
export const DEFAULT_UI_PUBLIC_DIR = path.resolve(
  process.cwd(),
  "packages",
  "ui",
  "public",
  "data",
  "latest"
);
export const DEFAULT_INDEX_DIR = path.resolve(process.cwd(), "index");
export const DEFAULT_OUTPUTS_GENESIS_DIR = path.resolve(process.cwd(), "outputs", "genesis");
export const DEFAULT_RENDER_DIR = path.resolve(process.cwd(), "render");

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/u;
const TRACE_VERSION_PATTERN = /^1\.\d+\.\d+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;
const WORD_REF_KEY_PATTERN = /^[^/]+\/\d+\/\d+\/\d+$/u;
const VERSE_REF_KEY_PATTERN = /^[^/]+\/\d+\/\d+$/u;
const PARAPHRASE_REF_KEY_PATTERN = /^[^/]+\/\d+\/\d+(?:\/\d+)?$/u;
const CODEPOINT_PATTERN = /^U\+[0-9A-F]{4,6}$/u;

const WORD_TRACE_ALLOWED_KEYS = [
  "record_kind",
  "trace_version",
  "semantics_version",
  "render_version",
  "ref",
  "ref_key",
  "surface",
  "token_ids",
  "events",
  "skeleton",
  "flow",
  "mode",
  "window_start",
  "canonical_hash",
  "extensions"
] as const;

const WORD_TRACE_REQUIRED_KEYS = [
  "record_kind",
  "trace_version",
  "semantics_version",
  "render_version",
  "ref",
  "ref_key",
  "surface",
  "token_ids",
  "events"
] as const;

const WORD_TRACE_EVENT_ALLOWED_KEYS = ["kind", "index", "tau", "source", "payload"] as const;

const TRACE_EVENT_KINDS = new Set([
  "ALEPH.ALIAS",
  "GIMEL.BESTOW",
  "DALET.BOUNDARY_CLOSE",
  "RESH.BOUNDARY_CLOSE",
  "HE.HEAD_WITH_LEG",
  "HE.DECLARE",
  "HE.DECLARE_BREATH",
  "HE.DECLARE_PIN",
  "HE.DECLARE_ALIAS",
  "ZAYIN.GATE",
  "HET.COMPARTMENT",
  "TET.COVERT",
  "LAMED.ENDPOINT",
  "MEM.OPEN",
  "FINAL_MEM.CLOSE",
  "NUN.SUPPORT_DEBT",
  "SAMEKH.SUPPORT_DISCHARGE",
  "PE.UTTER",
  "TSADI.ALIGN",
  "QOF.HEAD_WITH_LEG",
  "QOF.APPROX",
  "SHIN.FORK",
  "TAV.FINALIZE",
  "FINAL_NUN.SUPPORT_DEBT",
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "FINAL_PE.UTTER_CLOSE",
  "FINAL_TSADI.ALIGN_FINAL",
  "SPACE.SUPPORT_DISCHARGE",
  "SPACE.BOUNDARY_AUTO_CLOSE",
  "SPACE.MEM_AUTO_CLOSE",
  "ERROR.RUNTIME",
  "ERROR.UNKNOWN_SIGNATURE",
  "EXTENSION"
]);

const TRACE_EVENT_KINDS_NO_EXTENSION = new Set(
  Array.from(TRACE_EVENT_KINDS).filter((kind) => kind !== "EXTENSION")
);

const TRACE_EVENT_SOURCES = new Set([
  "vm_event",
  "derived_obligation",
  "derived_boundary",
  "error",
  "extension"
]);

const FLOW_MODES = new Set(["WORD", "VERSE", "WINDOW"]);
const PHRASE_ROLES = new Set(["HEAD", "TAIL", "JOIN", "SPLIT"]);
const PRIMARY_ACCENT_CLASSES = new Set(["DISJUNCTIVE", "CONJUNCTIVE", "NONE"]);
const PARAPHRASE_STYLES = new Set(["strict", "poetic"]);

const VERSE_TREE_ALLOWED_KEYS = [
  "ref_key",
  "ref",
  "words",
  "primary_accents",
  "tree",
  "phrase_version"
] as const;

const WORD_ROLE_ALLOWED_KEYS = [
  "ref_key",
  "word_index",
  "surface",
  "primary_accent",
  "phrase_role",
  "phrase_path",
  "clause_id",
  "subclause_id",
  "phrase_version"
] as const;

const PRIMARY_ACCENT_ALLOWED_KEYS = [
  "word_index",
  "class",
  "codepoint",
  "name",
  "precedence",
  "observed_teamim"
] as const;

const NODE_SPAN_ALLOWED_KEYS = ["start", "end"] as const;

const PHRASE_LEAF_ALLOWED_KEYS = [
  "id",
  "node_type",
  "span",
  "word_index",
  "surface",
  "accent"
] as const;

const PHRASE_JOIN_ALLOWED_KEYS = ["id", "node_type", "span", "fold", "left", "right"] as const;

const PHRASE_SPLIT_ALLOWED_KEYS = [
  "id",
  "node_type",
  "span",
  "split_word_index",
  "split_accent",
  "left",
  "right"
] as const;

const PHRASE_SPLIT_ACCENT_ALLOWED_KEYS = ["codepoint", "name", "precedence"] as const;

const PARAPHRASE_ALLOWED_KEYS = ["ref_key", "style", "text", "metadata"] as const;

const NULL_GENERATED_AT = "1970-01-01T00:00:00.000Z";

function sha256Hex(content: string | Uint8Array): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function toPosixPath(value: string): string {
  return String(value).split(path.sep).join("/");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failContract(sourcePath: string, line: number, detail: string): never {
  throw new Error(`ui:bundle contract violation in ${sourcePath}: line ${line} ${detail}`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  sourcePath: string,
  line: number,
  label: string
): void {
  const allowedSet = new Set<string>(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      failContract(sourcePath, line, `${label} has unknown field '${key}'`);
    }
  }
}

function assertHasRequiredKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  sourcePath: string,
  line: number,
  label: string
): void {
  for (const key of required) {
    if (!(key in value)) {
      failContract(sourcePath, line, `${label} is missing required field '${key}'`);
    }
  }
}

function assertString(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string,
  requireNonEmpty = false
): string {
  if (typeof value !== "string") {
    failContract(sourcePath, line, `${label} must be a string`);
  }
  if (requireNonEmpty && value.length === 0) {
    failContract(sourcePath, line, `${label} must be non-empty`);
  }
  return value;
}

function assertInt(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string,
  min: number
): number {
  if (!Number.isInteger(value)) {
    failContract(sourcePath, line, `${label} must be an integer`);
  }
  const numeric = Number(value);
  if (numeric < min) {
    failContract(sourcePath, line, `${label} must be >= ${min}`);
  }
  return numeric;
}

function assertArray(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string,
  minLength = 0
): unknown[] {
  if (!Array.isArray(value)) {
    failContract(sourcePath, line, `${label} must be an array`);
  }
  if (value.length < minLength) {
    failContract(sourcePath, line, `${label} must contain at least ${minLength} item(s)`);
  }
  return value;
}

function assertRecord(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string
): Record<string, unknown> {
  if (!isObject(value)) {
    failContract(sourcePath, line, `${label} must be an object`);
  }
  return value;
}

function assertPattern(
  value: string,
  pattern: RegExp,
  sourcePath: string,
  line: number,
  label: string
): void {
  if (!pattern.test(value)) {
    failContract(sourcePath, line, `${label} does not match expected format`);
  }
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function compareRefKeyLike(left: string, right: string): number {
  const leftParts = String(left).split("/");
  const rightParts = String(right).split("/");
  const maxLen = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLen; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";

    if (leftPart === rightPart) {
      continue;
    }

    const leftNumeric = /^[0-9]+$/u.test(leftPart);
    const rightNumeric = /^[0-9]+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) {
      const delta = Number(leftPart) - Number(rightPart);
      if (delta !== 0) {
        return delta;
      }
      continue;
    }

    return compareText(leftPart, rightPart);
  }

  return 0;
}

function readOptionValue(
  argv: string[],
  index: number,
  optionName: string
): { value: string; nextIndex: number } | null {
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

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/ui-bundle.mjs [run] [--word-traces=path] [--verse-phrase-trees=path] [--word-phrase-roles=path]"
  );
  console.log(
    "  node scripts/ui-bundle.mjs verify [--bundle-dir=path] [--ui-public-dir=path] [--skip-copy]"
  );
  console.log("");
  console.log("Options:");
  console.log(`  --word-traces=${DEFAULT_WORD_TRACES}`);
  console.log(`  --verse-phrase-trees=${DEFAULT_VERSE_PHRASE_TREES}`);
  console.log(`  --word-phrase-roles=${DEFAULT_WORD_PHRASE_ROLES}`);
  console.log(`  --manifest=${DEFAULT_SOURCE_MANIFEST} (fallback: ${FALLBACK_SOURCE_MANIFEST})`);
  console.log(`  --index-dir=${DEFAULT_INDEX_DIR}`);
  console.log(`  --outputs-genesis-dir=${DEFAULT_OUTPUTS_GENESIS_DIR}`);
  console.log(`  --render-dir=${DEFAULT_RENDER_DIR}`);
  console.log(`  --bundle-dir=${DEFAULT_BUNDLE_DIR}`);
  console.log(`  --ui-public-dir=${DEFAULT_UI_PUBLIC_DIR}`);
  console.log("  --skip-copy=true to skip mirroring bundle into packages/ui/public/data/latest");
}

export function parseArgs(argv: string[]): ParseResult {
  const args = [...argv];
  let command: Command = "run";

  if (args.length > 0 && !args[0]?.startsWith("-")) {
    const maybeCommand = args.shift();
    if (maybeCommand === "run" || maybeCommand === "verify") {
      command = maybeCommand;
    } else {
      throw new Error(`Unknown command '${String(maybeCommand)}'`);
    }
  }

  const opts: UiBundleOptions = {
    wordTracesPath: DEFAULT_WORD_TRACES,
    versePhraseTreesPath: DEFAULT_VERSE_PHRASE_TREES,
    wordPhraseRolesPath: DEFAULT_WORD_PHRASE_ROLES,
    sourceManifestPath: "",
    bundleDir: DEFAULT_BUNDLE_DIR,
    uiPublicDir: DEFAULT_UI_PUBLIC_DIR,
    indexDir: DEFAULT_INDEX_DIR,
    outputsGenesisDir: DEFAULT_OUTPUTS_GENESIS_DIR,
    renderDir: DEFAULT_RENDER_DIR,
    skipCopy: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const wordTracesOpt = readOptionValue(args, index, "--word-traces");
    if (wordTracesOpt) {
      opts.wordTracesPath = path.resolve(wordTracesOpt.value);
      index = wordTracesOpt.nextIndex;
      continue;
    }

    const verseTreesOpt = readOptionValue(args, index, "--verse-phrase-trees");
    if (verseTreesOpt) {
      opts.versePhraseTreesPath = path.resolve(verseTreesOpt.value);
      index = verseTreesOpt.nextIndex;
      continue;
    }

    const wordRolesOpt = readOptionValue(args, index, "--word-phrase-roles");
    if (wordRolesOpt) {
      opts.wordPhraseRolesPath = path.resolve(wordRolesOpt.value);
      index = wordRolesOpt.nextIndex;
      continue;
    }

    const manifestOpt = readOptionValue(args, index, "--manifest");
    if (manifestOpt) {
      opts.sourceManifestPath = path.resolve(manifestOpt.value);
      index = manifestOpt.nextIndex;
      continue;
    }

    const bundleOpt = readOptionValue(args, index, "--bundle-dir");
    if (bundleOpt) {
      opts.bundleDir = path.resolve(bundleOpt.value);
      index = bundleOpt.nextIndex;
      continue;
    }

    const uiPublicOpt = readOptionValue(args, index, "--ui-public-dir");
    if (uiPublicOpt) {
      opts.uiPublicDir = path.resolve(uiPublicOpt.value);
      index = uiPublicOpt.nextIndex;
      continue;
    }

    const indexDirOpt = readOptionValue(args, index, "--index-dir");
    if (indexDirOpt) {
      opts.indexDir = path.resolve(indexDirOpt.value);
      index = indexDirOpt.nextIndex;
      continue;
    }

    const outputsGenesisOpt = readOptionValue(args, index, "--outputs-genesis-dir");
    if (outputsGenesisOpt) {
      opts.outputsGenesisDir = path.resolve(outputsGenesisOpt.value);
      index = outputsGenesisOpt.nextIndex;
      continue;
    }

    const renderDirOpt = readOptionValue(args, index, "--render-dir");
    if (renderDirOpt) {
      opts.renderDir = path.resolve(renderDirOpt.value);
      index = renderDirOpt.nextIndex;
      continue;
    }

    if (arg === "--skip-copy") {
      opts.skipCopy = true;
      continue;
    }

    const skipCopyOpt = readOptionValue(args, index, "--skip-copy");
    if (skipCopyOpt) {
      const normalized = String(skipCopyOpt.value).trim().toLowerCase();
      opts.skipCopy = normalized === "1" || normalized === "true" || normalized === "yes";
      index = skipCopyOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument '${arg}'`);
  }

  if (!opts.sourceManifestPath) {
    opts.sourceManifestPath = "";
  }

  return {
    command,
    opts
  };
}

function parseJsonlRows(text: string, sourcePath: string): JsonlRow[] {
  const rows: JsonlRow[] = [];
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const line = index + 1;
    try {
      rows.push({
        line,
        value: JSON.parse(trimmed)
      });
    } catch (error) {
      throw new Error(
        `ui:bundle failed to parse JSONL in ${sourcePath}: line ${line} invalid JSON (${String(error)})`
      );
    }
  }

  return rows;
}

function validateWordRef(value: unknown, sourcePath: string, line: number, label: string): WordRef {
  const record = assertRecord(value, sourcePath, line, label);
  assertExactKeys(record, ["book", "chapter", "verse", "token_index"], sourcePath, line, label);

  const book = assertString(record.book, sourcePath, line, `${label}.book`, true);
  const chapter = assertInt(record.chapter, sourcePath, line, `${label}.chapter`, 1);
  const verse = assertInt(record.verse, sourcePath, line, `${label}.verse`, 1);
  const tokenIndex = assertInt(record.token_index, sourcePath, line, `${label}.token_index`, 1);

  return {
    book,
    chapter,
    verse,
    token_index: tokenIndex
  };
}

function validateVerseRef(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string
): VerseRef {
  const record = assertRecord(value, sourcePath, line, label);
  assertExactKeys(record, ["book", "chapter", "verse"], sourcePath, line, label);

  return {
    book: assertString(record.book, sourcePath, line, `${label}.book`, true),
    chapter: assertInt(record.chapter, sourcePath, line, `${label}.chapter`, 1),
    verse: assertInt(record.verse, sourcePath, line, `${label}.verse`, 1)
  };
}

function validatePrimaryAccent(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string
): PrimaryAccent {
  const record = assertRecord(value, sourcePath, line, label);
  assertExactKeys(record, PRIMARY_ACCENT_ALLOWED_KEYS, sourcePath, line, label);

  const wordIndex = assertInt(record.word_index, sourcePath, line, `${label}.word_index`, 1);
  const accentClass = assertString(record.class, sourcePath, line, `${label}.class`, true);
  if (!PRIMARY_ACCENT_CLASSES.has(accentClass)) {
    failContract(sourcePath, line, `${label}.class must be one of DISJUNCTIVE|CONJUNCTIVE|NONE`);
  }

  const codepointValue = record.codepoint;
  let codepoint: string | null;
  if (codepointValue === null) {
    codepoint = null;
  } else {
    codepoint = assertString(codepointValue, sourcePath, line, `${label}.codepoint`, true);
    assertPattern(codepoint, CODEPOINT_PATTERN, sourcePath, line, `${label}.codepoint`);
  }

  const nameValue = record.name;
  let name: string | null;
  if (nameValue === null) {
    name = null;
  } else {
    name = assertString(nameValue, sourcePath, line, `${label}.name`, true);
  }

  const precedence = assertInt(record.precedence, sourcePath, line, `${label}.precedence`, 0);
  const observed = assertArray(
    record.observed_teamim,
    sourcePath,
    line,
    `${label}.observed_teamim`,
    0
  );
  const observedTeamim: string[] = [];
  for (let index = 0; index < observed.length; index += 1) {
    const cp = assertString(
      observed[index],
      sourcePath,
      line,
      `${label}.observed_teamim[${index}]`,
      true
    );
    assertPattern(cp, CODEPOINT_PATTERN, sourcePath, line, `${label}.observed_teamim[${index}]`);
    observedTeamim.push(cp);
  }

  return {
    word_index: wordIndex,
    class: accentClass as PrimaryAccent["class"],
    codepoint,
    name,
    precedence,
    observed_teamim: observedTeamim
  };
}

function validatePhraseNodeSpan(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string
): PhraseNodeSpan {
  const record = assertRecord(value, sourcePath, line, label);
  assertExactKeys(record, NODE_SPAN_ALLOWED_KEYS, sourcePath, line, label);
  const start = assertInt(record.start, sourcePath, line, `${label}.start`, 1);
  const end = assertInt(record.end, sourcePath, line, `${label}.end`, 1);
  if (start > end) {
    failContract(sourcePath, line, `${label}.end must be >= ${label}.start`);
  }
  return { start, end };
}

function validatePhraseNode(
  value: unknown,
  sourcePath: string,
  line: number,
  label: string
): PhraseNode {
  const record = assertRecord(value, sourcePath, line, label);
  const nodeType = assertString(record.node_type, sourcePath, line, `${label}.node_type`, true);
  const id = assertString(record.id, sourcePath, line, `${label}.id`, true);
  const span = validatePhraseNodeSpan(record.span, sourcePath, line, `${label}.span`);

  if (nodeType === "LEAF") {
    assertExactKeys(record, PHRASE_LEAF_ALLOWED_KEYS, sourcePath, line, label);
    const wordIndex = assertInt(record.word_index, sourcePath, line, `${label}.word_index`, 1);
    const surface = assertString(record.surface, sourcePath, line, `${label}.surface`, false);
    const accent = validatePrimaryAccent(record.accent, sourcePath, line, `${label}.accent`);

    return {
      id,
      node_type: "LEAF",
      span,
      word_index: wordIndex,
      surface,
      accent
    };
  }

  if (nodeType === "JOIN") {
    assertExactKeys(record, PHRASE_JOIN_ALLOWED_KEYS, sourcePath, line, label);
    const fold = assertString(record.fold, sourcePath, line, `${label}.fold`, true);
    if (fold !== "LEFT") {
      failContract(sourcePath, line, `${label}.fold must be LEFT`);
    }
    const left = validatePhraseNode(record.left, sourcePath, line, `${label}.left`);
    const right = validatePhraseNode(record.right, sourcePath, line, `${label}.right`);

    return {
      id,
      node_type: "JOIN",
      span,
      fold: "LEFT",
      left,
      right
    };
  }

  if (nodeType === "SPLIT") {
    assertExactKeys(record, PHRASE_SPLIT_ALLOWED_KEYS, sourcePath, line, label);
    const splitWordIndex = assertInt(
      record.split_word_index,
      sourcePath,
      line,
      `${label}.split_word_index`,
      1
    );
    const splitAccentRecord = assertRecord(
      record.split_accent,
      sourcePath,
      line,
      `${label}.split_accent`
    );
    assertExactKeys(
      splitAccentRecord,
      PHRASE_SPLIT_ACCENT_ALLOWED_KEYS,
      sourcePath,
      line,
      `${label}.split_accent`
    );
    const splitAccentCodepoint = assertString(
      splitAccentRecord.codepoint,
      sourcePath,
      line,
      `${label}.split_accent.codepoint`,
      true
    );
    assertPattern(
      splitAccentCodepoint,
      CODEPOINT_PATTERN,
      sourcePath,
      line,
      `${label}.split_accent.codepoint`
    );
    const splitAccentNameRaw = splitAccentRecord.name;
    const splitAccentName =
      splitAccentNameRaw === null
        ? null
        : assertString(splitAccentNameRaw, sourcePath, line, `${label}.split_accent.name`, true);
    const splitAccentPrecedence = assertInt(
      splitAccentRecord.precedence,
      sourcePath,
      line,
      `${label}.split_accent.precedence`,
      0
    );

    const left = validatePhraseNode(record.left, sourcePath, line, `${label}.left`);
    const right = validatePhraseNode(record.right, sourcePath, line, `${label}.right`);

    return {
      id,
      node_type: "SPLIT",
      span,
      split_word_index: splitWordIndex,
      split_accent: {
        codepoint: splitAccentCodepoint,
        name: splitAccentName,
        precedence: splitAccentPrecedence
      },
      left,
      right
    };
  }

  failContract(sourcePath, line, `${label}.node_type must be LEAF|JOIN|SPLIT`);
}

function validateWordTraceRecord(
  value: unknown,
  sourcePath: string,
  line: number
): WordTraceRecord {
  const record = assertRecord(value, sourcePath, line, "word_traces record");
  assertExactKeys(record, WORD_TRACE_ALLOWED_KEYS, sourcePath, line, "word_traces record");
  assertHasRequiredKeys(record, WORD_TRACE_REQUIRED_KEYS, sourcePath, line, "word_traces record");

  const recordKind = assertString(record.record_kind, sourcePath, line, "record_kind", true);
  if (recordKind !== "WORD_TRACE") {
    failContract(sourcePath, line, "record_kind must be WORD_TRACE");
  }

  const traceVersion = assertString(record.trace_version, sourcePath, line, "trace_version", true);
  assertPattern(traceVersion, TRACE_VERSION_PATTERN, sourcePath, line, "trace_version");
  const semanticsVersion = assertString(
    record.semantics_version,
    sourcePath,
    line,
    "semantics_version",
    true
  );
  assertPattern(semanticsVersion, SEMVER_PATTERN, sourcePath, line, "semantics_version");
  const renderVersion = assertString(
    record.render_version,
    sourcePath,
    line,
    "render_version",
    true
  );
  assertPattern(renderVersion, SEMVER_PATTERN, sourcePath, line, "render_version");

  const ref = validateWordRef(record.ref, sourcePath, line, "ref");
  const refKey = assertString(record.ref_key, sourcePath, line, "ref_key", true);
  assertPattern(refKey, WORD_REF_KEY_PATTERN, sourcePath, line, "ref_key");
  const expectedRefKey = `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`;
  if (refKey !== expectedRefKey) {
    failContract(
      sourcePath,
      line,
      `ref_key (${refKey}) must match ref fields (${expectedRefKey}) exactly`
    );
  }

  const surface = assertString(record.surface, sourcePath, line, "surface", false);
  const tokenIdsRaw = assertArray(record.token_ids, sourcePath, line, "token_ids", 0);
  const tokenIds: number[] = [];
  for (let index = 0; index < tokenIdsRaw.length; index += 1) {
    tokenIds.push(assertInt(tokenIdsRaw[index], sourcePath, line, `token_ids[${index}]`, 0));
  }

  const eventsRaw = assertArray(record.events, sourcePath, line, "events", 0);
  const events: WordTraceEvent[] = [];
  for (let eventIndex = 0; eventIndex < eventsRaw.length; eventIndex += 1) {
    const event = assertRecord(eventsRaw[eventIndex], sourcePath, line, `events[${eventIndex}]`);
    assertExactKeys(
      event,
      WORD_TRACE_EVENT_ALLOWED_KEYS,
      sourcePath,
      line,
      `events[${eventIndex}]`
    );

    const kind = assertString(event.kind, sourcePath, line, `events[${eventIndex}].kind`, true);
    if (!TRACE_EVENT_KINDS.has(kind)) {
      failContract(sourcePath, line, `events[${eventIndex}].kind is unknown (${kind})`);
    }
    const indexValue = assertInt(event.index, sourcePath, line, `events[${eventIndex}].index`, 0);
    const tauValue = assertInt(event.tau, sourcePath, line, `events[${eventIndex}].tau`, 0);
    const source = assertString(
      event.source,
      sourcePath,
      line,
      `events[${eventIndex}].source`,
      true
    );
    if (!TRACE_EVENT_SOURCES.has(source)) {
      failContract(sourcePath, line, `events[${eventIndex}].source is unknown (${source})`);
    }
    const payload = assertRecord(event.payload, sourcePath, line, `events[${eventIndex}].payload`);

    events.push({
      kind,
      index: indexValue,
      tau: tauValue,
      source,
      payload
    });
  }

  let skeleton: string[] | undefined;
  if ("skeleton" in record && record.skeleton !== undefined) {
    const skeletonRaw = assertArray(record.skeleton, sourcePath, line, "skeleton", 0);
    skeleton = [];
    for (let index = 0; index < skeletonRaw.length; index += 1) {
      const kind = assertString(skeletonRaw[index], sourcePath, line, `skeleton[${index}]`, true);
      if (!TRACE_EVENT_KINDS_NO_EXTENSION.has(kind)) {
        failContract(sourcePath, line, `skeleton[${index}] is unknown or not allowed (${kind})`);
      }
      skeleton.push(kind);
    }
  }

  let flow: string | undefined;
  if ("flow" in record && record.flow !== undefined) {
    flow = assertString(record.flow, sourcePath, line, "flow", false);
  }

  let mode: "WORD" | "VERSE" | "WINDOW" | undefined;
  if ("mode" in record && record.mode !== undefined) {
    const modeRaw = assertString(record.mode, sourcePath, line, "mode", true);
    if (!FLOW_MODES.has(modeRaw)) {
      failContract(sourcePath, line, `mode must be WORD|VERSE|WINDOW`);
    }
    mode = modeRaw as "WORD" | "VERSE" | "WINDOW";
  }

  let windowStart: number | undefined;
  if ("window_start" in record && record.window_start !== undefined) {
    windowStart = assertInt(record.window_start, sourcePath, line, "window_start", 1);
    if (mode !== "WINDOW") {
      failContract(sourcePath, line, "window_start is only allowed when mode is WINDOW");
    }
  }

  let canonicalHash: string | undefined;
  if ("canonical_hash" in record && record.canonical_hash !== undefined) {
    canonicalHash = assertString(record.canonical_hash, sourcePath, line, "canonical_hash", true);
    assertPattern(canonicalHash, SHA256_PATTERN, sourcePath, line, "canonical_hash");
  }

  let extensions: Record<string, unknown> | undefined;
  if ("extensions" in record && record.extensions !== undefined) {
    extensions = assertRecord(record.extensions, sourcePath, line, "extensions");
  }

  return {
    record_kind: "WORD_TRACE",
    trace_version: traceVersion,
    semantics_version: semanticsVersion,
    render_version: renderVersion,
    ref,
    ref_key: refKey,
    surface,
    token_ids: tokenIds,
    events,
    skeleton,
    flow,
    mode,
    window_start: windowStart,
    canonical_hash: canonicalHash,
    extensions
  };
}

function validateVersePhraseTreeRecord(
  value: unknown,
  sourcePath: string,
  line: number
): VersePhraseTreeRecord {
  const record = assertRecord(value, sourcePath, line, "verse_phrase_trees record");
  assertExactKeys(record, VERSE_TREE_ALLOWED_KEYS, sourcePath, line, "verse_phrase_trees record");
  assertHasRequiredKeys(
    record,
    VERSE_TREE_ALLOWED_KEYS,
    sourcePath,
    line,
    "verse_phrase_trees record"
  );

  const refKey = assertString(record.ref_key, sourcePath, line, "ref_key", true);
  assertPattern(refKey, VERSE_REF_KEY_PATTERN, sourcePath, line, "ref_key");
  const ref = validateVerseRef(record.ref, sourcePath, line, "ref");
  const expectedRefKey = `${ref.book}/${ref.chapter}/${ref.verse}`;
  if (refKey !== expectedRefKey) {
    failContract(
      sourcePath,
      line,
      `ref_key (${refKey}) must match ref fields (${expectedRefKey}) exactly`
    );
  }

  const wordsRaw = assertArray(record.words, sourcePath, line, "words", 1);
  const words: string[] = [];
  for (let index = 0; index < wordsRaw.length; index += 1) {
    words.push(assertString(wordsRaw[index], sourcePath, line, `words[${index}]`, false));
  }

  const accentsRaw = assertArray(record.primary_accents, sourcePath, line, "primary_accents", 0);
  const primaryAccents: PrimaryAccent[] = [];
  for (let index = 0; index < accentsRaw.length; index += 1) {
    primaryAccents.push(
      validatePrimaryAccent(accentsRaw[index], sourcePath, line, `primary_accents[${index}]`)
    );
  }
  if (primaryAccents.length !== words.length) {
    failContract(sourcePath, line, "primary_accents length must match words length");
  }

  const tree = validatePhraseNode(record.tree, sourcePath, line, "tree");
  const phraseVersion = assertString(
    record.phrase_version,
    sourcePath,
    line,
    "phrase_version",
    true
  );

  return {
    ref_key: refKey,
    ref,
    words,
    primary_accents: primaryAccents,
    tree,
    phrase_version: phraseVersion
  };
}

function validateWordPhraseRoleRecord(
  value: unknown,
  sourcePath: string,
  line: number
): WordPhraseRoleRecord {
  const record = assertRecord(value, sourcePath, line, "word_phrase_roles record");
  assertExactKeys(record, WORD_ROLE_ALLOWED_KEYS, sourcePath, line, "word_phrase_roles record");
  assertHasRequiredKeys(
    record,
    WORD_ROLE_ALLOWED_KEYS,
    sourcePath,
    line,
    "word_phrase_roles record"
  );

  const refKey = assertString(record.ref_key, sourcePath, line, "ref_key", true);
  assertPattern(refKey, VERSE_REF_KEY_PATTERN, sourcePath, line, "ref_key");
  const wordIndex = assertInt(record.word_index, sourcePath, line, "word_index", 1);
  const surface = assertString(record.surface, sourcePath, line, "surface", false);
  const primaryAccent = validatePrimaryAccent(
    record.primary_accent,
    sourcePath,
    line,
    "primary_accent"
  );
  const phraseRole = assertString(record.phrase_role, sourcePath, line, "phrase_role", true);
  if (!PHRASE_ROLES.has(phraseRole)) {
    failContract(sourcePath, line, "phrase_role must be HEAD|TAIL|JOIN|SPLIT");
  }
  const phrasePathRaw = assertArray(record.phrase_path, sourcePath, line, "phrase_path", 1);
  const phrasePath: string[] = [];
  for (let index = 0; index < phrasePathRaw.length; index += 1) {
    phrasePath.push(
      assertString(phrasePathRaw[index], sourcePath, line, `phrase_path[${index}]`, true)
    );
  }

  const clauseId = assertString(record.clause_id, sourcePath, line, "clause_id", true);
  const subclauseId = assertString(record.subclause_id, sourcePath, line, "subclause_id", true);
  const phraseVersion = assertString(
    record.phrase_version,
    sourcePath,
    line,
    "phrase_version",
    true
  );

  return {
    ref_key: refKey,
    word_index: wordIndex,
    surface,
    primary_accent: primaryAccent,
    phrase_role: phraseRole as WordPhraseRoleRecord["phrase_role"],
    phrase_path: phrasePath,
    clause_id: clauseId,
    subclause_id: subclauseId,
    phrase_version: phraseVersion
  };
}

function validateParaphraseRecord(
  value: unknown,
  sourcePath: string,
  line: number
): ParaphraseRecord {
  const record = assertRecord(value, sourcePath, line, "paraphrase record");
  assertExactKeys(record, PARAPHRASE_ALLOWED_KEYS, sourcePath, line, "paraphrase record");
  assertHasRequiredKeys(
    record,
    ["ref_key", "style", "text"],
    sourcePath,
    line,
    "paraphrase record"
  );

  const refKey = assertString(record.ref_key, sourcePath, line, "ref_key", true);
  assertPattern(refKey, PARAPHRASE_REF_KEY_PATTERN, sourcePath, line, "ref_key");
  const style = assertString(record.style, sourcePath, line, "style", true);
  if (!PARAPHRASE_STYLES.has(style)) {
    failContract(sourcePath, line, "style must be strict|poetic");
  }
  const text = assertString(record.text, sourcePath, line, "text", true);
  let metadata: Record<string, unknown> | undefined;
  if ("metadata" in record && record.metadata !== undefined) {
    metadata = assertRecord(record.metadata, sourcePath, line, "metadata");
  }

  return {
    ref_key: refKey,
    style: style as ParaphraseRecord["style"],
    text,
    metadata
  };
}

async function readFileUtf8(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function readValidatedWordTraces(
  filePath: string
): Promise<ReadValidatedJsonlResult<WordTraceRecord>> {
  const sourcePath = path.resolve(filePath);
  const text = await readFileUtf8(sourcePath);
  const rows = parseJsonlRows(text, sourcePath);
  const records = rows.map((row) => validateWordTraceRecord(row.value, sourcePath, row.line));
  return {
    records,
    sha256: sha256Hex(text)
  };
}

async function readValidatedVerseTrees(
  filePath: string
): Promise<ReadValidatedJsonlResult<VersePhraseTreeRecord>> {
  const sourcePath = path.resolve(filePath);
  const text = await readFileUtf8(sourcePath);
  const rows = parseJsonlRows(text, sourcePath);
  const records = rows.map((row) => validateVersePhraseTreeRecord(row.value, sourcePath, row.line));
  return {
    records,
    sha256: sha256Hex(text)
  };
}

async function readValidatedWordRoles(
  filePath: string
): Promise<ReadValidatedJsonlResult<WordPhraseRoleRecord>> {
  const sourcePath = path.resolve(filePath);
  const text = await readFileUtf8(sourcePath);
  const rows = parseJsonlRows(text, sourcePath);
  const records = rows.map((row) => validateWordPhraseRoleRecord(row.value, sourcePath, row.line));
  return {
    records,
    sha256: sha256Hex(text)
  };
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function detectSourceManifest(explicitPath: string): Promise<SourceManifestInfo | null> {
  const candidates = explicitPath
    ? [path.resolve(explicitPath)]
    : [DEFAULT_SOURCE_MANIFEST, FALLBACK_SOURCE_MANIFEST];

  for (const candidate of candidates) {
    if (!(await exists(candidate))) {
      continue;
    }

    const raw = await fs.readFile(candidate, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`ui:bundle failed to parse source manifest ${candidate} (${String(error)})`);
    }
    if (!isObject(parsed)) {
      throw new Error(`ui:bundle source manifest ${candidate} must be a JSON object`);
    }

    const info: SourceManifestInfo = {
      path: candidate
    };

    if (typeof parsed.corpus === "string" && parsed.corpus.trim().length > 0) {
      info.corpus = parsed.corpus;
    }
    if (typeof parsed.artifact_set === "string" && parsed.artifact_set.trim().length > 0) {
      info.artifactSet = parsed.artifact_set;
    } else if (typeof parsed.output_dir === "string" && parsed.output_dir.trim().length > 0) {
      info.artifactSet = path.basename(parsed.output_dir);
    }
    if (typeof parsed.generated_at === "string" && ISO_UTC_PATTERN.test(parsed.generated_at)) {
      info.generatedAt = parsed.generated_at;
    }

    const versionContractRaw = parsed.version_contract;
    if (isObject(versionContractRaw)) {
      const traceVersion = versionContractRaw.trace_version;
      const semanticsVersion = versionContractRaw.semantics_version;
      const renderVersion = versionContractRaw.render_version;
      if (
        typeof traceVersion === "string" &&
        TRACE_VERSION_PATTERN.test(traceVersion) &&
        typeof semanticsVersion === "string" &&
        SEMVER_PATTERN.test(semanticsVersion) &&
        typeof renderVersion === "string" &&
        SEMVER_PATTERN.test(renderVersion)
      ) {
        info.versionContract = {
          trace_version: traceVersion,
          semantics_version: semanticsVersion,
          render_version: renderVersion
        };
      }
    }

    return info;
  }

  if (explicitPath) {
    throw new Error(`ui:bundle source manifest not found: ${explicitPath}`);
  }
  return null;
}

function deriveVersionContract(
  sourceManifest: SourceManifestInfo | null,
  wordTraceRecords: WordTraceRecord[]
): VersionContract {
  if (wordTraceRecords.length === 0) {
    throw new Error("ui:bundle requires at least one word trace record");
  }

  const first = wordTraceRecords[0];
  const traceVersion = first.trace_version;
  const semanticsVersion = first.semantics_version;
  const renderVersion = first.render_version;

  for (const record of wordTraceRecords) {
    if (
      record.trace_version !== traceVersion ||
      record.semantics_version !== semanticsVersion ||
      record.render_version !== renderVersion
    ) {
      throw new Error(
        `ui:bundle found mixed version_contract values in word_traces (${record.ref_key})`
      );
    }
  }

  if (sourceManifest?.versionContract) {
    const source = sourceManifest.versionContract;
    if (
      source.trace_version !== traceVersion ||
      source.semantics_version !== semanticsVersion ||
      source.render_version !== renderVersion
    ) {
      throw new Error(
        `ui:bundle source manifest version_contract (${source.trace_version}/${source.semantics_version}/${source.render_version}) does not match word_traces (${traceVersion}/${semanticsVersion}/${renderVersion})`
      );
    }
    return source;
  }

  return {
    trace_version: traceVersion,
    semantics_version: semanticsVersion,
    render_version: renderVersion
  };
}

function parseVerseRefKeyOrFail(refKey: string): VerseRef {
  const parts = String(refKey).split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid verse ref_key '${refKey}'`);
  }
  const book = parts[0] ?? "";
  const chapter = Number(parts[1]);
  const verse = Number(parts[2]);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    throw new Error(`Invalid verse ref_key '${refKey}'`);
  }
  return {
    book,
    chapter,
    verse
  };
}

function toVerseRefKeyFromWordRefKey(refKey: string): string {
  const parts = String(refKey).split("/");
  if (parts.length !== 4) {
    throw new Error(`Invalid word ref_key '${refKey}'`);
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function toVerseRefKeyFromParaphraseRefKey(refKey: string): string {
  const parts = String(refKey).split("/");
  if (parts.length !== 3 && parts.length !== 4) {
    throw new Error(`Invalid paraphrase ref_key '${refKey}'`);
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

function toBookSegment(book: string): string {
  const base = String(book)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const prefix = base.length > 0 ? base : "book";
  return `${prefix}-${sha256Hex(book).slice(0, 8)}`;
}

function toChunkPath(kind: "words" | "verses" | "paraphrase", ref: VerseRef): string {
  return path.posix.join(
    "chunks",
    kind,
    toBookSegment(ref.book),
    pad3(ref.chapter),
    `${pad3(ref.verse)}.json`
  );
}

function toSortedObject(
  entries: Array<[string, string]>,
  compareFn: (a: string, b: string) => number
) {
  const out: Record<string, string> = {};
  const sorted = [...entries].sort((left, right) => compareFn(left[0], right[0]));
  for (const [key, value] of sorted) {
    out[key] = value;
  }
  return out;
}

function buildNavigation(
  wordTraces: WordTraceRecord[],
  verseTrees: VersePhraseTreeRecord[]
): BundleNavigation {
  type ChapterStats = {
    verses: Set<number>;
    wordCount: number;
  };

  const byBook = new Map<string, Map<number, ChapterStats>>();

  const ensureChapter = (book: string, chapter: number): ChapterStats => {
    const chapterMap = byBook.get(book) ?? new Map<number, ChapterStats>();
    if (!byBook.has(book)) {
      byBook.set(book, chapterMap);
    }
    const chapterStats = chapterMap.get(chapter) ?? {
      verses: new Set<number>(),
      wordCount: 0
    };
    if (!chapterMap.has(chapter)) {
      chapterMap.set(chapter, chapterStats);
    }
    return chapterStats;
  };

  for (const trace of wordTraces) {
    const chapterStats = ensureChapter(trace.ref.book, trace.ref.chapter);
    chapterStats.verses.add(trace.ref.verse);
    chapterStats.wordCount += 1;
  }

  for (const tree of verseTrees) {
    const chapterStats = ensureChapter(tree.ref.book, tree.ref.chapter);
    chapterStats.verses.add(tree.ref.verse);
  }

  const books = Array.from(byBook.entries())
    .sort((left, right) => compareText(left[0], right[0]))
    .map(([book, chapterMap]) => {
      const chapters = Array.from(chapterMap.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([chapter, stats]) => ({
          chapter,
          verse_count: stats.verses.size,
          word_count: stats.wordCount
        }));

      return {
        book,
        verse_count: chapters.reduce((sum, chapter) => sum + chapter.verse_count, 0),
        word_count: chapters.reduce((sum, chapter) => sum + chapter.word_count, 0),
        chapters
      };
    });

  return {
    books
  };
}

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  if (!(await exists(rootDir))) {
    return [];
  }

  const out: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const nextDir = queue.shift();
    if (!nextDir) {
      continue;
    }
    const entries = await fs.readdir(nextDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(nextDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }

  out.sort((left, right) => compareText(toPosixPath(left), toPosixPath(right)));
  return out;
}

async function collectValidatedParaphraseRecords(
  outputsGenesisDir: string,
  renderDir: string
): Promise<ParaphraseRecord[]> {
  const candidateRoots = [outputsGenesisDir, renderDir];
  const candidateFiles: string[] = [];

  for (const root of candidateRoots) {
    const files = await listFilesRecursive(root);
    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const base = path.basename(filePath).toLowerCase();
      if ((ext === ".jsonl" || ext === ".json") && base.includes("paraphrase")) {
        candidateFiles.push(filePath);
      }
    }
  }

  candidateFiles.sort((left, right) => compareText(toPosixPath(left), toPosixPath(right)));

  const dedup = new Map<string, ParaphraseRecord>();
  for (const filePath of candidateFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const sourcePath = path.resolve(filePath);
    const raw = await fs.readFile(sourcePath, "utf8");
    if (ext === ".jsonl") {
      const rows = parseJsonlRows(raw, sourcePath);
      for (const row of rows) {
        const parsed = validateParaphraseRecord(row.value, sourcePath, row.line);
        const key = `${parsed.ref_key}|${parsed.style}`;
        if (!dedup.has(key)) {
          dedup.set(key, parsed);
        }
      }
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `ui:bundle failed to parse paraphrase JSON file ${sourcePath} (${String(error)})`
      );
    }
    if (!Array.isArray(parsedJson)) {
      throw new Error(
        `ui:bundle paraphrase JSON file ${sourcePath} must contain an array of records`
      );
    }
    for (let index = 0; index < parsedJson.length; index += 1) {
      const parsed = validateParaphraseRecord(parsedJson[index], sourcePath, index + 1);
      const key = `${parsed.ref_key}|${parsed.style}`;
      if (!dedup.has(key)) {
        dedup.set(key, parsed);
      }
    }
  }

  return Array.from(dedup.values()).sort((left, right) => {
    const refCmp = compareRefKeyLike(left.ref_key, right.ref_key);
    if (refCmp !== 0) {
      return refCmp;
    }
    return compareText(left.style, right.style);
  });
}

async function collectOptionalIndexAssets(
  indexDir: string
): Promise<Array<{ relativePath: string; content: string }>> {
  const files = await listFilesRecursive(indexDir);
  const out: Array<{ relativePath: string; content: string }> = [];
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".json" && ext !== ".bin") {
      continue;
    }
    const raw = await fs.readFile(filePath, "utf8");
    try {
      JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `ui:bundle optional index file ${filePath} contains invalid JSON (${String(error)})`
      );
    }
    const rel = toPosixPath(path.relative(indexDir, filePath));
    out.push({
      relativePath: path.posix.join("optional", "index", rel),
      content: raw.endsWith("\n") ? raw : `${raw}\n`
    });
  }
  out.sort((left, right) => compareText(left.relativePath, right.relativePath));
  return out;
}

async function writeBundleFile(
  bundleDir: string,
  relativePath: string,
  content: string,
  kind: string,
  fileEntries: BundleFileEntry[],
  records?: number
): Promise<void> {
  const normalized = toPosixPath(relativePath.replace(/^\/+/u, ""));
  const targetPath = path.join(bundleDir, ...normalized.split("/"));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");

  fileEntries.push({
    path: normalized,
    kind,
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256Hex(content),
    ...(records !== undefined ? { records } : {})
  });
}

function ensureConsistentVerseCoverage(
  wordTraceRecords: WordTraceRecord[],
  verseTreeRecords: VersePhraseTreeRecord[],
  wordRoleRecords: WordPhraseRoleRecord[]
): void {
  const verseKeysFromWords = new Set<string>(
    wordTraceRecords.map((record) => toVerseRefKeyFromWordRefKey(record.ref_key))
  );
  const verseKeysFromTrees = new Set<string>(verseTreeRecords.map((record) => record.ref_key));
  const verseKeysFromRoles = new Set<string>(wordRoleRecords.map((record) => record.ref_key));

  for (const verseKey of verseKeysFromWords) {
    if (!verseKeysFromTrees.has(verseKey)) {
      throw new Error(`ui:bundle missing verse_phrase_tree record for ${verseKey}`);
    }
    if (!verseKeysFromRoles.has(verseKey)) {
      throw new Error(`ui:bundle missing word_phrase_roles record(s) for ${verseKey}`);
    }
  }
}

function groupBy<K extends string, T>(rows: T[], keyFn: (value: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = grouped.get(key) ?? [];
    if (!grouped.has(key)) {
      grouped.set(key, list);
    }
    list.push(row);
  }
  return grouped;
}

async function copyBundleToUiPublic(bundleDir: string, uiPublicDir: string): Promise<void> {
  await fs.rm(uiPublicDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(uiPublicDir), { recursive: true });
  await fs.cp(bundleDir, uiPublicDir, { recursive: true });
}

function parseBundleManifest(raw: string, sourcePath: string): UiBundleManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`ui:bundle:verify failed to parse ${sourcePath} (${String(error)})`);
  }

  if (!isObject(parsed)) {
    throw new Error(`ui:bundle:verify manifest ${sourcePath} must be an object`);
  }
  if (parsed.schema_version !== 1) {
    throw new Error(`ui:bundle:verify manifest ${sourcePath} schema_version must be 1`);
  }
  if (!Array.isArray(parsed.files)) {
    throw new Error(`ui:bundle:verify manifest ${sourcePath} is missing files[]`);
  }

  for (let index = 0; index < parsed.files.length; index += 1) {
    const entry = parsed.files[index];
    if (!isObject(entry)) {
      throw new Error(`ui:bundle:verify manifest files[${index}] must be an object`);
    }
    if (typeof entry.path !== "string" || entry.path.length === 0) {
      throw new Error(`ui:bundle:verify manifest files[${index}].path must be non-empty string`);
    }
    if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`ui:bundle:verify manifest files[${index}].sha256 must be lowercase sha256`);
    }
    if (!Number.isInteger(entry.bytes) || Number(entry.bytes) < 0) {
      throw new Error(`ui:bundle:verify manifest files[${index}].bytes must be non-negative int`);
    }
  }

  return parsed as UiBundleManifest;
}

export async function runBundleCommand(options: UiBundleOptions): Promise<RunBundleResult> {
  const sourceManifest = await detectSourceManifest(options.sourceManifestPath);

  const wordTraceLoaded = await readValidatedWordTraces(options.wordTracesPath);
  const verseTreeLoaded = await readValidatedVerseTrees(options.versePhraseTreesPath);
  const wordRoleLoaded = await readValidatedWordRoles(options.wordPhraseRolesPath);

  const wordTraceRecords = [...wordTraceLoaded.records].sort((left, right) =>
    compareRefKeyLike(left.ref_key, right.ref_key)
  );
  const verseTreeRecords = [...verseTreeLoaded.records].sort((left, right) =>
    compareRefKeyLike(left.ref_key, right.ref_key)
  );
  const wordRoleRecords = [...wordRoleLoaded.records].sort((left, right) => {
    const refCmp = compareRefKeyLike(left.ref_key, right.ref_key);
    if (refCmp !== 0) {
      return refCmp;
    }
    return left.word_index - right.word_index;
  });

  ensureConsistentVerseCoverage(wordTraceRecords, verseTreeRecords, wordRoleRecords);

  const paraphraseRecords = await collectValidatedParaphraseRecords(
    options.outputsGenesisDir,
    options.renderDir
  );
  const optionalIndexAssets = await collectOptionalIndexAssets(options.indexDir);

  const versionContract = deriveVersionContract(sourceManifest, wordTraceRecords);

  const corpus = sourceManifest?.corpus ?? "torah-corpus";
  const artifactSet = sourceManifest?.artifactSet ?? "latest";
  const generatedAt = sourceManifest?.generatedAt ?? NULL_GENERATED_AT;

  const wordByVerse = groupBy(wordTraceRecords, (record) =>
    toVerseRefKeyFromWordRefKey(record.ref_key)
  );
  const rolesByVerse = groupBy(wordRoleRecords, (record) => record.ref_key);
  const treesByVerse = new Map<string, VersePhraseTreeRecord>();
  for (const tree of verseTreeRecords) {
    treesByVerse.set(tree.ref_key, tree);
  }
  const paraphraseByVerse = groupBy(paraphraseRecords, (record) =>
    toVerseRefKeyFromParaphraseRefKey(record.ref_key)
  );

  const wordVerseKeys = Array.from(wordByVerse.keys()).sort(compareRefKeyLike);
  const treeVerseKeys = Array.from(treesByVerse.keys()).sort(compareRefKeyLike);
  const paraphraseVerseKeys = Array.from(paraphraseByVerse.keys()).sort(compareRefKeyLike);

  await fs.rm(options.bundleDir, { recursive: true, force: true });
  await fs.mkdir(options.bundleDir, { recursive: true });

  const fileEntries: BundleFileEntry[] = [];
  const wordRefToChunk: Array<[string, string]> = [];
  const verseRefToChunk: Array<[string, string]> = [];
  const roleRefToChunk: Array<[string, string]> = [];
  const paraphraseRefToChunk: Array<[string, string]> = [];

  let wordChunkCount = 0;
  let verseChunkCount = 0;
  let paraphraseChunkCount = 0;

  for (const verseKey of wordVerseKeys) {
    const ref = parseVerseRefKeyOrFail(verseKey);
    const chunkPath = toChunkPath("words", ref);
    const wordRecords = [...(wordByVerse.get(verseKey) ?? [])].sort((left, right) =>
      compareRefKeyLike(left.ref_key, right.ref_key)
    );
    const roleRecords = [...(rolesByVerse.get(verseKey) ?? [])].sort(
      (left, right) => left.word_index - right.word_index
    );

    const chunkPayload = {
      schema_version: 1,
      chunk_kind: "word_trace_bundle_chunk",
      verse_ref_key: verseKey,
      ref,
      word_traces: wordRecords,
      word_phrase_roles: roleRecords
    };

    await writeBundleFile(
      options.bundleDir,
      chunkPath,
      `${JSON.stringify(chunkPayload)}\n`,
      "words_chunk",
      fileEntries,
      wordRecords.length + roleRecords.length
    );

    for (const record of wordRecords) {
      wordRefToChunk.push([record.ref_key, chunkPath]);
    }
    roleRefToChunk.push([verseKey, chunkPath]);
    wordChunkCount += 1;
  }

  for (const verseKey of treeVerseKeys) {
    const tree = treesByVerse.get(verseKey);
    if (!tree) {
      continue;
    }
    const chunkPath = toChunkPath("verses", tree.ref);
    const chunkPayload = {
      schema_version: 1,
      chunk_kind: "verse_phrase_tree_chunk",
      verse_ref_key: verseKey,
      ref: tree.ref,
      verse_phrase_tree: tree
    };

    await writeBundleFile(
      options.bundleDir,
      chunkPath,
      `${JSON.stringify(chunkPayload)}\n`,
      "verses_chunk",
      fileEntries,
      1
    );

    verseRefToChunk.push([verseKey, chunkPath]);
    verseChunkCount += 1;
  }

  for (const verseKey of paraphraseVerseKeys) {
    const records = [...(paraphraseByVerse.get(verseKey) ?? [])].sort((left, right) => {
      const refCmp = compareRefKeyLike(left.ref_key, right.ref_key);
      if (refCmp !== 0) {
        return refCmp;
      }
      return compareText(left.style, right.style);
    });
    if (records.length === 0) {
      continue;
    }
    const ref = parseVerseRefKeyOrFail(verseKey);
    const chunkPath = toChunkPath("paraphrase", ref);
    const chunkPayload = {
      schema_version: 1,
      chunk_kind: "paraphrase_chunk",
      verse_ref_key: verseKey,
      ref,
      records
    };
    await writeBundleFile(
      options.bundleDir,
      chunkPath,
      `${JSON.stringify(chunkPayload)}\n`,
      "paraphrase_chunk",
      fileEntries,
      records.length
    );
    for (const record of records) {
      paraphraseRefToChunk.push([record.ref_key, chunkPath]);
    }
    paraphraseChunkCount += 1;
  }

  for (const asset of optionalIndexAssets) {
    await writeBundleFile(
      options.bundleDir,
      asset.relativePath,
      asset.content,
      "optional_index",
      fileEntries
    );
  }

  const refsIndexPayload = {
    schema_version: 1,
    strategy: "book_chapter_verse",
    words: toSortedObject(wordRefToChunk, compareRefKeyLike),
    verses: toSortedObject(verseRefToChunk, compareRefKeyLike),
    roles: toSortedObject(roleRefToChunk, compareRefKeyLike),
    paraphrase: toSortedObject(paraphraseRefToChunk, compareRefKeyLike)
  };

  await writeBundleFile(
    options.bundleDir,
    "refs/index.json",
    `${JSON.stringify(refsIndexPayload)}\n`,
    "refs_index",
    fileEntries,
    wordRefToChunk.length + verseRefToChunk.length + paraphraseRefToChunk.length
  );

  fileEntries.sort((left, right) => compareText(left.path, right.path));

  const bundleManifest: UiBundleManifest = {
    schema_version: 1,
    bundle_type: "letters.ui_bundle",
    bundle_version: "1.0.0",
    corpus,
    artifact_set: artifactSet,
    generated_at: generatedAt,
    versions: versionContract,
    version_contract: versionContract,
    chunk_strategy: "book_chapter_verse",
    indexes: {
      refs: "refs/index.json"
    },
    counts: {
      word_traces: wordTraceRecords.length,
      verse_phrase_trees: verseTreeRecords.length,
      word_phrase_roles: wordRoleRecords.length,
      paraphrase_records: paraphraseRecords.length,
      word_chunks: wordChunkCount,
      verse_chunks: verseChunkCount,
      paraphrase_chunks: paraphraseChunkCount,
      optional_index_files: optionalIndexAssets.length
    },
    navigation: buildNavigation(wordTraceRecords, verseTreeRecords),
    inputs: {
      word_traces: {
        path: toPosixPath(path.relative(process.cwd(), path.resolve(options.wordTracesPath))),
        rows: wordTraceRecords.length,
        sha256: wordTraceLoaded.sha256
      },
      verse_phrase_trees: {
        path: toPosixPath(path.relative(process.cwd(), path.resolve(options.versePhraseTreesPath))),
        rows: verseTreeRecords.length,
        sha256: verseTreeLoaded.sha256
      },
      word_phrase_roles: {
        path: toPosixPath(path.relative(process.cwd(), path.resolve(options.wordPhraseRolesPath))),
        rows: wordRoleRecords.length,
        sha256: wordRoleLoaded.sha256
      },
      ...(sourceManifest ? { optional_source_manifest_path: toPosixPath(sourceManifest.path) } : {})
    },
    files: fileEntries
  };

  const manifestPath = path.join(options.bundleDir, "ui-manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`, "utf8");

  if (!options.skipCopy) {
    await copyBundleToUiPublic(options.bundleDir, options.uiPublicDir);
  }

  return {
    bundleDir: options.bundleDir,
    uiPublicDir: options.uiPublicDir,
    manifestPath,
    files: bundleManifest.files.length + 1,
    wordChunks: wordChunkCount,
    verseChunks: verseChunkCount,
    paraphraseChunks: paraphraseChunkCount,
    wordRecords: wordTraceRecords.length,
    verseRecords: verseTreeRecords.length,
    roleRecords: wordRoleRecords.length,
    paraphraseRecords: paraphraseRecords.length
  };
}

export async function verifyBundleCommand(options: UiBundleOptions): Promise<VerifyBundleResult> {
  const manifestPath = path.join(options.bundleDir, "ui-manifest.json");
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = parseBundleManifest(manifestRaw, manifestPath);

  let checkedFiles = 0;
  let checkedBytes = 0;
  for (const entry of manifest.files) {
    const targetPath = path.join(options.bundleDir, ...entry.path.split("/"));
    const content = await fs.readFile(targetPath, "utf8");
    const actualSha = sha256Hex(content);
    if (actualSha !== entry.sha256) {
      throw new Error(
        `ui:bundle:verify checksum mismatch for ${entry.path}: expected ${entry.sha256} got ${actualSha}`
      );
    }

    const actualBytes = Buffer.byteLength(content, "utf8");
    if (actualBytes !== entry.bytes) {
      throw new Error(
        `ui:bundle:verify byte size mismatch for ${entry.path}: expected ${entry.bytes} got ${actualBytes}`
      );
    }

    checkedFiles += 1;
    checkedBytes += actualBytes;
  }

  let mirrorChecked = false;
  if (!options.skipCopy) {
    mirrorChecked = true;
    const uiManifestPath = path.join(options.uiPublicDir, "ui-manifest.json");
    const uiManifest = await fs.readFile(uiManifestPath, "utf8");
    if (sha256Hex(uiManifest) !== sha256Hex(manifestRaw)) {
      throw new Error("ui:bundle:verify UI public copy manifest does not match bundle manifest");
    }
    for (const entry of manifest.files) {
      const bundleFile = path.join(options.bundleDir, ...entry.path.split("/"));
      const uiFile = path.join(options.uiPublicDir, ...entry.path.split("/"));
      const [bundleContent, uiContent] = await Promise.all([
        fs.readFile(bundleFile, "utf8"),
        fs.readFile(uiFile, "utf8")
      ]);
      if (sha256Hex(bundleContent) !== sha256Hex(uiContent)) {
        throw new Error(`ui:bundle:verify UI public copy mismatch for ${entry.path}`);
      }
    }
  }

  return {
    checkedFiles,
    checkedBytes,
    bundleDir: options.bundleDir,
    uiPublicDir: options.uiPublicDir,
    mirrorChecked
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, opts } = parseArgs(rawArgv);
  if (command === "verify") {
    const verified = await verifyBundleCommand(opts);
    console.log(
      `ui:bundle:verify ok files=${verified.checkedFiles} bytes=${verified.checkedBytes} bundle=${verified.bundleDir} mirror_checked=${verified.mirrorChecked ? "yes" : "no"}`
    );
    return;
  }

  const result = await runBundleCommand(opts);
  console.log(
    `ui:bundle done files=${result.files} word_chunks=${result.wordChunks} verse_chunks=${result.verseChunks} paraphrase_chunks=${result.paraphraseChunks} word_records=${result.wordRecords} verse_records=${result.verseRecords} role_records=${result.roleRecords} bundle=${result.bundleDir} ui_public=${result.uiPublicDir}`
  );
}
