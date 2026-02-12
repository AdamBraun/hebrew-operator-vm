import path from "node:path";

export const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
export const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "outputs", "torah-corpus", "latest");
export const DEFAULT_PROMOTE_OUT = path.resolve(
  process.cwd(),
  "tests",
  "core",
  "07_golden",
  "torah_flow_promoted.json"
);
export const DEFAULT_TRACE_OUT = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
export const DEFAULT_FLOWS_OUT = path.resolve(process.cwd(), "corpus", "word_flows.txt");
export const DEFAULT_EXECUTION_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "execution_report.md"
);
export const DEFAULT_VERSE_TRACE_OUT = path.resolve(process.cwd(), "corpus", "verse_traces.jsonl");
export const DEFAULT_VERSE_EXECUTION_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "verse_execution_report.md"
);
export const DEFAULT_VERSE_MOTIF_INDEX_OUT = path.resolve(
  process.cwd(),
  "index",
  "verse_motif_index.json"
);
export const DEFAULT_DIFF_REPORT_OUT = path.resolve(process.cwd(), "diffs", "runA_vs_runB.md");
export const DEFAULT_GOLDENS_OUT = path.resolve(process.cwd(), "tests", "goldens.json");
export const DEFAULT_REGRESSION_REPORT_OUT = path.resolve(
  process.cwd(),
  "reports",
  "regression_report.md"
);
export const DEFAULT_TOKEN_REGISTRY_PATH = path.resolve(
  process.cwd(),
  "data",
  "tokens.registry.json"
);
export const DEFAULT_COMPILED_BUNDLES_PATH = path.resolve(
  process.cwd(),
  "data",
  "tokens.compiled.json"
);
export const DEFAULT_SEMANTICS_DEFS_PATH = path.resolve(
  process.cwd(),
  "registry",
  "token-semantics.json"
);
export const DEFAULT_EXECUTION_MODE = "WORD";
export const DEFAULT_WINDOW_SIZE = 4;
export const DEFAULT_SAFETY_RAIL_THRESHOLD = 0.35;

export type RunLanguage = "he" | "en" | "both";
export type ExecutionMode = "WORD" | "VERSE" | "WINDOW";

type OptionValue = {
  value: string;
  nextIndex: number;
};

export type CommonRunArgs = {
  input: string;
  outDir: string;
  lang: RunLanguage;
  normalizeFinals: boolean;
  allowRuntimeErrors: boolean;
};

export type ExecuteArgs = CommonRunArgs & {
  traceOut: string;
  flowsOut: string;
  reportOut: string;
  verseTraceOut: string;
  verseReportOut: string;
  verseMotifIndexOut: string;
  tokenRegistry: string;
  compiledBundles: string;
  semanticVersion: string;
  debugRawEvents: boolean;
  mode: ExecutionMode;
  modeLabel: string;
  windowSize: number | null;
  safetyRail: boolean;
  safetyRailThreshold: number;
};

export type DiffArgs = {
  prev: string;
  next: string;
  out: string;
};

export type PromoteArgs = {
  diffPath: string;
  next: string;
  out: string;
  limit: number;
};

export type VerifyArgs = {
  dir: string;
};

export type RegressArgs = {
  runA: string;
  runB: string;
  diffOut: string;
  goldens: string;
  regressionOut: string;
  compiledA: string;
  compiledB: string;
  updateGoldens: boolean;
  goldenLimit: number;
};

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

export function printHelp(): void {
  console.log("Usage:");
  console.log(
    "  node scripts/torah-corpus.mjs execute [--input=path] [--trace-out=path] [--flows-out=path] [--report-out=path]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs execute [--verse-trace-out=path] [--verse-report-out=path] [--mode=WORD|VERSE|WINDOW(N)] [--window-size=N]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs execute [--verse-motif-index-out=path] [--safety-rail] [--no-safety-rail] [--safety-rail-threshold=0.35]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs execute [--token-registry=path] [--compiled-bundles=path] [--semantic-version=value] [--debug-raw-events]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs run-all [--input=path] [--out-dir=path] [--lang=he|en|both]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs run-all [--normalize-finals] [--allow-runtime-errors]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs diff --prev=dir-or-file --next=dir-or-file [--out=path]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs promote --diff=path [--next=dir-or-file] [--out=path] [--limit=N]"
  );
  console.log("  node scripts/torah-corpus.mjs verify [--dir=path]");
  console.log(
    "  node scripts/torah-corpus.mjs regress --run-a=dir-or-file --run-b=dir-or-file [--diff-out=path] [--goldens=path] [--regression-out=path]"
  );
  console.log(
    "  node scripts/torah-corpus.mjs regress [--compiled-a=path] [--compiled-b=path] [--update-goldens] [--golden-limit=N]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --out-dir=${DEFAULT_OUT_DIR}`);
  console.log(`  --trace-out=${DEFAULT_TRACE_OUT}`);
  console.log(`  --flows-out=${DEFAULT_FLOWS_OUT}`);
  console.log(`  --report-out=${DEFAULT_EXECUTION_REPORT_OUT}`);
  console.log(`  --verse-trace-out=${DEFAULT_VERSE_TRACE_OUT}`);
  console.log(`  --verse-report-out=${DEFAULT_VERSE_EXECUTION_REPORT_OUT}`);
  console.log(`  --verse-motif-index-out=${DEFAULT_VERSE_MOTIF_INDEX_OUT}`);
  console.log(`  --diff-out=${DEFAULT_DIFF_REPORT_OUT}`);
  console.log(`  --goldens=${DEFAULT_GOLDENS_OUT}`);
  console.log(`  --regression-out=${DEFAULT_REGRESSION_REPORT_OUT}`);
  console.log(`  --token-registry=${DEFAULT_TOKEN_REGISTRY_PATH}`);
  console.log(`  --compiled-bundles=${DEFAULT_COMPILED_BUNDLES_PATH}`);
  console.log(`  --mode=${DEFAULT_EXECUTION_MODE}`);
  console.log(`  --window-size=${DEFAULT_WINDOW_SIZE}`);
  console.log(`  --safety-rail-threshold=${DEFAULT_SAFETY_RAIL_THRESHOLD}`);
  console.log("  --lang=he");
  console.log("  normalize-finals=false");
  console.log("  allow-runtime-errors=false");
}

export function parseCommonRunArgs(argv: string[]): CommonRunArgs {
  const opts: CommonRunArgs = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    lang: "he",
    normalizeFinals: false,
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
    const langOpt = readOptionValue(argv, index, "--lang");
    if (langOpt) {
      opts.lang = langOpt.value as RunLanguage;
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
    if (arg === "--allow-runtime-errors") {
      opts.allowRuntimeErrors = true;
      continue;
    }
  }

  if (!["he", "en", "both"].includes(opts.lang)) {
    throw new Error(`Invalid --lang value: ${opts.lang}`);
  }

  return opts;
}

type ParsedExecutionMode = {
  kind: ExecutionMode;
  windowSize: number | null;
  label: string;
};

function parseExecutionMode(rawMode: string, windowSizeValue: number | null): ParsedExecutionMode {
  const source = String(rawMode ?? DEFAULT_EXECUTION_MODE).trim();
  const normalized = source.toUpperCase();
  const windowMatch = normalized.match(/^WINDOW\((\d+)\)$/u);

  let kind = normalized;
  let windowSize = Number(windowSizeValue);
  if (!Number.isFinite(windowSize)) {
    windowSize = DEFAULT_WINDOW_SIZE;
  }

  if (windowMatch) {
    kind = "WINDOW";
    windowSize = Number(windowMatch[1]);
  }

  if (kind === "WORD" || kind === "VERSE") {
    return {
      kind,
      windowSize: null,
      label: kind
    };
  }

  if (kind === "WINDOW") {
    if (!Number.isInteger(windowSize) || windowSize <= 0) {
      throw new Error(`Invalid WINDOW size: ${windowSizeValue}`);
    }
    return {
      kind,
      windowSize,
      label: `WINDOW(${windowSize})`
    };
  }

  throw new Error(`Invalid --mode value: ${source}. Expected WORD, VERSE, or WINDOW(N).`);
}

export function parseExecuteArgs(argv: string[]): ExecuteArgs {
  const runOpts = parseCommonRunArgs(argv);
  const opts = {
    ...runOpts,
    traceOut: DEFAULT_TRACE_OUT,
    flowsOut: DEFAULT_FLOWS_OUT,
    reportOut: DEFAULT_EXECUTION_REPORT_OUT,
    verseTraceOut: DEFAULT_VERSE_TRACE_OUT,
    verseReportOut: DEFAULT_VERSE_EXECUTION_REPORT_OUT,
    verseMotifIndexOut: DEFAULT_VERSE_MOTIF_INDEX_OUT,
    tokenRegistry: DEFAULT_TOKEN_REGISTRY_PATH,
    compiledBundles: DEFAULT_COMPILED_BUNDLES_PATH,
    semanticVersion: "",
    debugRawEvents: false,
    mode: DEFAULT_EXECUTION_MODE,
    windowSize: DEFAULT_WINDOW_SIZE,
    safetyRail: true,
    safetyRailThreshold: DEFAULT_SAFETY_RAIL_THRESHOLD
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const traceOutOpt = readOptionValue(argv, index, "--trace-out");
    if (traceOutOpt) {
      opts.traceOut = traceOutOpt.value;
      index = traceOutOpt.nextIndex;
      continue;
    }
    const flowsOutOpt = readOptionValue(argv, index, "--flows-out");
    if (flowsOutOpt) {
      opts.flowsOut = flowsOutOpt.value;
      index = flowsOutOpt.nextIndex;
      continue;
    }
    const reportOutOpt = readOptionValue(argv, index, "--report-out");
    if (reportOutOpt) {
      opts.reportOut = reportOutOpt.value;
      index = reportOutOpt.nextIndex;
      continue;
    }
    const verseTraceOutOpt = readOptionValue(argv, index, "--verse-trace-out");
    if (verseTraceOutOpt) {
      opts.verseTraceOut = verseTraceOutOpt.value;
      index = verseTraceOutOpt.nextIndex;
      continue;
    }
    const verseReportOutOpt = readOptionValue(argv, index, "--verse-report-out");
    if (verseReportOutOpt) {
      opts.verseReportOut = verseReportOutOpt.value;
      index = verseReportOutOpt.nextIndex;
      continue;
    }
    const verseMotifIndexOutOpt = readOptionValue(argv, index, "--verse-motif-index-out");
    if (verseMotifIndexOutOpt) {
      opts.verseMotifIndexOut = verseMotifIndexOutOpt.value;
      index = verseMotifIndexOutOpt.nextIndex;
      continue;
    }
    const tokenRegistryOpt = readOptionValue(argv, index, "--token-registry");
    if (tokenRegistryOpt) {
      opts.tokenRegistry = tokenRegistryOpt.value;
      index = tokenRegistryOpt.nextIndex;
      continue;
    }
    const compiledBundlesOpt = readOptionValue(argv, index, "--compiled-bundles");
    if (compiledBundlesOpt) {
      opts.compiledBundles = compiledBundlesOpt.value;
      index = compiledBundlesOpt.nextIndex;
      continue;
    }
    const semanticVersionOpt = readOptionValue(argv, index, "--semantic-version");
    if (semanticVersionOpt) {
      opts.semanticVersion = semanticVersionOpt.value;
      index = semanticVersionOpt.nextIndex;
      continue;
    }
    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.mode = modeOpt.value;
      index = modeOpt.nextIndex;
      continue;
    }
    const windowSizeOpt = readOptionValue(argv, index, "--window-size");
    if (windowSizeOpt) {
      opts.windowSize = Number(windowSizeOpt.value);
      index = windowSizeOpt.nextIndex;
      continue;
    }
    const safetyRailThresholdOpt = readOptionValue(argv, index, "--safety-rail-threshold");
    if (safetyRailThresholdOpt) {
      opts.safetyRailThreshold = Number(safetyRailThresholdOpt.value);
      index = safetyRailThresholdOpt.nextIndex;
      continue;
    }
    if (arg === "--debug-raw-events") {
      opts.debugRawEvents = true;
      continue;
    }
    if (arg === "--safety-rail") {
      opts.safetyRail = true;
      continue;
    }
    if (arg === "--no-safety-rail") {
      opts.safetyRail = false;
      continue;
    }
  }

  const mode = parseExecutionMode(opts.mode, opts.windowSize);
  if (
    !Number.isFinite(opts.safetyRailThreshold) ||
    opts.safetyRailThreshold < 0 ||
    opts.safetyRailThreshold > 1
  ) {
    throw new Error(`Invalid --safety-rail-threshold: ${opts.safetyRailThreshold}`);
  }

  return {
    ...opts,
    mode: mode.kind,
    modeLabel: mode.label,
    windowSize: mode.windowSize
  };
}

export function parseDiffArgs(argv: string[]): DiffArgs {
  const opts: DiffArgs = {
    prev: "",
    next: "",
    out: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const prevOpt = readOptionValue(argv, index, "--prev");
    if (prevOpt) {
      opts.prev = prevOpt.value;
      index = prevOpt.nextIndex;
      continue;
    }
    const nextOpt = readOptionValue(argv, index, "--next");
    if (nextOpt) {
      opts.next = nextOpt.value;
      index = nextOpt.nextIndex;
      continue;
    }
    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt) {
      opts.out = outOpt.value;
      index = outOpt.nextIndex;
      continue;
    }
  }

  if (!opts.prev || !opts.next) {
    throw new Error("diff requires --prev and --next");
  }
  return opts;
}

export function parsePromoteArgs(argv: string[]): PromoteArgs {
  const opts: PromoteArgs = {
    diffPath: "",
    next: "",
    out: DEFAULT_PROMOTE_OUT,
    limit: 40
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const diffOpt = readOptionValue(argv, index, "--diff");
    if (diffOpt) {
      opts.diffPath = diffOpt.value;
      index = diffOpt.nextIndex;
      continue;
    }
    const nextOpt = readOptionValue(argv, index, "--next");
    if (nextOpt) {
      opts.next = nextOpt.value;
      index = nextOpt.nextIndex;
      continue;
    }
    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt) {
      opts.out = outOpt.value;
      index = outOpt.nextIndex;
      continue;
    }
    const limitOpt = readOptionValue(argv, index, "--limit");
    if (limitOpt) {
      opts.limit = Number(limitOpt.value);
      index = limitOpt.nextIndex;
      continue;
    }
  }

  if (!opts.diffPath) {
    throw new Error("promote requires --diff");
  }
  if (!Number.isFinite(opts.limit) || opts.limit <= 0) {
    throw new Error(`Invalid --limit: ${opts.limit}`);
  }
  return opts;
}

export function parseVerifyArgs(argv: string[]): VerifyArgs {
  const opts: VerifyArgs = {
    dir: DEFAULT_OUT_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const dirOpt = readOptionValue(argv, index, "--dir");
    if (dirOpt) {
      opts.dir = dirOpt.value;
      index = dirOpt.nextIndex;
      continue;
    }
  }

  return opts;
}

export function parseRegressArgs(argv: string[]): RegressArgs {
  const opts: RegressArgs = {
    runA: "",
    runB: "",
    diffOut: DEFAULT_DIFF_REPORT_OUT,
    goldens: DEFAULT_GOLDENS_OUT,
    regressionOut: DEFAULT_REGRESSION_REPORT_OUT,
    compiledA: "",
    compiledB: "",
    updateGoldens: false,
    goldenLimit: 60
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const runAOpt = readOptionValue(argv, index, "--run-a");
    if (runAOpt) {
      opts.runA = runAOpt.value;
      index = runAOpt.nextIndex;
      continue;
    }
    const runBOpt = readOptionValue(argv, index, "--run-b");
    if (runBOpt) {
      opts.runB = runBOpt.value;
      index = runBOpt.nextIndex;
      continue;
    }
    const diffOutOpt = readOptionValue(argv, index, "--diff-out");
    if (diffOutOpt) {
      opts.diffOut = diffOutOpt.value;
      index = diffOutOpt.nextIndex;
      continue;
    }
    const goldensOpt = readOptionValue(argv, index, "--goldens");
    if (goldensOpt) {
      opts.goldens = goldensOpt.value;
      index = goldensOpt.nextIndex;
      continue;
    }
    const regressionOutOpt = readOptionValue(argv, index, "--regression-out");
    if (regressionOutOpt) {
      opts.regressionOut = regressionOutOpt.value;
      index = regressionOutOpt.nextIndex;
      continue;
    }
    const compiledAOpt = readOptionValue(argv, index, "--compiled-a");
    if (compiledAOpt) {
      opts.compiledA = compiledAOpt.value;
      index = compiledAOpt.nextIndex;
      continue;
    }
    const compiledBOpt = readOptionValue(argv, index, "--compiled-b");
    if (compiledBOpt) {
      opts.compiledB = compiledBOpt.value;
      index = compiledBOpt.nextIndex;
      continue;
    }
    const goldenLimitOpt = readOptionValue(argv, index, "--golden-limit");
    if (goldenLimitOpt) {
      opts.goldenLimit = Number(goldenLimitOpt.value);
      index = goldenLimitOpt.nextIndex;
      continue;
    }
    if (arg === "--update-goldens") {
      opts.updateGoldens = true;
      continue;
    }
  }

  if (!opts.runA || !opts.runB) {
    throw new Error("regress requires --run-a and --run-b");
  }
  if (!Number.isFinite(opts.goldenLimit) || opts.goldenLimit <= 0) {
    throw new Error(`Invalid --golden-limit: ${opts.goldenLimit}`);
  }

  return opts;
}
