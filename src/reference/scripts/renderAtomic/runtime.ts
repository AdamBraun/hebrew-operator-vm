import fs from "node:fs/promises";
import path from "node:path";
import {
  renderAtomicRenderedEventsJsonl,
  renderAtomicRenderedEventsText,
  renderAtomicWordEvents,
  type AtomicEventRecord,
  type AtomicRenderedEvent,
  type AtomicWordRecord
} from "../../render/atomic";
import { isTraceEventKind } from "../../trace/types";

export const DEFAULT_TRACE = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
export const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "outputs", "render", "atomic");
export const ATOMIC_EVENTS_TEXT_FILE = "atomic_events.txt";
export const ATOMIC_EVENTS_JSONL_FILE = "atomic_events.jsonl";

export type RenderAtomicOptions = {
  trace: string;
  outDir: string;
};

export type BuildAtomicArtifactsResult = {
  words: number;
  events: number;
  rows: AtomicRenderedEvent[];
  atomicEventsText: string;
  atomicEventsJsonl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareRefKeyLike(left: string, right: string): number {
  const leftParts = String(left).split("/");
  const rightParts = String(right).split("/");
  const maxLen = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLen; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    if (leftPart === rightPart) {
      continue;
    }
    const leftIsInt = /^[0-9]+$/u.test(leftPart);
    const rightIsInt = /^[0-9]+$/u.test(rightPart);
    if (leftIsInt && rightIsInt) {
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

function asPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function readOptionValue(argv: string[], index: number, optionName: string): string | null {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return arg.slice(prefix.length);
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return argv[index + 1];
  }
  return null;
}

function parseWordIndexFromRefKey(refKey: string): number | null {
  const parts = String(refKey).split("/");
  return asPositiveInt(parts[parts.length - 1]);
}

function parseAtomicEvent(
  value: unknown,
  fallbackIndex: number,
  lineNumber: number,
  sourcePath: string
): AtomicEventRecord {
  if (!isRecord(value)) {
    throw new Error(
      `render atomic: line ${lineNumber} in ${sourcePath} has non-object event at index ${fallbackIndex}`
    );
  }

  const kindValue = value.kind;
  if (typeof kindValue !== "string" || !isTraceEventKind(kindValue)) {
    throw new Error(
      `render atomic: line ${lineNumber} in ${sourcePath} has unknown event kind "${String(kindValue)}"`
    );
  }

  return {
    kind: kindValue,
    index: asNonNegativeInt(value.index, fallbackIndex),
    tau: asFiniteNumber(value.tau, fallbackIndex),
    source: typeof value.source === "string" && value.source.length > 0 ? value.source : "legacy",
    payload: "payload" in value ? value.payload : {}
  };
}

function parseSkeletonEvents(
  skeleton: readonly unknown[],
  lineNumber: number,
  sourcePath: string
): AtomicEventRecord[] {
  const out: AtomicEventRecord[] = [];
  for (let index = 0; index < skeleton.length; index += 1) {
    const kind = skeleton[index];
    if (typeof kind !== "string" || !isTraceEventKind(kind)) {
      throw new Error(
        `render atomic: line ${lineNumber} in ${sourcePath} has unknown skeleton event "${String(kind)}"`
      );
    }
    out.push({
      kind,
      index,
      tau: index,
      source: "legacy",
      payload: {}
    });
  }
  return out;
}

export function printHelp(): void {
  console.log("Usage:");
  console.log("  npm run render:atomic -- [--trace=path] [--out=dir]");
  console.log(
    "  node dist/src/reference/scripts/renderAtomic/runtime.js [--trace=path] [--out=dir]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --trace=${DEFAULT_TRACE}`);
  console.log(`  --out=${DEFAULT_OUT_DIR}`);
  console.log(`  output files: ${ATOMIC_EVENTS_TEXT_FILE}, ${ATOMIC_EVENTS_JSONL_FILE}`);
}

export function parseArgs(argv: string[]): RenderAtomicOptions {
  const opts: RenderAtomicOptions = {
    trace: DEFAULT_TRACE,
    outDir: DEFAULT_OUT_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const traceOpt = readOptionValue(argv, index, "--trace");
    if (traceOpt !== null) {
      opts.trace = traceOpt;
      if (arg === "--trace") {
        index += 1;
      }
      continue;
    }

    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt !== null) {
      opts.outDir = outOpt;
      if (arg === "--out") {
        index += 1;
      }
      continue;
    }

    throw new Error(`Unknown argument '${arg}'`);
  }

  return opts;
}

export function parseAtomicWordRecordsFromJsonl(
  traceJsonl: string,
  sourcePath: string
): AtomicWordRecord[] {
  const out: AtomicWordRecord[] = [];
  const lines = String(traceJsonl ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex] ?? "";
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const lineNumber = lineIndex + 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `render atomic: line ${lineNumber} in ${sourcePath} is invalid JSON (${String(error)})`
      );
    }

    if (!isRecord(parsed)) {
      throw new Error(
        `render atomic: line ${lineNumber} in ${sourcePath} must be a JSON object record`
      );
    }

    const recordKind = parsed.record_kind;
    if (recordKind === "VERSE_TRACE") {
      continue;
    }
    if (recordKind !== undefined && recordKind !== "WORD_TRACE") {
      throw new Error(
        `render atomic: line ${lineNumber} in ${sourcePath} has unsupported record_kind "${String(recordKind)}"`
      );
    }

    const refKey = typeof parsed.ref_key === "string" ? parsed.ref_key : "";
    if (!refKey) {
      throw new Error(`render atomic: line ${lineNumber} in ${sourcePath} is missing ref_key`);
    }

    const refObj = parsed.ref;
    const refWordIndex =
      isRecord(refObj) && "token_index" in refObj ? asPositiveInt(refObj.token_index) : null;
    const wordIndex = refWordIndex ?? parseWordIndexFromRefKey(refKey) ?? lineNumber;

    let events: AtomicEventRecord[] = [];
    if (Array.isArray(parsed.events)) {
      events = parsed.events.map((event, index) =>
        parseAtomicEvent(event, index, lineNumber, sourcePath)
      );
    } else if (Array.isArray(parsed.skeleton)) {
      events = parseSkeletonEvents(parsed.skeleton, lineNumber, sourcePath);
    } else if (recordKind === "WORD_TRACE") {
      throw new Error(
        `render atomic: line ${lineNumber} in ${sourcePath} is missing events for WORD_TRACE`
      );
    }

    out.push({
      ref_key: refKey,
      word_index: wordIndex,
      events
    });
  }

  out.sort(
    (left, right) =>
      compareRefKeyLike(left.ref_key, right.ref_key) ||
      left.word_index - right.word_index ||
      left.events.length - right.events.length
  );
  return out;
}

export function buildAtomicArtifactsFromTraceJsonl(
  traceJsonl: string,
  sourcePath: string
): BuildAtomicArtifactsResult {
  const words = parseAtomicWordRecordsFromJsonl(traceJsonl, sourcePath);
  const rows: AtomicRenderedEvent[] = [];
  for (const word of words) {
    rows.push(...renderAtomicWordEvents(word));
  }

  return {
    words: words.length,
    events: rows.length,
    rows,
    atomicEventsText: renderAtomicRenderedEventsText(rows),
    atomicEventsJsonl: renderAtomicRenderedEventsJsonl(rows)
  };
}

export async function runAtomicRender(
  opts: RenderAtomicOptions
): Promise<BuildAtomicArtifactsResult> {
  const tracePath = path.resolve(opts.trace);
  const outDir = path.resolve(opts.outDir);
  const traceJsonl = await fs.readFile(tracePath, "utf8");
  const artifacts = buildAtomicArtifactsFromTraceJsonl(traceJsonl, tracePath);

  await fs.mkdir(outDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outDir, ATOMIC_EVENTS_TEXT_FILE), artifacts.atomicEventsText, "utf8"),
    fs.writeFile(path.join(outDir, ATOMIC_EVENTS_JSONL_FILE), artifacts.atomicEventsJsonl, "utf8")
  ]);

  return artifacts;
}

export async function main(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);
  const result = await runAtomicRender(opts);
  console.log(
    `done: words=${result.words} events=${result.events} trace=${path.resolve(opts.trace)} outDir=${path.resolve(opts.outDir)}`
  );
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
