#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TRACE = path.resolve(process.cwd(), "corpus", "word_traces.jsonl");
const DEFAULT_SKELETON_COUNTS = path.resolve(process.cwd(), "index", "skeleton_counts.json");
const DEFAULT_MOTIF_INDEX = path.resolve(process.cwd(), "index", "motif_index.json");
const DEFAULT_OUT = path.resolve(process.cwd(), "exemplars", "exemplars.json");
const DEFAULT_README_OUT = path.resolve(process.cwd(), "exemplars", "README.md");
const DEFAULT_REGRESSION_OUT = path.resolve(process.cwd(), "tests", "exemplar_regression.json");
const DEFAULT_MINIMUM_EXEMPLARS = 30;
const DEFAULT_TOP_SKELETONS = 10;
const DEFAULT_MOTIF_EXAMPLES_PER_MOTIF = 2;
const DEFAULT_REGRESSION_LIMIT = 18;

const CATEGORY_DEFS = [
  {
    id: "high_frequency_skeletons",
    title: "High-frequency skeleton exemplars",
    description: "Top recurring skeletons; baseline references for broad stability checks."
  },
  {
    id: "special_marks",
    title: "Special mark exemplars",
    description: "Mappiq, shin/sin dots, and dagesh-sensitive words."
  },
  {
    id: "operator_family",
    title: "Operator-family exemplars",
    description: "Coverage-oriented picks that ensure every observed operator remains represented."
  },
  {
    id: "boundary_finals",
    title: "Boundary and final-form exemplars",
    description:
      "Word-edge behavior, auto-discharge/auto-close behavior, and final-letter form semantics."
  },
  {
    id: "motif_driven",
    title: "Motif-driven exemplars",
    description: "Representative examples selected from the motif index."
  }
];

const PRIMARY_CATEGORY_ORDER = [
  "special_marks",
  "boundary_finals",
  "motif_driven",
  "high_frequency_skeletons",
  "operator_family"
];

const OPERATOR_PRIORITY = [
  "ALEPH.ALIAS",
  "GIMEL.BESTOW",
  "DALET.BOUNDARY_CLOSE",
  "HE.DECLARE",
  "HE.DECLARE_BREATH",
  "HE.DECLARE_PIN",
  "ZAYIN.GATE",
  "HET.COMPARTMENT",
  "TET.COVERT",
  "LAMED.ENDPOINT",
  "MEM.OPEN",
  "NUN.SUPPORT_DEBT",
  "SAMEKH.SUPPORT_DISCHARGE",
  "PE.UTTER",
  "TSADI.ALIGN",
  "QOF.APPROX",
  "RESH.BOUNDARY_CLOSE",
  "SHIN.FORK",
  "TAV.FINALIZE",
  "FINAL_MEM.CLOSE",
  "FINAL_NUN.SUPPORT_DEBT",
  "FINAL_NUN.SUPPORT_DISCHARGE",
  "FINAL_PE.UTTER_CLOSE",
  "FINAL_TSADI.ALIGN_FINAL",
  "SPACE.SUPPORT_DISCHARGE",
  "SPACE.MEM_AUTO_CLOSE"
];

const OPERATOR_LABELS = {
  "ALEPH.ALIAS": "alias remap",
  "GIMEL.BESTOW": "bestowal",
  "DALET.BOUNDARY_CLOSE": "boundary close",
  "HE.DECLARE": "public declaration",
  "HE.DECLARE_BREATH": "breath-tail declaration",
  "HE.DECLARE_PIN": "mappiq pin export",
  "ZAYIN.GATE": "gate routing",
  "HET.COMPARTMENT": "compartment behavior",
  "TET.COVERT": "covert behavior",
  "LAMED.ENDPOINT": "endpoint binding",
  "MEM.OPEN": "mem-zone open",
  "NUN.SUPPORT_DEBT": "support debt",
  "SAMEKH.SUPPORT_DISCHARGE": "support discharge",
  "PE.UTTER": "utterance",
  "TSADI.ALIGN": "alignment",
  "QOF.APPROX": "approximation",
  "RESH.BOUNDARY_CLOSE": "boundary close",
  "SHIN.FORK": "fork routing",
  "TAV.FINALIZE": "finalization",
  "FINAL_MEM.CLOSE": "final-mem close",
  "FINAL_NUN.SUPPORT_DEBT": "final-nun support debt",
  "FINAL_NUN.SUPPORT_DISCHARGE": "final-nun discharge",
  "FINAL_PE.UTTER_CLOSE": "final-pe close",
  "FINAL_TSADI.ALIGN_FINAL": "final-tsadi align-final",
  "SPACE.SUPPORT_DISCHARGE": "boundary support discharge",
  "SPACE.MEM_AUTO_CLOSE": "boundary mem auto-close"
};

const REQUIRED_REGRESSION_TAGS = [
  "mark:mappiq",
  "mark:sin_dot",
  "mark:shin_dot",
  "mark:dagesh",
  "final:kaf_surface",
  "final:mem",
  "final:nun",
  "final:pe",
  "final:tsadi",
  "boundary:support_discharge",
  "boundary:mem_auto_close"
];

const VERSION_NOTE_DEFAULT =
  "Auto-generated exemplar set for this semantic version. Update this note when semantics change materially.";

function printHelp() {
  console.log("Usage:");
  console.log(
    "  node scripts/exemplar-library.mjs build [--trace=path] [--skeleton-counts=path] [--motif-index=path]"
  );
  console.log(
    "  node scripts/exemplar-library.mjs build [--out=path] [--readme-out=path] [--regression-out=path]"
  );
  console.log(
    "  node scripts/exemplar-library.mjs build [--minimum=N] [--top-skeletons=N] [--motif-per-motif=N] [--regression-limit=N]"
  );
  console.log(
    "  node scripts/exemplar-library.mjs verify [--trace=path] [--out=path] [--readme-out=path] [--regression-out=path]"
  );
  console.log("");
  console.log("Defaults:");
  console.log(`  --trace=${DEFAULT_TRACE}`);
  console.log(`  --skeleton-counts=${DEFAULT_SKELETON_COUNTS}`);
  console.log(`  --motif-index=${DEFAULT_MOTIF_INDEX}`);
  console.log(`  --out=${DEFAULT_OUT}`);
  console.log(`  --readme-out=${DEFAULT_README_OUT}`);
  console.log(`  --regression-out=${DEFAULT_REGRESSION_OUT}`);
  console.log(`  --minimum=${DEFAULT_MINIMUM_EXEMPLARS}`);
  console.log(`  --top-skeletons=${DEFAULT_TOP_SKELETONS}`);
  console.log(`  --motif-per-motif=${DEFAULT_MOTIF_EXAMPLES_PER_MOTIF}`);
  console.log(`  --regression-limit=${DEFAULT_REGRESSION_LIMIT}`);
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

function parseArgs(argv) {
  const opts = {
    trace: DEFAULT_TRACE,
    skeletonCounts: DEFAULT_SKELETON_COUNTS,
    motifIndex: DEFAULT_MOTIF_INDEX,
    out: DEFAULT_OUT,
    readmeOut: DEFAULT_README_OUT,
    regressionOut: DEFAULT_REGRESSION_OUT,
    minimum: DEFAULT_MINIMUM_EXEMPLARS,
    topSkeletons: DEFAULT_TOP_SKELETONS,
    motifPerMotif: DEFAULT_MOTIF_EXAMPLES_PER_MOTIF,
    regressionLimit: DEFAULT_REGRESSION_LIMIT
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const traceOpt = readOptionValue(argv, index, "--trace");
    if (traceOpt) {
      opts.trace = traceOpt.value;
      index = traceOpt.nextIndex;
      continue;
    }

    const skeletonCountsOpt = readOptionValue(argv, index, "--skeleton-counts");
    if (skeletonCountsOpt) {
      opts.skeletonCounts = skeletonCountsOpt.value;
      index = skeletonCountsOpt.nextIndex;
      continue;
    }

    const motifIndexOpt = readOptionValue(argv, index, "--motif-index");
    if (motifIndexOpt) {
      opts.motifIndex = motifIndexOpt.value;
      index = motifIndexOpt.nextIndex;
      continue;
    }

    const outOpt = readOptionValue(argv, index, "--out");
    if (outOpt) {
      opts.out = outOpt.value;
      index = outOpt.nextIndex;
      continue;
    }

    const readmeOutOpt = readOptionValue(argv, index, "--readme-out");
    if (readmeOutOpt) {
      opts.readmeOut = readmeOutOpt.value;
      index = readmeOutOpt.nextIndex;
      continue;
    }

    const regressionOutOpt = readOptionValue(argv, index, "--regression-out");
    if (regressionOutOpt) {
      opts.regressionOut = regressionOutOpt.value;
      index = regressionOutOpt.nextIndex;
      continue;
    }

    const minOpt = readOptionValue(argv, index, "--minimum");
    if (minOpt) {
      opts.minimum = Number(minOpt.value);
      index = minOpt.nextIndex;
      continue;
    }

    const topSkeletonsOpt = readOptionValue(argv, index, "--top-skeletons");
    if (topSkeletonsOpt) {
      opts.topSkeletons = Number(topSkeletonsOpt.value);
      index = topSkeletonsOpt.nextIndex;
      continue;
    }

    const motifPerMotifOpt = readOptionValue(argv, index, "--motif-per-motif");
    if (motifPerMotifOpt) {
      opts.motifPerMotif = Number(motifPerMotifOpt.value);
      index = motifPerMotifOpt.nextIndex;
      continue;
    }

    const regressionLimitOpt = readOptionValue(argv, index, "--regression-limit");
    if (regressionLimitOpt) {
      opts.regressionLimit = Number(regressionLimitOpt.value);
      index = regressionLimitOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const parsePositiveInt = (value, name) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      throw new Error(`Invalid ${name} value: ${value}`);
    }
    return Math.floor(numeric);
  };

  const minimum = parsePositiveInt(opts.minimum, "--minimum");
  const topSkeletons = parsePositiveInt(opts.topSkeletons, "--top-skeletons");
  const motifPerMotif = parsePositiveInt(opts.motifPerMotif, "--motif-per-motif");
  const regressionLimit = parsePositiveInt(opts.regressionLimit, "--regression-limit");

  return {
    trace: path.resolve(opts.trace),
    skeletonCounts: path.resolve(opts.skeletonCounts),
    motifIndex: path.resolve(opts.motifIndex),
    out: path.resolve(opts.out),
    readmeOut: path.resolve(opts.readmeOut),
    regressionOut: path.resolve(opts.regressionOut),
    minimum,
    topSkeletons,
    motifPerMotif,
    regressionLimit
  };
}

function toPortablePath(pathName) {
  return String(pathName).split(path.sep).join("/");
}

function workspaceRelativePath(absPath) {
  const fullPath = path.resolve(absPath);
  const rel = path.relative(process.cwd(), fullPath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return toPortablePath(rel);
  }
  return toPortablePath(fullPath);
}

function buildRefKey(ref) {
  return `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`;
}

function toArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice();
}

function normalizeRow(raw, index) {
  const ref = {
    book: String(raw?.ref?.book ?? "unknown"),
    chapter: Number(raw?.ref?.chapter ?? 0),
    verse: Number(raw?.ref?.verse ?? 0),
    token_index: Number(raw?.ref?.token_index ?? 0)
  };
  const ref_key = String(raw?.ref_key ?? buildRefKey(ref));
  const surface = String(raw?.surface ?? "");
  const token_ids = toArray(raw?.token_ids ?? raw?.tokens).map((value) => Number(value));
  const skeletonRaw = toArray(raw?.skeleton ?? raw?.flow_compact ?? raw?.flow_skeleton).map((value) =>
    String(value)
  );
  const skeleton = skeletonRaw.filter(Boolean);
  const flow = String(
    raw?.flow ?? raw?.one_liner ?? (skeleton.join(" -> ") || "(no semantic events)")
  );
  const semantic_version =
    String(raw?.semantic_version ?? raw?.semantics_version ?? "unknown").trim().length > 0
      ? String(raw.semantic_version ?? raw.semantics_version).trim()
      : "unknown";

  return {
    _index: index,
    ref,
    ref_key,
    surface,
    token_ids,
    skeleton,
    flow,
    semantic_version
  };
}

async function readJson(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return JSON.parse(raw);
}

async function readJsonMaybe(pathName) {
  try {
    return await readJson(pathName);
  } catch (err) {
    if (err?.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function readJsonlRows(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => normalizeRow(JSON.parse(line), index));
}

function compareRefKey(left, right) {
  return left.localeCompare(right, "en", { numeric: true });
}

function compareSkeletonKey(left, right) {
  return left.localeCompare(right, "en", { numeric: true });
}

function skeletonKeyFromRow(row) {
  return row.skeleton.join("|");
}

function computeSkeletonCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = skeletonKeyFromRow(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toSortedCountsEntries(countsMap) {
  return Array.from(countsMap.entries()).sort(
    (left, right) => right[1] - left[1] || compareSkeletonKey(left[0], right[0])
  );
}

function buildIndexes(rows) {
  const rowByRefKey = new Map();
  const rowsBySkeleton = new Map();
  const rowsByEvent = new Map();
  const semanticVersions = new Set();

  for (const row of rows) {
    rowByRefKey.set(row.ref_key, row);

    const skeletonKey = skeletonKeyFromRow(row);
    const bySkeleton = rowsBySkeleton.get(skeletonKey) ?? [];
    bySkeleton.push(row);
    rowsBySkeleton.set(skeletonKey, bySkeleton);

    for (const event of row.skeleton) {
      const byEvent = rowsByEvent.get(event) ?? [];
      byEvent.push(row);
      rowsByEvent.set(event, byEvent);
    }

    semanticVersions.add(row.semantic_version);
  }

  return {
    rowByRefKey,
    rowsBySkeleton,
    rowsByEvent,
    semanticVersions
  };
}

function createSelector() {
  const selected = new Map();

  const select = (row, details) => {
    if (!row) {
      return false;
    }

    const entry =
      selected.get(row.ref_key) ??
      {
        row,
        categories: [],
        tags: new Set(),
        motifs: new Set(),
        operators: new Set()
      };

    if (!entry.categories.includes(details.category)) {
      entry.categories.push(details.category);
    }

    for (const tag of details.tags ?? []) {
      entry.tags.add(tag);
    }
    for (const motifName of details.motifs ?? []) {
      entry.motifs.add(motifName);
      entry.tags.add(`motif:${motifName}`);
    }
    for (const operator of details.operators ?? []) {
      entry.operators.add(operator);
      entry.tags.add(`operator:${operator}`);
    }

    selected.set(row.ref_key, entry);
    return true;
  };

  return { selected, select };
}

function pickFirstRow(rows, predicate, preferUnselected = false, selectedSet = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  if (preferUnselected && selectedSet) {
    for (const row of rows) {
      if (selectedSet.has(row.ref_key)) {
        continue;
      }
      if (predicate(row)) {
        return row;
      }
    }
  }
  for (const row of rows) {
    if (predicate(row)) {
      return row;
    }
  }
  return null;
}

function collectCoveredEvents(selectedValues) {
  const covered = new Set();
  for (const entry of selectedValues) {
    for (const event of entry.row.skeleton) {
      covered.add(event);
    }
  }
  return covered;
}

function sortEventsForCoverage(eventsSet) {
  const priorityIndex = new Map(OPERATOR_PRIORITY.map((event, index) => [event, index]));
  return Array.from(eventsSet).sort((left, right) => {
    const leftPriority = priorityIndex.has(left) ? priorityIndex.get(left) : Number.MAX_SAFE_INTEGER;
    const rightPriority = priorityIndex.has(right)
      ? priorityIndex.get(right)
      : Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.localeCompare(right, "en", { numeric: true });
  });
}

function toSortedSetArray(inputSet) {
  return Array.from(inputSet).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

function choosePrimaryCategory(categories) {
  for (const category of PRIMARY_CATEGORY_ORDER) {
    if (categories.includes(category)) {
      return category;
    }
  }
  return categories[0] ?? CATEGORY_DEFS[0].id;
}

function buildExplanation(entry) {
  const tags = entry.tags;
  const motifs = Array.from(entry.motifs).sort(compareRefKey);
  const operators = Array.from(entry.operators).sort(compareRefKey);

  if (tags.has("mark:mappiq")) {
    return "Contains mappiq (הּ), so the trace must include HE.DECLARE_PIN in a stable place.";
  }
  if (tags.has("mark:sin_dot")) {
    return "Contains sin-dot (U+05C2), validating left-dot shin/sin disambiguation.";
  }
  if (tags.has("mark:shin_dot")) {
    return "Contains shin-dot (U+05C1), validating right-dot fork routing semantics.";
  }
  if (tags.has("mark:dagesh")) {
    return "Contains dagesh (U+05BC), checking hardened-mark tokenization without trace drift.";
  }
  if (tags.has("boundary:mem_auto_close")) {
    return "Shows boundary-triggered mem auto-close (SPACE.MEM_AUTO_CLOSE) at word end.";
  }
  if (tags.has("boundary:support_discharge")) {
    return "Shows support debt resolved at boundary via SPACE.SUPPORT_DISCHARGE.";
  }
  if (tags.has("final:nun")) {
    return "Representative final-nun discharge pair; both debt and discharge must remain coupled.";
  }
  if (tags.has("final:mem")) {
    return "Representative final-mem close behavior; word-final closure should stay deterministic.";
  }
  if (tags.has("final:pe")) {
    return "Representative final-pe utterance close behavior at word boundary.";
  }
  if (tags.has("final:tsadi")) {
    return "Representative final-tsadi align-final behavior at word end.";
  }
  if (tags.has("final:kaf_surface")) {
    return "Surface ends with final kaf (ך), preserving final-form boundary behavior.";
  }
  if (motifs.length > 0) {
    return `Representative motif case (${motifs[0]}) chosen for stable motif-level validation.`;
  }
  if (operators.length > 0) {
    const operator = operators[0];
    const label = OPERATOR_LABELS[operator] ?? operator;
    return `Representative operator-family case for ${operator} (${label}).`;
  }
  if (tags.has("high_frequency")) {
    return "High-frequency baseline skeleton used as a broad regression anchor.";
  }
  return "Stable representative case used for publication and regression validation.";
}

function toReferenceString(ref) {
  return `${ref.book} ${ref.chapter}:${ref.verse}#${ref.token_index}`;
}

function normalizeVersionNotes(existingNotes, semanticVersions) {
  const out = [];
  const seenVersions = new Set();

  if (Array.isArray(existingNotes)) {
    for (const note of existingNotes) {
      const semanticVersion = String(note?.semantic_version ?? "").trim();
      const text = String(note?.note ?? "").trim();
      if (!semanticVersion || seenVersions.has(semanticVersion)) {
        continue;
      }
      out.push({
        semantic_version: semanticVersion,
        note: text || VERSION_NOTE_DEFAULT
      });
      seenVersions.add(semanticVersion);
    }
  }

  for (const semanticVersion of semanticVersions) {
    if (seenVersions.has(semanticVersion)) {
      continue;
    }
    out.push({
      semantic_version: semanticVersion,
      note: VERSION_NOTE_DEFAULT
    });
    seenVersions.add(semanticVersion);
  }

  return out.sort((left, right) =>
    left.semantic_version.localeCompare(right.semantic_version, "en", { numeric: true })
  );
}

function buildExemplarPayload({
  rows,
  indexes,
  countsEntries,
  motifPayload,
  selectedEntries,
  opts,
  existingVersionNotes,
  traceSha256
}) {
  const observedEvents = new Set(indexes.rowsByEvent.keys());
  const coveredEvents = collectCoveredEvents(selectedEntries);
  const missingEvents = sortEventsForCoverage(
    new Set(sortEventsForCoverage(observedEvents).filter((event) => !coveredEvents.has(event)))
  );

  if (missingEvents.length > 0) {
    throw new Error(
      `Failed to cover observed operator events: ${missingEvents.join(", ")}. Add representative selector rules.`
    );
  }

  const displayCategoryIndex = new Map(CATEGORY_DEFS.map((category, index) => [category.id, index]));
  const sortedEntries = selectedEntries
    .slice()
    .sort((left, right) => {
      const leftPrimary = choosePrimaryCategory(left.categories);
      const rightPrimary = choosePrimaryCategory(right.categories);
      const leftCategoryIndex = displayCategoryIndex.get(leftPrimary) ?? Number.MAX_SAFE_INTEGER;
      const rightCategoryIndex = displayCategoryIndex.get(rightPrimary) ?? Number.MAX_SAFE_INTEGER;
      if (leftCategoryIndex !== rightCategoryIndex) {
        return leftCategoryIndex - rightCategoryIndex;
      }
      return left.row._index - right.row._index;
    })
    .map((entry, index) => {
      const tags = toSortedSetArray(entry.tags);
      return {
        id: `ex-${String(index + 1).padStart(3, "0")}`,
        category: choosePrimaryCategory(entry.categories),
        ref: entry.row.ref,
        ref_key: entry.row.ref_key,
        surface: entry.row.surface,
        token_ids: entry.row.token_ids,
        skeleton: entry.row.skeleton,
        flow: entry.row.flow,
        semantic_version: entry.row.semantic_version,
        explanation: buildExplanation(entry),
        tags
      };
    });

  if (sortedEntries.length < opts.minimum) {
    throw new Error(
      `Exemplar selection produced ${sortedEntries.length} entries; minimum required is ${opts.minimum}.`
    );
  }

  const semanticVersions = toSortedSetArray(indexes.semanticVersions);
  const topSkeletonPreview = countsEntries
    .filter(([key]) => key.length > 0)
    .slice(0, opts.topSkeletons)
    .map(([skeletonKey, count]) => ({ skeleton_key: skeletonKey, count }));

  return {
    schema_version: 1,
    source: {
      trace_path: workspaceRelativePath(opts.trace),
      trace_sha256: traceSha256,
      skeleton_counts_path: workspaceRelativePath(opts.skeletonCounts),
      motif_index_path: workspaceRelativePath(opts.motifIndex)
    },
    selection_policy: {
      minimum_exemplars: opts.minimum,
      top_skeleton_target: opts.topSkeletons,
      top_skeleton_examples_per_skeleton: 1,
      motif_examples_per_motif: opts.motifPerMotif,
      operator_coverage_target: "all observed skeleton events"
    },
    semantic_versions: semanticVersions,
    stats: {
      rows_scanned: rows.length,
      selected_exemplars: sortedEntries.length,
      observed_operator_events: sortEventsForCoverage(observedEvents),
      covered_operator_events: sortEventsForCoverage(coveredEvents),
      motifs_available: Object.keys(motifPayload?.motifs ?? {}).length
    },
    categories: CATEGORY_DEFS,
    maintenance_rule: {
      trigger: "semantic_version change",
      steps: [
        "Run corpus diff/regression and rebuild exemplars.",
        "Update exemplar explanations only when skeleton meaning changes.",
        "Keep prior semantic-version notes in version_notes; append new notes instead of overwriting history."
      ]
    },
    version_notes: normalizeVersionNotes(existingVersionNotes, semanticVersions),
    top_skeleton_preview: topSkeletonPreview,
    exemplars: sortedEntries
  };
}

function buildRegressionNotes(tags) {
  const preferredPrefixes = ["mark:", "final:", "boundary:", "motif:", "operator:"];
  const noteTags = [];
  for (const prefix of preferredPrefixes) {
    for (const tag of tags) {
      if (!tag.startsWith(prefix)) {
        continue;
      }
      if (!noteTags.includes(tag)) {
        noteTags.push(tag);
      }
    }
  }
  if (noteTags.length === 0) {
    return "exemplar";
  }
  return noteTags.slice(0, 3).join(", ");
}

function scoreForRegression(exemplar) {
  let score = 0;
  for (const tag of exemplar.tags) {
    if (tag.startsWith("mark:")) {
      score += 100;
    } else if (tag.startsWith("final:")) {
      score += 90;
    } else if (tag.startsWith("boundary:")) {
      score += 85;
    } else if (tag.startsWith("motif:")) {
      score += 70;
    } else if (tag.startsWith("operator:")) {
      score += 20;
    } else if (tag === "high_frequency") {
      score += 10;
    }
  }
  score += Math.max(0, 30 - exemplar.skeleton.length);
  return score;
}

function buildRegressionPayload(exemplarPayload, opts) {
  const exemplars = exemplarPayload.exemplars.slice();
  const pickedIds = new Set();
  const picked = [];

  const pickOne = (predicate) => {
    const exemplar = exemplars.find((candidate) => !pickedIds.has(candidate.id) && predicate(candidate));
    if (!exemplar) {
      return;
    }
    picked.push(exemplar);
    pickedIds.add(exemplar.id);
  };

  for (const requiredTag of REQUIRED_REGRESSION_TAGS) {
    pickOne((candidate) => candidate.tags.includes(requiredTag));
  }

  const motifTags = new Set();
  for (const exemplar of exemplars) {
    for (const tag of exemplar.tags) {
      if (tag.startsWith("motif:")) {
        motifTags.add(tag);
      }
    }
  }
  const sortedMotifTags = toSortedSetArray(motifTags);
  for (const motifTag of sortedMotifTags) {
    pickOne((candidate) => candidate.tags.includes(motifTag));
  }

  const scored = exemplars
    .slice()
    .sort((left, right) => {
      const scoreDelta = scoreForRegression(right) - scoreForRegression(left);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.id.localeCompare(right.id, "en", { numeric: true });
    });

  for (const exemplar of scored) {
    if (picked.length >= opts.regressionLimit) {
      break;
    }
    if (pickedIds.has(exemplar.id)) {
      continue;
    }
    picked.push(exemplar);
    pickedIds.add(exemplar.id);
  }

  const finalCases = picked
    .slice(0, Math.max(opts.regressionLimit, REQUIRED_REGRESSION_TAGS.length))
    .map((exemplar) => ({
      id: exemplar.id,
      key: exemplar.ref_key,
      ref: exemplar.ref,
      surface: exemplar.surface,
      expected_skeleton: exemplar.skeleton,
      semantic_version: exemplar.semantic_version,
      tags: exemplar.tags,
      notes: buildRegressionNotes(exemplar.tags)
    }));

  return {
    schema_version: 1,
    source_trace: exemplarPayload.source.trace_path,
    source_exemplars: workspaceRelativePath(opts.out),
    semantic_versions: exemplarPayload.semantic_versions,
    count: finalCases.length,
    cases: finalCases
  };
}

function renderExemplarReadme(exemplarPayload, regressionPayload) {
  const categoriesById = new Map(exemplarPayload.categories.map((category) => [category.id, category]));
  const grouped = new Map();
  for (const category of exemplarPayload.categories) {
    grouped.set(category.id, []);
  }
  for (const exemplar of exemplarPayload.exemplars) {
    const list = grouped.get(exemplar.category) ?? [];
    list.push(exemplar);
    grouped.set(exemplar.category, list);
  }

  const lines = [
    "# Exemplar Library",
    "",
    "Canonical, deterministic exemplars for publication and regression validation.",
    "",
    "## Summary",
    `- source_trace: \`${exemplarPayload.source.trace_path}\``,
    `- trace_sha256: \`${exemplarPayload.source.trace_sha256}\``,
    `- semantic_versions: ${exemplarPayload.semantic_versions.join(", ") || "(none)"}`,
    `- exemplars: ${exemplarPayload.exemplars.length}`,
    `- regression_cases: ${regressionPayload.count}`,
    `- observed_operator_events: ${exemplarPayload.stats.observed_operator_events.length}`,
    `- covered_operator_events: ${exemplarPayload.stats.covered_operator_events.length}`,
    "",
    "## Categories"
  ];

  for (const category of exemplarPayload.categories) {
    const count = grouped.get(category.id)?.length ?? 0;
    lines.push(`- **${category.title}** (${count}): ${category.description}`);
  }

  lines.push("", "## Exemplars");
  for (const category of exemplarPayload.categories) {
    const categoryInfo = categoriesById.get(category.id);
    const items = grouped.get(category.id) ?? [];
    if (items.length === 0) {
      continue;
    }
    lines.push("", `### ${categoryInfo.title}`, "", `${categoryInfo.description}`, "");
    for (const exemplar of items) {
      const skeletonValue = exemplar.skeleton.length > 0 ? exemplar.skeleton.join(" -> ") : "(empty)";
      const tokenValue =
        exemplar.token_ids.length > 0 ? exemplar.token_ids.map((tokenId) => String(tokenId)).join(", ") : "(none)";
      lines.push(`#### ${exemplar.id} — ${exemplar.surface} (${toReferenceString(exemplar.ref)})`);
      lines.push(`- ref: \`${exemplar.ref_key}\``);
      lines.push(`- token_ids: \`${tokenValue}\``);
      lines.push(`- flow: \`${exemplar.flow}\``);
      lines.push(`- skeleton: \`${skeletonValue}\``);
      lines.push(`- tags: \`${exemplar.tags.join(", ")}\``);
      lines.push(`- explanation: ${exemplar.explanation}`);
      lines.push("");
    }
  }

  lines.push("## Maintenance Rule", "");
  lines.push(
    "1. If semantics change, run corpus diff/regression first, then regenerate exemplars.",
    "2. Update explanations only when the underlying skeleton meaning changes.",
    "3. Preserve prior semantic-version notes; append new version notes instead of rewriting history."
  );

  if (Array.isArray(exemplarPayload.version_notes) && exemplarPayload.version_notes.length > 0) {
    lines.push("", "## Version Notes", "");
    for (const note of exemplarPayload.version_notes) {
      lines.push(`- ${note.semantic_version}: ${note.note}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectDeep(item));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))) {
      out[key] = sortObjectDeep(value[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortObjectDeep(value));
}

function jsonEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function sha256FromString(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function writeJson(pathName, payload) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function writeText(pathName, text) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, text, "utf8");
}

function runSelection(rows, indexes, countsEntries, motifPayload, opts) {
  const { selected, select } = createSelector();
  const selectedSet = new Set();

  const rememberSelection = (row, details) => {
    if (!row) {
      return false;
    }
    const didSelect = select(row, details);
    selectedSet.add(row.ref_key);
    return didSelect;
  };

  const topSkeletonEntries = countsEntries.filter(([skeletonKey]) => skeletonKey.length > 0);
  const topSkeletons = topSkeletonEntries.slice(0, opts.topSkeletons);
  for (let index = 0; index < topSkeletons.length; index += 1) {
    const [skeletonKey] = topSkeletons[index];
    const row = pickFirstRow(indexes.rowsBySkeleton.get(skeletonKey), () => true);
    rememberSelection(row, {
      category: "high_frequency_skeletons",
      tags: ["high_frequency", `skeleton_rank:${index + 1}`]
    });
  }

  const motifEntries = Object.entries(motifPayload?.motifs ?? {}).sort((left, right) =>
    left[0].localeCompare(right[0], "en", { numeric: true })
  );
  for (const [motifName, motif] of motifEntries) {
    const candidates = [];
    for (const skeletonKey of motif.matching_skeleton_keys ?? []) {
      const rowsForSkeleton = indexes.rowsBySkeleton.get(String(skeletonKey));
      if (!rowsForSkeleton) {
        continue;
      }
      for (const row of rowsForSkeleton) {
        candidates.push(row);
      }
    }
    candidates.sort((left, right) => left._index - right._index);
    let picked = 0;
    for (const row of candidates) {
      if (picked >= opts.motifPerMotif) {
        break;
      }
      if (selectedSet.has(row.ref_key)) {
        continue;
      }
      rememberSelection(row, {
        category: "motif_driven",
        tags: ["motif"],
        motifs: [motifName]
      });
      picked += 1;
    }
    if (picked === 0) {
      const fallback = pickFirstRow(candidates, () => true);
      rememberSelection(fallback, {
        category: "motif_driven",
        tags: ["motif"],
        motifs: [motifName]
      });
    }
  }

  const specialFilters = [
    {
      tag: "mark:mappiq",
      predicate: (row) => /ה\u05BC/u.test(row.surface) && row.skeleton.includes("HE.DECLARE_PIN")
    },
    {
      tag: "mark:sin_dot",
      predicate: (row) => row.surface.includes("\u05C2") && row.skeleton.length > 0
    },
    {
      tag: "mark:shin_dot",
      predicate: (row) => row.surface.includes("\u05C1") && row.skeleton.includes("SHIN.FORK")
    },
    {
      tag: "mark:dagesh",
      predicate: (row) => row.surface.includes("\u05BC") && row.skeleton.length > 0
    }
  ];
  for (const filter of specialFilters) {
    const row = pickFirstRow(rows, filter.predicate);
    rememberSelection(row, {
      category: "special_marks",
      tags: [filter.tag]
    });
  }

  const finalKafRow =
    pickFirstRow(
      rows,
      (row) => /ך$/u.test(row.surface) && row.skeleton.includes("LAMED.ENDPOINT")
    ) ?? pickFirstRow(rows, (row) => /ך$/u.test(row.surface));
  rememberSelection(finalKafRow, {
    category: "boundary_finals",
    tags: ["final:kaf_surface"]
  });

  const boundaryAndFinalFilters = [
    {
      tag: "final:mem",
      predicate: (row) => row.skeleton.includes("FINAL_MEM.CLOSE")
    },
    {
      tag: "final:nun",
      predicate: (row) =>
        row.skeleton.includes("FINAL_NUN.SUPPORT_DEBT") &&
        row.skeleton.includes("FINAL_NUN.SUPPORT_DISCHARGE")
    },
    {
      tag: "final:pe",
      predicate: (row) => row.skeleton.includes("FINAL_PE.UTTER_CLOSE")
    },
    {
      tag: "final:tsadi",
      predicate: (row) => row.skeleton.includes("FINAL_TSADI.ALIGN_FINAL")
    },
    {
      tag: "boundary:support_discharge",
      predicate: (row) => row.skeleton.includes("SPACE.SUPPORT_DISCHARGE")
    },
    {
      tag: "boundary:mem_auto_close",
      predicate: (row) => row.skeleton.includes("SPACE.MEM_AUTO_CLOSE")
    }
  ];
  for (const filter of boundaryAndFinalFilters) {
    const row = pickFirstRow(rows, filter.predicate);
    rememberSelection(row, {
      category: "boundary_finals",
      tags: [filter.tag]
    });
  }

  const observedEvents = new Set(indexes.rowsByEvent.keys());
  const orderedEvents = sortEventsForCoverage(observedEvents);
  for (const event of orderedEvents) {
    const covered = collectCoveredEvents(selected.values());
    if (covered.has(event)) {
      continue;
    }
    const candidates = indexes.rowsByEvent.get(event) ?? [];
    const row = pickFirstRow(candidates, () => true, true, selectedSet) ?? candidates[0];
    rememberSelection(row, {
      category: "operator_family",
      tags: ["operator_family"],
      operators: [event]
    });
  }

  if (selected.size < opts.minimum) {
    const fillFromTopSkeletons = (preferNewSkeleton) => {
      const representedSkeletons = new Set(
        Array.from(selected.values()).map((entry) => skeletonKeyFromRow(entry.row))
      );
      for (const [skeletonKey] of topSkeletonEntries) {
        if (selected.size >= opts.minimum) {
          break;
        }
        if (preferNewSkeleton && representedSkeletons.has(skeletonKey)) {
          continue;
        }
        const candidates = indexes.rowsBySkeleton.get(skeletonKey) ?? [];
        for (const row of candidates) {
          if (selected.size >= opts.minimum) {
            break;
          }
          if (selectedSet.has(row.ref_key)) {
            continue;
          }
          rememberSelection(row, {
            category: "high_frequency_skeletons",
            tags: ["high_frequency", "coverage_fill"]
          });
          representedSkeletons.add(skeletonKey);
        }
      }
    };

    fillFromTopSkeletons(true);
    if (selected.size < opts.minimum) {
      fillFromTopSkeletons(false);
    }
  }

  return Array.from(selected.values());
}

function validateRegressionCases(regressionPayload, rowByRefKey) {
  const failures = [];
  for (const testCase of regressionPayload.cases ?? []) {
    const row = rowByRefKey.get(String(testCase.key));
    if (!row) {
      failures.push({
        id: testCase.id,
        key: testCase.key,
        reason: "missing reference in trace"
      });
      continue;
    }

    if (row.surface !== testCase.surface) {
      failures.push({
        id: testCase.id,
        key: testCase.key,
        reason: `surface mismatch (${testCase.surface} != ${row.surface})`
      });
      continue;
    }

    const expectedSkeleton = Array.isArray(testCase.expected_skeleton)
      ? testCase.expected_skeleton.map((value) => String(value))
      : [];
    if (!jsonEqual(expectedSkeleton, row.skeleton)) {
      failures.push({
        id: testCase.id,
        key: testCase.key,
        reason: `skeleton mismatch (${expectedSkeleton.join("|")} != ${row.skeleton.join("|")})`
      });
      continue;
    }

    if (String(testCase.semantic_version ?? "unknown") !== row.semantic_version) {
      failures.push({
        id: testCase.id,
        key: testCase.key,
        reason: `semantic_version mismatch (${testCase.semantic_version} != ${row.semantic_version})`
      });
    }
  }
  return failures;
}

async function buildArtifacts(opts) {
  const traceRows = await readJsonlRows(opts.trace);
  const indexes = buildIndexes(traceRows);
  const traceRaw = await fs.readFile(opts.trace, "utf8");
  const traceSha256 = sha256FromString(traceRaw);

  const skeletonCountsPayload = await readJsonMaybe(opts.skeletonCounts);
  const countsMap =
    skeletonCountsPayload?.skeleton_counts &&
    typeof skeletonCountsPayload.skeleton_counts === "object" &&
    !Array.isArray(skeletonCountsPayload.skeleton_counts)
      ? new Map(
          Object.entries(skeletonCountsPayload.skeleton_counts).map(([key, value]) => [
            String(key),
            Number(value)
          ])
        )
      : computeSkeletonCounts(traceRows);
  const countsEntries = toSortedCountsEntries(countsMap);

  const motifPayloadRaw = await readJsonMaybe(opts.motifIndex);
  const motifPayload =
    motifPayloadRaw?.motifs && typeof motifPayloadRaw.motifs === "object"
      ? motifPayloadRaw
      : { motifs: {} };

  const existingExemplarPayload = await readJsonMaybe(opts.out);
  const selectedEntries = runSelection(traceRows, indexes, countsEntries, motifPayload, opts);
  const exemplarPayload = buildExemplarPayload({
    rows: traceRows,
    indexes,
    countsEntries,
    motifPayload,
    selectedEntries,
    opts,
    existingVersionNotes: existingExemplarPayload?.version_notes,
    traceSha256
  });
  const regressionPayload = buildRegressionPayload(exemplarPayload, opts);
  const readmeText = renderExemplarReadme(exemplarPayload, regressionPayload);

  return {
    traceRows,
    indexes,
    exemplarPayload,
    regressionPayload,
    readmeText
  };
}

async function runBuild(argv) {
  const opts = parseArgs(argv);
  const { exemplarPayload, regressionPayload, readmeText } = await buildArtifacts(opts);

  await Promise.all([
    writeJson(opts.out, exemplarPayload),
    writeJson(opts.regressionOut, regressionPayload),
    writeText(opts.readmeOut, readmeText)
  ]);

  console.log(
    [
      `build: exemplars=${exemplarPayload.exemplars.length}`,
      `regression=${regressionPayload.count}`,
      `coveredEvents=${exemplarPayload.stats.covered_operator_events.length}/${exemplarPayload.stats.observed_operator_events.length}`,
      `out=${workspaceRelativePath(opts.out)}`,
      `readme=${workspaceRelativePath(opts.readmeOut)}`,
      `regressionOut=${workspaceRelativePath(opts.regressionOut)}`
    ].join(" ")
  );
}

async function runVerify(argv) {
  const opts = parseArgs(argv);
  const { indexes, exemplarPayload, regressionPayload, readmeText } = await buildArtifacts(opts);

  const [existingExemplars, existingRegression, existingReadme] = await Promise.all([
    readJson(opts.out),
    readJson(opts.regressionOut),
    fs.readFile(opts.readmeOut, "utf8")
  ]);

  const regressionFailures = validateRegressionCases(existingRegression, indexes.rowByRefKey);
  if (regressionFailures.length > 0) {
    const sample = regressionFailures.slice(0, 5).map((failure) => `${failure.key}: ${failure.reason}`);
    throw new Error(
      `Regression case mismatch (${regressionFailures.length}): ${sample.join(" | ")}`
    );
  }

  if (!jsonEqual(existingExemplars, exemplarPayload)) {
    throw new Error(
      `Exemplar JSON mismatch at ${workspaceRelativePath(opts.out)}. Re-run build to regenerate deterministic output.`
    );
  }
  if (!jsonEqual(existingRegression, regressionPayload)) {
    throw new Error(
      `Regression JSON mismatch at ${workspaceRelativePath(
        opts.regressionOut
      )}. Re-run build to regenerate deterministic output.`
    );
  }
  if (existingReadme !== readmeText) {
    throw new Error(
      `README mismatch at ${workspaceRelativePath(opts.readmeOut)}. Re-run build to regenerate deterministic output.`
    );
  }

  console.log(
    [
      `verify: ok exemplars=${exemplarPayload.exemplars.length}`,
      `regression=${regressionPayload.count}`,
      `coveredEvents=${exemplarPayload.stats.covered_operator_events.length}/${exemplarPayload.stats.observed_operator_events.length}`
    ].join(" ")
  );
}

async function main() {
  const [, , command, ...argv] = process.argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  if (command === "build") {
    await runBuild(argv);
    return;
  }
  if (command === "verify") {
    await runVerify(argv);
    return;
  }

  throw new Error(`Unknown command '${command}'. Expected build or verify.`);
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
