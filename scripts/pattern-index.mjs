#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
const DEFAULT_INDEX_DIR = path.resolve(process.cwd(), "index");
const DEFAULT_REPORT_OUT = path.resolve(process.cwd(), "reports", "pattern_index_report.md");
const KEY_DELIMITER = "|";
const KEY_ESCAPE = "\\";
const DEFAULT_K_MIN = 2;
const DEFAULT_K_MAX = 4;
const DEFAULT_RESULT_LIMIT = 250;

const DEFAULT_MOTIFS = [
  {
    name: "ENDS_WITH_FINALIZE",
    type: "suffix",
    pattern_events: ["*.FINALIZE"],
    description: "Words whose skeleton ends with a finalize operator."
  },
  {
    name: "CONTAINS_BESTOW_THEN_SEAL",
    type: "subsequence",
    pattern_events: ["*.BESTOW", "*.FINALIZE"],
    description: "Words containing BESTOW followed by a sealing/finalize operator."
  }
];

const QUERY_TERM_ALIASES = {
  SEAL: ["FINALIZE", "CLOSE", "UTTER_CLOSE", "ALIGN_FINAL"]
};

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/pattern-index.mjs build [--input=path] [--index-dir=path] [--report-out=path]"
  );
  console.log(
    "  node scripts/pattern-index.mjs build [--counts-out=path] [--occurrences-out=path] [--motif-index-out=path] [--motifs=path]"
  );
  console.log(
    '  node scripts/pattern-index.mjs query skeleton "A|B|C" [--index-dir=path] [--limit=N]'
  );
  console.log(
    '  node scripts/pattern-index.mjs query subsequence "A|B" [--index-dir=path] [--limit=N]'
  );
  console.log('  node scripts/pattern-index.mjs query prefix "A|B" [--index-dir=path] [--limit=N]');
  console.log(
    '  node scripts/pattern-index.mjs query suffix "*.FINALIZE" [--index-dir=path] [--limit=N]'
  );
  console.log(
    '  node scripts/pattern-index.mjs query contains "BESTOW" [--then=SEAL] [--index-dir=path] [--limit=N]'
  );
  console.log(
    "  node scripts/pattern-index.mjs query motif ENDS_WITH_FINALIZE [--index-dir=path] [--limit=N]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --input=${DEFAULT_INPUT}`);
  console.log(`  --index-dir=${DEFAULT_INDEX_DIR}`);
  console.log(`  --report-out=${DEFAULT_REPORT_OUT}`);
  console.log(`  --k-min=${DEFAULT_K_MIN}`);
  console.log(`  --k-max=${DEFAULT_K_MAX}`);
  console.log(`  --limit=${DEFAULT_RESULT_LIMIT}`);
}

function readOptionValue(argv, index, optionName) {
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

function derivedPaths(indexDir) {
  return {
    countsOut: path.join(indexDir, "skeleton_counts.json"),
    occurrencesOut: path.join(indexDir, "skeleton_to_occurrences.bin"),
    motifIndexOut: path.join(indexDir, "motif_index.json"),
    motifsPath: path.join(indexDir, "motifs.json")
  };
}

function parseBuildArgs(argv) {
  const opts = {
    input: DEFAULT_INPUT,
    indexDir: DEFAULT_INDEX_DIR,
    countsOut: "",
    occurrencesOut: "",
    motifIndexOut: "",
    motifsPath: "",
    reportOut: DEFAULT_REPORT_OUT,
    kMin: DEFAULT_K_MIN,
    kMax: DEFAULT_K_MAX
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

    const indexDirOpt = readOptionValue(argv, index, "--index-dir");
    if (indexDirOpt) {
      opts.indexDir = indexDirOpt.value;
      index = indexDirOpt.nextIndex;
      continue;
    }

    const countsOpt = readOptionValue(argv, index, "--counts-out");
    if (countsOpt) {
      opts.countsOut = countsOpt.value;
      index = countsOpt.nextIndex;
      continue;
    }

    const occurrencesOpt = readOptionValue(argv, index, "--occurrences-out");
    if (occurrencesOpt) {
      opts.occurrencesOut = occurrencesOpt.value;
      index = occurrencesOpt.nextIndex;
      continue;
    }

    const motifIndexOpt = readOptionValue(argv, index, "--motif-index-out");
    if (motifIndexOpt) {
      opts.motifIndexOut = motifIndexOpt.value;
      index = motifIndexOpt.nextIndex;
      continue;
    }

    const motifsOpt = readOptionValue(argv, index, "--motifs");
    if (motifsOpt) {
      opts.motifsPath = motifsOpt.value;
      index = motifsOpt.nextIndex;
      continue;
    }

    const reportOpt = readOptionValue(argv, index, "--report-out");
    if (reportOpt) {
      opts.reportOut = reportOpt.value;
      index = reportOpt.nextIndex;
      continue;
    }

    const kMinOpt = readOptionValue(argv, index, "--k-min");
    if (kMinOpt) {
      opts.kMin = Number(kMinOpt.value);
      index = kMinOpt.nextIndex;
      continue;
    }

    const kMaxOpt = readOptionValue(argv, index, "--k-max");
    if (kMaxOpt) {
      opts.kMax = Number(kMaxOpt.value);
      index = kMaxOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument for build: ${arg}`);
  }

  const indexDir = path.resolve(opts.indexDir);
  const derived = derivedPaths(indexDir);
  const kMin = Number(opts.kMin);
  const kMax = Number(opts.kMax);

  if (!Number.isFinite(kMin) || !Number.isFinite(kMax) || kMin < 1 || kMax < kMin) {
    throw new Error(`Invalid k-gram range: kMin=${opts.kMin} kMax=${opts.kMax}`);
  }

  return {
    input: path.resolve(opts.input),
    indexDir,
    countsOut: path.resolve(opts.countsOut || derived.countsOut),
    occurrencesOut: path.resolve(opts.occurrencesOut || derived.occurrencesOut),
    motifIndexOut: path.resolve(opts.motifIndexOut || derived.motifIndexOut),
    motifsPath: path.resolve(opts.motifsPath || derived.motifsPath),
    reportOut: path.resolve(opts.reportOut),
    kMin,
    kMax
  };
}

function parseQueryArgs(argv) {
  if (argv.length < 2) {
    throw new Error("query requires mode + query value");
  }

  const mode = argv[0];
  const opts = {
    mode,
    value: argv[1],
    then: "",
    indexDir: DEFAULT_INDEX_DIR,
    countsPath: "",
    occurrencesPath: "",
    motifIndexPath: "",
    limit: DEFAULT_RESULT_LIMIT
  };

  const validModes = new Set(["skeleton", "subsequence", "prefix", "suffix", "contains", "motif"]);
  if (!validModes.has(mode)) {
    throw new Error(
      `Invalid query mode '${mode}'. Expected one of: ${Array.from(validModes).join(", ")}`
    );
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const thenOpt = readOptionValue(argv, index, "--then");
    if (thenOpt) {
      opts.then = thenOpt.value;
      index = thenOpt.nextIndex;
      continue;
    }

    const indexDirOpt = readOptionValue(argv, index, "--index-dir");
    if (indexDirOpt) {
      opts.indexDir = indexDirOpt.value;
      index = indexDirOpt.nextIndex;
      continue;
    }

    const countsOpt = readOptionValue(argv, index, "--counts");
    if (countsOpt) {
      opts.countsPath = countsOpt.value;
      index = countsOpt.nextIndex;
      continue;
    }

    const occurrencesOpt = readOptionValue(argv, index, "--occurrences");
    if (occurrencesOpt) {
      opts.occurrencesPath = occurrencesOpt.value;
      index = occurrencesOpt.nextIndex;
      continue;
    }

    const motifIndexOpt = readOptionValue(argv, index, "--motif-index");
    if (motifIndexOpt) {
      opts.motifIndexPath = motifIndexOpt.value;
      index = motifIndexOpt.nextIndex;
      continue;
    }

    const limitOpt = readOptionValue(argv, index, "--limit");
    if (limitOpt) {
      opts.limit = Number(limitOpt.value);
      index = limitOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument for query: ${arg}`);
  }

  const indexDir = path.resolve(opts.indexDir);
  const derived = derivedPaths(indexDir);
  const limit = Number(opts.limit);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`Invalid --limit value: ${opts.limit}`);
  }

  return {
    mode: opts.mode,
    value: String(opts.value),
    then: opts.then ? String(opts.then) : "",
    indexDir,
    countsPath: path.resolve(opts.countsPath || derived.countsOut),
    occurrencesPath: path.resolve(opts.occurrencesPath || derived.occurrencesOut),
    motifIndexPath: path.resolve(opts.motifIndexPath || derived.motifIndexOut),
    limit: Math.floor(limit)
  };
}

function toPortablePath(pathName) {
  return String(pathName).split(path.sep).join("/");
}

function workspaceRelativePath(absPath) {
  const resolved = path.resolve(absPath);
  const rel = path.relative(process.cwd(), resolved);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return toPortablePath(rel);
  }
  return toPortablePath(resolved);
}

function sha256FromBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function pathExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function splitEscaped(input, delimiter = KEY_DELIMITER, escapeChar = KEY_ESCAPE) {
  const source = String(input ?? "");
  const out = [];
  let current = "";
  let escaping = false;

  for (const char of source) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === escapeChar) {
      escaping = true;
      continue;
    }
    if (char === delimiter) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (escaping) {
    current += escapeChar;
  }
  out.push(current);
  return out;
}

function escapeSegment(segment, delimiter = KEY_DELIMITER, escapeChar = KEY_ESCAPE) {
  const raw = String(segment ?? "");
  let out = "";
  for (const char of raw) {
    if (char === escapeChar || char === delimiter) {
      out += escapeChar;
    }
    out += char;
  }
  return out;
}

function normalizeSkeletonEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      if (Array.isArray(entry) && typeof entry[0] === "string") {
        return entry[0].trim();
      }
      if (entry && typeof entry === "object" && typeof entry.type === "string") {
        return entry.type.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function skeletonFromTraceRow(row) {
  if (Array.isArray(row?.skeleton)) {
    return normalizeSkeletonEvents(row.skeleton);
  }
  if (Array.isArray(row?.flow_compact)) {
    return normalizeSkeletonEvents(row.flow_compact);
  }
  if (Array.isArray(row?.flow_skeleton)) {
    return normalizeSkeletonEvents(row.flow_skeleton);
  }
  if (Array.isArray(row?.events)) {
    return normalizeSkeletonEvents(row.events);
  }
  return [];
}

function canonicalEventsFromInput(raw) {
  return splitEscaped(raw)
    .map((part) => part.trim())
    .filter(Boolean);
}

function skeletonKeyFromEvents(events) {
  return events.map((event) => escapeSegment(event)).join(KEY_DELIMITER);
}

function eventsFromSkeletonKey(key) {
  return splitEscaped(key)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRefFromRefKey(refKey) {
  const parts = String(refKey ?? "").split("/");
  if (parts.length < 4) {
    return null;
  }
  const wordIndex = Number(parts.pop());
  const verse = Number(parts.pop());
  const chapter = Number(parts.pop());
  const book = parts.join("/");
  if (
    !book ||
    !Number.isFinite(wordIndex) ||
    !Number.isFinite(verse) ||
    !Number.isFinite(chapter)
  ) {
    return null;
  }
  return {
    ref: `${book} ${chapter}:${verse}`,
    word_index: wordIndex
  };
}

function normalizeOccurrence(row, rowIndex) {
  const rowRef = row?.ref && typeof row.ref === "object" ? row.ref : null;
  const refKey =
    typeof row?.ref_key === "string" && row.ref_key.length > 0
      ? row.ref_key
      : rowRef &&
          typeof rowRef.book === "string" &&
          Number.isFinite(Number(rowRef.chapter)) &&
          Number.isFinite(Number(rowRef.verse)) &&
          Number.isFinite(
            Number(rowRef.token_index ?? rowRef.word_index ?? rowRef.word_index_in_verse)
          )
        ? `${rowRef.book}/${Number(rowRef.chapter)}/${Number(rowRef.verse)}/${Number(
            rowRef.token_index ?? rowRef.word_index ?? rowRef.word_index_in_verse
          )}`
        : `ROW/${rowIndex + 1}`;

  const parsed = parseRefFromRefKey(refKey);
  const ref =
    parsed?.ref ??
    (rowRef && typeof rowRef.book === "string"
      ? `${rowRef.book} ${Number(rowRef.chapter ?? 0)}:${Number(rowRef.verse ?? 0)}`
      : "unknown");
  const wordIndex =
    parsed?.word_index ??
    Number(
      rowRef?.token_index ?? rowRef?.word_index ?? rowRef?.word_index_in_verse ?? rowIndex + 1
    );

  return {
    ref,
    word_index: Number.isFinite(wordIndex) ? Number(wordIndex) : rowIndex + 1,
    surface: String(row?.surface ?? ""),
    ref_key: refKey
  };
}

function compareOccurrences(left, right) {
  const keyCmp = String(left.ref_key).localeCompare(String(right.ref_key), "en", {
    numeric: true
  });
  if (keyCmp !== 0) {
    return keyCmp;
  }
  const refCmp = String(left.ref).localeCompare(String(right.ref), "en", { numeric: true });
  if (refCmp !== 0) {
    return refCmp;
  }
  if (left.word_index !== right.word_index) {
    return left.word_index - right.word_index;
  }
  return String(left.surface).localeCompare(String(right.surface), "he");
}

function compareSkeletonKeys(left, right) {
  return String(left).localeCompare(String(right), "en");
}

function normalizeMotifType(value) {
  const raw = String(value ?? "").toLowerCase();
  if (["exact", "subsequence", "prefix", "suffix"].includes(raw)) {
    return raw;
  }
  return "";
}

function normalizeMotifDefinition(rawMotif, index) {
  const name = String(rawMotif?.name ?? "").trim();
  const type = normalizeMotifType(rawMotif?.type);
  const patternEvents = normalizeSkeletonEvents(
    rawMotif?.pattern_events ?? rawMotif?.patternEvents ?? rawMotif?.pattern ?? rawMotif?.events
  );

  if (!name) {
    throw new Error(`Invalid motif at index ${index}: missing name`);
  }
  if (!type) {
    throw new Error(`Invalid motif '${name}': type must be one of exact|subsequence|prefix|suffix`);
  }
  if (patternEvents.length === 0) {
    throw new Error(`Invalid motif '${name}': pattern_events must be non-empty`);
  }

  return {
    name,
    type,
    pattern_events: patternEvents,
    description: String(rawMotif?.description ?? "").trim()
  };
}

async function loadMotifs(motifsPath) {
  if (!(await pathExists(motifsPath))) {
    await fs.mkdir(path.dirname(motifsPath), { recursive: true });
    await fs.writeFile(motifsPath, JSON.stringify(DEFAULT_MOTIFS, null, 2) + "\n", "utf8");
    return DEFAULT_MOTIFS.map((motif, index) => normalizeMotifDefinition(motif, index));
  }

  const raw = JSON.parse(await fs.readFile(motifsPath, "utf8"));
  const sourceArray = Array.isArray(raw) ? raw : Array.isArray(raw?.motifs) ? raw.motifs : null;
  if (!sourceArray) {
    throw new Error(
      `Invalid motifs payload at ${workspaceRelativePath(motifsPath)} (expected array or { motifs: [...] })`
    );
  }

  const motifs = sourceArray.map((entry, index) => normalizeMotifDefinition(entry, index));
  const byName = new Set();
  for (const motif of motifs) {
    if (byName.has(motif.name)) {
      throw new Error(
        `Duplicate motif name '${motif.name}' in ${workspaceRelativePath(motifsPath)}`
      );
    }
    byName.add(motif.name);
  }

  motifs.sort((left, right) => left.name.localeCompare(right.name, "en"));
  return motifs;
}

function createWildcardRegex(pattern) {
  const escaped = String(pattern)
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "u");
}

function eventMatchesPattern(eventName, pattern) {
  const eventValue = String(eventName ?? "")
    .trim()
    .toUpperCase();
  const patternValue = String(pattern ?? "")
    .trim()
    .toUpperCase();
  if (!eventValue || !patternValue) {
    return false;
  }

  if (patternValue.includes("*")) {
    return createWildcardRegex(patternValue).test(eventValue);
  }

  if (eventValue === patternValue) {
    return true;
  }
  if (eventValue.endsWith(`.${patternValue}`)) {
    return true;
  }
  return false;
}

function containsEventTerm(events, termRaw, startIndex = 0) {
  const term = String(termRaw ?? "")
    .trim()
    .toUpperCase();
  if (!term) {
    return -1;
  }

  const aliases = QUERY_TERM_ALIASES[term] ?? [];
  const candidates = [term, ...aliases].map((entry) => entry.toUpperCase());

  for (let index = Math.max(0, startIndex); index < events.length; index += 1) {
    const eventValue = String(events[index] ?? "").toUpperCase();
    if (!eventValue) {
      continue;
    }
    const matched = candidates.some((candidate) => {
      if (!candidate) {
        return false;
      }
      if (candidate.includes("*") || candidate.includes(".")) {
        return eventMatchesPattern(eventValue, candidate);
      }
      return (
        eventValue === candidate ||
        eventValue.endsWith(`.${candidate}`) ||
        eventValue.includes(candidate)
      );
    });
    if (matched) {
      return index;
    }
  }

  return -1;
}

function matchesPrefix(events, patternEvents) {
  if (patternEvents.length > events.length) {
    return false;
  }
  for (let index = 0; index < patternEvents.length; index += 1) {
    if (!eventMatchesPattern(events[index], patternEvents[index])) {
      return false;
    }
  }
  return true;
}

function matchesSuffix(events, patternEvents) {
  if (patternEvents.length > events.length) {
    return false;
  }
  const start = events.length - patternEvents.length;
  for (let index = 0; index < patternEvents.length; index += 1) {
    if (!eventMatchesPattern(events[start + index], patternEvents[index])) {
      return false;
    }
  }
  return true;
}

function matchesSubsequence(events, patternEvents) {
  if (patternEvents.length === 0) {
    return true;
  }
  let position = 0;
  for (const patternEvent of patternEvents) {
    let found = false;
    for (; position < events.length; position += 1) {
      if (eventMatchesPattern(events[position], patternEvent)) {
        found = true;
        position += 1;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

function matchesExact(events, patternEvents) {
  if (events.length !== patternEvents.length) {
    return false;
  }
  for (let index = 0; index < patternEvents.length; index += 1) {
    if (!eventMatchesPattern(events[index], patternEvents[index])) {
      return false;
    }
  }
  return true;
}

function motifMatchesEvents(events, motif) {
  switch (motif.type) {
    case "exact":
      return matchesExact(events, motif.pattern_events);
    case "prefix":
      return matchesPrefix(events, motif.pattern_events);
    case "suffix":
      return matchesSuffix(events, motif.pattern_events);
    case "subsequence":
      return matchesSubsequence(events, motif.pattern_events);
    default:
      return false;
  }
}

function sortObjectByKey(input) {
  const out = {};
  for (const key of Object.keys(input).sort(compareSkeletonKeys)) {
    out[key] = input[key];
  }
  return out;
}

async function writeJson(pathName, payload) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function writeJsonCompact(pathName, payload) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, JSON.stringify(payload), "utf8");
}

async function loadTraceRows(inputPath) {
  const raw = await fs.readFile(inputPath, "utf8");
  const traceSha256 = sha256FromBuffer(Buffer.from(raw, "utf8"));

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(
          `Invalid JSONL line ${index + 1} in ${workspaceRelativePath(inputPath)}: ${String(err?.message ?? err)}`
        );
      }
    });

  return { rows, traceSha256 };
}

function buildKgramPostings(eventsBySkeletonKey, kMin, kMax) {
  const postings = new Map();

  for (let k = kMin; k <= kMax; k += 1) {
    postings.set(k, new Map());
  }

  const skeletonEntries = Array.from(eventsBySkeletonKey.entries()).sort((left, right) =>
    compareSkeletonKeys(left[0], right[0])
  );

  for (const [skeletonKey, events] of skeletonEntries) {
    for (let k = kMin; k <= kMax; k += 1) {
      if (events.length < k) {
        continue;
      }
      const store = postings.get(k);
      for (let index = 0; index + k <= events.length; index += 1) {
        const gramKey = skeletonKeyFromEvents(events.slice(index, index + k));
        const set = store.get(gramKey) ?? new Set();
        set.add(skeletonKey);
        store.set(gramKey, set);
      }
    }
  }

  const out = {};
  for (const [k, store] of postings.entries()) {
    const grams = {};
    for (const gramKey of Array.from(store.keys()).sort(compareSkeletonKeys)) {
      grams[gramKey] = Array.from(store.get(gramKey)).sort(compareSkeletonKeys);
    }
    out[String(k)] = grams;
  }
  return out;
}

function buildTopSkeletons(countsObject, limit = 100) {
  return Object.entries(countsObject)
    .sort((left, right) => right[1] - left[1] || compareSkeletonKeys(left[0], right[0]))
    .slice(0, limit)
    .map(([skeletonKey, count]) => ({ skeleton_key: skeletonKey, count }));
}

async function runBuild(argv) {
  const opts = parseBuildArgs(argv);
  const startNs = process.hrtime.bigint();

  const { rows, traceSha256 } = await loadTraceRows(opts.input);
  const motifs = await loadMotifs(opts.motifsPath);

  const semanticVersions = new Set();
  const countsMap = new Map();
  const occurrencesMap = new Map();
  const eventsBySkeletonKey = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const events = skeletonFromTraceRow(row);
    const skeletonKey = skeletonKeyFromEvents(events);
    const occurrence = normalizeOccurrence(row, index);

    countsMap.set(skeletonKey, (countsMap.get(skeletonKey) ?? 0) + 1);

    const list = occurrencesMap.get(skeletonKey) ?? [];
    list.push(occurrence);
    occurrencesMap.set(skeletonKey, list);

    if (!eventsBySkeletonKey.has(skeletonKey)) {
      eventsBySkeletonKey.set(skeletonKey, events);
    }

    const semanticVersion = String(row?.semantic_version ?? "unknown").trim() || "unknown";
    semanticVersions.add(semanticVersion);
  }

  const countsObject = {};
  for (const key of Array.from(countsMap.keys()).sort(compareSkeletonKeys)) {
    countsObject[key] = countsMap.get(key);
  }

  const occurrencesObject = {};
  const skeletonEventsObject = {};
  for (const key of Array.from(occurrencesMap.keys()).sort(compareSkeletonKeys)) {
    const occurrences = occurrencesMap.get(key).slice().sort(compareOccurrences);
    occurrencesObject[key] = occurrences;
    skeletonEventsObject[key] = eventsBySkeletonKey.get(key) ?? eventsFromSkeletonKey(key);
  }

  const ngramPostings = buildKgramPostings(eventsBySkeletonKey, opts.kMin, opts.kMax);

  const motifIndex = {};
  for (const motif of motifs) {
    const matchingSkeletonKeys = [];
    for (const key of Object.keys(skeletonEventsObject)) {
      const events = skeletonEventsObject[key];
      if (motifMatchesEvents(events, motif)) {
        matchingSkeletonKeys.push(key);
      }
    }
    matchingSkeletonKeys.sort(compareSkeletonKeys);
    const occurrenceCount = matchingSkeletonKeys.reduce(
      (sum, key) => sum + (countsObject[key] ?? 0),
      0
    );

    motifIndex[motif.name] = {
      name: motif.name,
      description: motif.description,
      type: motif.type,
      pattern_events: motif.pattern_events,
      skeleton_count: matchingSkeletonKeys.length,
      occurrence_count: occurrenceCount,
      matching_skeleton_keys: matchingSkeletonKeys
    };
  }

  const sortedSemanticVersions = Array.from(semanticVersions).sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true })
  );

  const countsCanonical = stableStringify(countsObject);
  const skeletonCountsSha256 = sha256FromBuffer(Buffer.from(countsCanonical, "utf8"));

  const countsPayload = {
    schema_version: 1,
    source: {
      trace_path: workspaceRelativePath(opts.input),
      trace_sha256: traceSha256,
      rows: rows.length
    },
    semantic_versions: sortedSemanticVersions,
    key_encoding: {
      delimiter: KEY_DELIMITER,
      escape: KEY_ESCAPE
    },
    unique_skeletons: Object.keys(countsObject).length,
    total_occurrences: rows.length,
    skeleton_counts_sha256: skeletonCountsSha256,
    skeleton_counts: countsObject
  };

  const occurrencesPayload = {
    schema_version: 1,
    format: "json-v1",
    source_trace_sha256: traceSha256,
    semantic_versions: sortedSemanticVersions,
    key_encoding: {
      delimiter: KEY_DELIMITER,
      escape: KEY_ESCAPE
    },
    kgram_index: {
      k_min: opts.kMin,
      k_max: opts.kMax,
      postings: ngramPostings
    },
    skeleton_events: skeletonEventsObject,
    skeleton_to_occurrences: occurrencesObject
  };

  const motifIndexPayload = {
    schema_version: 1,
    source_trace_sha256: traceSha256,
    semantic_versions: sortedSemanticVersions,
    motifs: sortObjectByKey(motifIndex)
  };

  await Promise.all([
    writeJson(opts.countsOut, countsPayload),
    writeJsonCompact(opts.occurrencesOut, occurrencesPayload),
    writeJson(opts.motifIndexOut, motifIndexPayload)
  ]);

  const top100 = buildTopSkeletons(countsObject, 100);
  const reportLines = [
    "# Pattern Index Report",
    "",
    "## Summary",
    `- input_trace: ${workspaceRelativePath(opts.input)}`,
    `- input_trace_sha256: ${traceSha256}`,
    `- semantic_versions: ${sortedSemanticVersions.join(", ") || "(none)"}`,
    `- words_indexed: ${rows.length}`,
    `- unique_skeletons: ${Object.keys(countsObject).length}`,
    `- skeleton_counts_sha256: ${skeletonCountsSha256}`,
    `- skeleton_counts: ${workspaceRelativePath(opts.countsOut)}`,
    `- skeleton_to_occurrences: ${workspaceRelativePath(opts.occurrencesOut)} (json-v1)`,
    `- motif_index: ${workspaceRelativePath(opts.motifIndexOut)}`,
    `- motifs_source: ${workspaceRelativePath(opts.motifsPath)}`,
    "",
    "## Top-100 Skeletons"
  ];

  for (const entry of top100) {
    const flow = eventsFromSkeletonKey(entry.skeleton_key).join(" -> ") || "(empty)";
    reportLines.push(`- ${entry.count} x ${flow}`);
  }

  reportLines.push("", "## Motif Match Counts");
  for (const motifName of Object.keys(motifIndexPayload.motifs)) {
    const motif = motifIndexPayload.motifs[motifName];
    reportLines.push(
      `- ${motif.name}: skeletons=${motif.skeleton_count}, occurrences=${motif.occurrence_count}`
    );
  }

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  reportLines.push("", "## Build Performance", `- elapsed_ms: ${elapsedMs.toFixed(2)}`);

  await writeJson(opts.motifsPath, motifs);
  await fs.mkdir(path.dirname(opts.reportOut), { recursive: true });
  await fs.writeFile(opts.reportOut, reportLines.join("\n") + "\n", "utf8");

  console.log(
    [
      `build: rows=${rows.length}`,
      `uniqueSkeletons=${Object.keys(countsObject).length}`,
      `countsSha256=${skeletonCountsSha256}`,
      `countsOut=${opts.countsOut}`,
      `occurrencesOut=${opts.occurrencesOut}`,
      `motifIndexOut=${opts.motifIndexOut}`,
      `reportOut=${opts.reportOut}`
    ].join(" ")
  );
}

async function loadIndexArtifacts(opts) {
  const [countsRaw, occurrencesRaw] = await Promise.all([
    fs.readFile(opts.countsPath, "utf8"),
    fs.readFile(opts.occurrencesPath, "utf8")
  ]);

  const countsPayload = JSON.parse(countsRaw);
  const occurrencesPayload = JSON.parse(occurrencesRaw);

  if (!countsPayload?.skeleton_counts || !occurrencesPayload?.skeleton_to_occurrences) {
    throw new Error(
      `Invalid index payload in ${workspaceRelativePath(opts.countsPath)} or ${workspaceRelativePath(
        opts.occurrencesPath
      )}`
    );
  }

  return {
    countsPayload,
    occurrencesPayload,
    countsBySkeleton: countsPayload.skeleton_counts,
    occurrencesBySkeleton: occurrencesPayload.skeleton_to_occurrences,
    eventsBySkeleton: occurrencesPayload.skeleton_events ?? {}
  };
}

function sortSkeletonsByCountDesc(keys, countsBySkeleton) {
  return keys.slice().sort((left, right) => {
    const countDelta = (countsBySkeleton[right] ?? 0) - (countsBySkeleton[left] ?? 0);
    if (countDelta !== 0) {
      return countDelta;
    }
    return compareSkeletonKeys(left, right);
  });
}

function collectResultsForSkeletonKeys(matchingSkeletonKeys, indexData, limit) {
  const skeletonKeys = sortSkeletonsByCountDesc(matchingSkeletonKeys, indexData.countsBySkeleton);
  const results = [];

  for (const skeletonKey of skeletonKeys) {
    const occurrences = Array.isArray(indexData.occurrencesBySkeleton[skeletonKey])
      ? indexData.occurrencesBySkeleton[skeletonKey]
      : [];
    const events = Array.isArray(indexData.eventsBySkeleton[skeletonKey])
      ? indexData.eventsBySkeleton[skeletonKey]
      : eventsFromSkeletonKey(skeletonKey);

    for (const occurrence of occurrences) {
      results.push({
        ref: occurrence.ref,
        word_index: occurrence.word_index,
        surface: occurrence.surface,
        ref_key: occurrence.ref_key,
        skeleton_key: skeletonKey,
        flow: events.join(" -> ")
      });
      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

function evaluateContainsMode(events, value, thenValue) {
  const first = containsEventTerm(events, value, 0);
  if (first < 0) {
    return false;
  }
  if (!thenValue) {
    return true;
  }
  const second = containsEventTerm(events, thenValue, first + 1);
  return second >= 0;
}

async function runQuery(argv) {
  const opts = parseQueryArgs(argv);
  const indexData = await loadIndexArtifacts(opts);

  const allSkeletonKeys = Object.keys(indexData.occurrencesBySkeleton).sort(compareSkeletonKeys);
  const matchingSkeletonKeys = [];

  if (opts.mode === "skeleton") {
    const queryEvents = canonicalEventsFromInput(opts.value);
    const queryKey = skeletonKeyFromEvents(queryEvents);
    if (indexData.occurrencesBySkeleton[queryKey]) {
      matchingSkeletonKeys.push(queryKey);
    }
  } else if (["prefix", "suffix", "subsequence"].includes(opts.mode)) {
    const patternEvents = canonicalEventsFromInput(opts.value);
    for (const skeletonKey of allSkeletonKeys) {
      const events = Array.isArray(indexData.eventsBySkeleton[skeletonKey])
        ? indexData.eventsBySkeleton[skeletonKey]
        : eventsFromSkeletonKey(skeletonKey);

      const matched =
        opts.mode === "prefix"
          ? matchesPrefix(events, patternEvents)
          : opts.mode === "suffix"
            ? matchesSuffix(events, patternEvents)
            : matchesSubsequence(events, patternEvents);
      if (matched) {
        matchingSkeletonKeys.push(skeletonKey);
      }
    }
  } else if (opts.mode === "contains") {
    for (const skeletonKey of allSkeletonKeys) {
      const events = Array.isArray(indexData.eventsBySkeleton[skeletonKey])
        ? indexData.eventsBySkeleton[skeletonKey]
        : eventsFromSkeletonKey(skeletonKey);
      if (evaluateContainsMode(events, opts.value, opts.then)) {
        matchingSkeletonKeys.push(skeletonKey);
      }
    }
  } else if (opts.mode === "motif") {
    const motifPayload = JSON.parse(await fs.readFile(opts.motifIndexPath, "utf8"));
    const motif = motifPayload?.motifs?.[opts.value] ?? null;
    if (!motif) {
      const available = Object.keys(motifPayload?.motifs ?? {}).sort(compareSkeletonKeys);
      throw new Error(
        `Unknown motif '${opts.value}'. Available motifs: ${available.join(", ") || "(none)"}`
      );
    }
    for (const skeletonKey of motif.matching_skeleton_keys ?? []) {
      if (indexData.occurrencesBySkeleton[skeletonKey]) {
        matchingSkeletonKeys.push(skeletonKey);
      }
    }
  }

  const dedupedSkeletonKeys = Array.from(new Set(matchingSkeletonKeys)).sort(compareSkeletonKeys);
  const totalOccurrences = dedupedSkeletonKeys.reduce(
    (sum, key) => sum + Number(indexData.countsBySkeleton[key] ?? 0),
    0
  );
  const results = collectResultsForSkeletonKeys(dedupedSkeletonKeys, indexData, opts.limit);

  const payload = {
    mode: opts.mode,
    query: {
      value: opts.value,
      then: opts.then || null
    },
    semantic_versions: indexData.countsPayload.semantic_versions ?? [],
    matched_skeletons: dedupedSkeletonKeys.length,
    total_occurrences: totalOccurrences,
    returned: results.length,
    results
  };

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  if (command === "build") {
    await runBuild(rest);
    return;
  }

  if (command === "query") {
    await runQuery(rest);
    return;
  }

  throw new Error(`Unknown command '${command}'. Expected build or query.`);
}

main().catch((err) => {
  console.error(`[pattern-index] ${String(err?.message ?? err)}`);
  process.exit(1);
});
