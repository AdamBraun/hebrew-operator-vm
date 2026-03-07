/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { workspaceRelativePath } from "./report";
import {
  BOUNDARY_FLOW_OPS,
  SAFETY_RAIL_ALLOWLIST,
  SPACE_TOKEN,
  SUPPORT_DEBT_OPS,
  SUPPORT_DISCHARGE_OPS,
  dedupeConsecutive,
  extractWordFlow,
  makeRuntimeErrorTraceEvent,
  splitTraceIntoWordSegments,
  tokenRegistrySignature
} from "./runtimePart1";

function resolveWordTokenIds({ surface, tokenize, tokenIdBySignature, compiledTokenIdSet }) {
  const tokens = tokenize(surface).filter((token) => token.letter !== SPACE_TOKEN);
  const token_ids = [];
  const unknown_signatures = [];
  const missing_bundle_ids = [];

  for (const token of tokens) {
    const signature = tokenRegistrySignature(token);
    const tokenId = tokenIdBySignature.get(signature);
    if (tokenId === undefined) {
      unknown_signatures.push(signature);
      continue;
    }
    token_ids.push(tokenId);
    if (!compiledTokenIdSet.has(String(tokenId))) {
      missing_bundle_ids.push(tokenId);
    }
  }

  return { token_ids, unknown_signatures, missing_bundle_ids };
}

function runIsolatedWordFlow({
  surface,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors
}) {
  try {
    const { trace } = runProgramWithTrace(surface, createInitialState());
    const flow = extractWordFlow(trace);
    return {
      flowRaw: flow.flow_compact,
      flowCompact: dedupeConsecutive(flow.flow_compact),
      traceEvents: flow.trace_events,
      runtimeErrorMessage: "",
      windowStart: 1
    };
  } catch (err) {
    if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
      throw err;
    }
    const message = String(err?.message ?? "RuntimeError");
    return {
      flowRaw: ["ERROR.RUNTIME"],
      flowCompact: ["ERROR.RUNTIME"],
      traceEvents: [makeRuntimeErrorTraceEvent(message)],
      runtimeErrorMessage: message,
      windowStart: 1
    };
  }
}

function runVerseWordFlows({
  words,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors,
  verseRefKey
}) {
  try {
    const verseText = words.join(" ");
    const { trace } = runProgramWithTrace(verseText, createInitialState());
    const segments = splitTraceIntoWordSegments(trace);
    if (segments.length !== words.length) {
      throw new Error(
        `Verse trace segmentation failed for ${verseRefKey}: expected ${words.length} words, got ${segments.length}`
      );
    }
    return segments.map((segment) => {
      const flow = extractWordFlow(segment);
      return {
        flowRaw: flow.flow_compact,
        flowCompact: dedupeConsecutive(flow.flow_compact),
        traceEvents: flow.trace_events,
        runtimeErrorMessage: "",
        windowStart: 1
      };
    });
  } catch (err) {
    if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
      throw err;
    }
    const message = String(err?.message ?? "RuntimeError");
    return words.map(() => ({
      flowRaw: ["ERROR.RUNTIME"],
      flowCompact: ["ERROR.RUNTIME"],
      traceEvents: [makeRuntimeErrorTraceEvent(message)],
      runtimeErrorMessage: message,
      windowStart: 1
    }));
  }
}

function runWindowWordFlows({
  words,
  windowSize,
  runProgramWithTrace,
  createInitialState,
  allowRuntimeErrors,
  verseRefKey
}) {
  const out = [];

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const windowStart = Math.max(0, wordIndex - windowSize + 1);
    const phraseText = words.slice(windowStart, wordIndex + 1).join(" ");

    try {
      const { trace } = runProgramWithTrace(phraseText, createInitialState());
      const segments = splitTraceIntoWordSegments(trace);
      const expectedSegments = wordIndex - windowStart + 1;
      if (segments.length !== expectedSegments) {
        throw new Error(
          `Window trace segmentation failed for ${verseRefKey} word ${wordIndex + 1}: expected ${expectedSegments}, got ${segments.length}`
        );
      }
      const flow = extractWordFlow(segments[segments.length - 1]);
      out.push({
        flowRaw: flow.flow_compact,
        flowCompact: dedupeConsecutive(flow.flow_compact),
        traceEvents: flow.trace_events,
        runtimeErrorMessage: "",
        windowStart: windowStart + 1
      });
    } catch (err) {
      if (!allowRuntimeErrors || err?.name !== "RuntimeError") {
        throw err;
      }
      const message = String(err?.message ?? "RuntimeError");
      out.push({
        flowRaw: ["ERROR.RUNTIME"],
        flowCompact: ["ERROR.RUNTIME"],
        traceEvents: [makeRuntimeErrorTraceEvent(message)],
        runtimeErrorMessage: message,
        windowStart: windowStart + 1
      });
    }
  }

  return out;
}

function explainDeltaByMode({ mode, tokenIndex, windowStart, boundaryOps }) {
  const parts = [];
  if (mode === "VERSE" && tokenIndex > 1) {
    parts.push(`shared verse state from words 1-${tokenIndex - 1}`);
  }
  if (mode === "WINDOW" && windowStart < tokenIndex) {
    parts.push(`sliding window context words ${windowStart}-${tokenIndex - 1}`);
  }
  if (boundaryOps.length > 0) {
    parts.push(`boundary operators observed: ${boundaryOps.join(", ")}`);
  }
  if (parts.length === 0) {
    parts.push("shared-state execution context");
  }
  return parts.join("; ");
}

function countOps(ops) {
  const counts = new Map();
  for (const op of ops) {
    counts.set(op, (counts.get(op) ?? 0) + 1);
  }
  return counts;
}

function skeletonDeltaOps(previousSkeleton, nextSkeleton) {
  const previousCounts = countOps(previousSkeleton);
  const nextCounts = countOps(nextSkeleton);
  const keys = new Set([...previousCounts.keys(), ...nextCounts.keys()]);
  const delta = [];
  for (const key of keys) {
    if ((previousCounts.get(key) ?? 0) !== (nextCounts.get(key) ?? 0)) {
      delta.push(key);
    }
  }
  return delta.sort(sortRefLike);
}

function isSafetyRailDeltaAllowed(deltaOps) {
  return deltaOps.every((op) => SAFETY_RAIL_ALLOWLIST.has(op));
}

function buildDebtDischargeSpans(verseWordRows) {
  const spans = [];
  for (let fromIndex = 0; fromIndex < verseWordRows.length; fromIndex += 1) {
    const fromRow = verseWordRows[fromIndex];
    const hasDebt = fromRow.skeleton.some((op) => SUPPORT_DEBT_OPS.has(op));
    if (!hasDebt) {
      continue;
    }
    for (let toIndex = fromIndex + 1; toIndex < verseWordRows.length; toIndex += 1) {
      const toRow = verseWordRows[toIndex];
      const hasDischarge = toRow.skeleton.some((op) => SUPPORT_DISCHARGE_OPS.has(op));
      if (!hasDischarge) {
        continue;
      }
      spans.push({
        from_ref_key: fromRow.ref_key,
        to_ref_key: toRow.ref_key,
        span_words: toIndex - fromIndex
      });
      break;
    }
  }
  return spans;
}

function buildVerseBoundaryResolution(verseWordRows, boundaryByType) {
  let supportOpened = 0;
  let supportDischarged = 0;
  let memOpened = 0;
  let memClosed = 0;
  const finalizeAtWord = [];

  for (let index = 0; index < verseWordRows.length; index += 1) {
    const row = verseWordRows[index];
    for (const op of row.skeleton) {
      if (SUPPORT_DEBT_OPS.has(op)) {
        supportOpened += 1;
      }
      if (SUPPORT_DISCHARGE_OPS.has(op)) {
        supportDischarged += 1;
      }
      if (op === "MEM.OPEN") {
        memOpened += 1;
      }
      if (op === "FINAL_MEM.CLOSE" || op === "SPACE.MEM_AUTO_CLOSE") {
        memClosed += 1;
      }
      if (op === "TAV.FINALIZE") {
        finalizeAtWord.push(row.ref_key);
      }
    }
  }

  const supportBalance = Math.max(0, supportOpened - supportDischarged);
  const memBalance = Math.max(0, memOpened - memClosed);
  const boundaryCount = Object.values(boundaryByType).reduce(
    (sum, count) => sum + Number(count),
    0
  );
  const requiresDischarge = supportBalance > 0 || memBalance > 0;

  return {
    op_family: "VERSE.BOUNDARY_RESOLUTION",
    trigger: "explicit_verse_boundary",
    support_opened: supportOpened,
    support_discharged: supportDischarged,
    support_resolved_at_boundary: supportBalance,
    mem_opened: memOpened,
    mem_closed: memClosed,
    mem_resolved_at_boundary: memBalance,
    boundary_ops_seen: boundaryCount,
    finalize_refs: finalizeAtWord.slice(0, 20),
    action: requiresDischarge ? "discharge_or_close_pending" : "confirm_stable_closure"
  };
}

function buildVerseMotifs({
  verseWordRows,
  phraseBreaks,
  crossWordEvents,
  verseBoundaryResolution
}) {
  const motifs = [];
  if (crossWordEvents.length > 0) {
    motifs.push({
      motif: "CROSS_WORD_DELTA",
      count: crossWordEvents.length,
      samples: crossWordEvents.slice(0, 6).map((event) => ({
        ref_key: event.ref_key,
        token_index: event.token_index
      }))
    });
  }

  const debtSpans = buildDebtDischargeSpans(verseWordRows);
  if (debtSpans.length > 0) {
    motifs.push({
      motif: "SUPPORT_DEBT_DISCHARGE_CROSS_WORD",
      count: debtSpans.length,
      samples: debtSpans.slice(0, 6)
    });
  }

  if (verseBoundaryResolution.boundary_ops_seen > 0) {
    motifs.push({
      motif: "VERSE_BOUNDARY_RESOLUTION",
      count: verseBoundaryResolution.boundary_ops_seen,
      action: verseBoundaryResolution.action
    });
  }

  if (phraseBreaks.length > 0) {
    motifs.push({
      motif: "PHRASE_BREAK",
      count: phraseBreaks.length,
      samples: phraseBreaks.slice(0, 6).map((event) => ({
        phrase_node_id: event.phrase_node_id,
        split_word_index: event.split_word_index,
        word_span: event.word_span
      }))
    });
  }

  if (verseBoundaryResolution.support_resolved_at_boundary > 0) {
    motifs.push({
      motif: "SUPPORT_RESOLVED_AT_VERSE_BOUNDARY",
      count: verseBoundaryResolution.support_resolved_at_boundary
    });
  }

  if (verseBoundaryResolution.mem_resolved_at_boundary > 0) {
    motifs.push({
      motif: "MEM_RESOLVED_AT_VERSE_BOUNDARY",
      count: verseBoundaryResolution.mem_resolved_at_boundary
    });
  }

  const finalizeRows = verseWordRows
    .filter((row) => row.skeleton.includes("TAV.FINALIZE"))
    .map((row) => row.ref_key);
  if (
    finalizeRows.length === 1 &&
    finalizeRows[0] === verseWordRows[verseWordRows.length - 1].ref_key
  ) {
    motifs.push({
      motif: "FINALIZE_AT_VERSE_EDGE",
      count: 1,
      refs: finalizeRows
    });
  }

  return motifs;
}

function buildPatternIndex(fullRows) {
  const explicitPatterns = {
    MEM_OPEN_TO_MEM_CLOSE: {
      description: "MEM.OPEN ... FINAL_MEM.CLOSE (or boundary mem auto-close)",
      occurrences: []
    },
    SUPPORT_DEBT_TO_SAMEWORD_DISCHARGE: {
      description: "support debt resolved in the same word",
      occurrences: []
    },
    FINALIZE_AT_END: {
      description: "word ends with TAV.FINALIZE",
      occurrences: []
    },
    HE_HEAD_WITH_LEG: {
      description: "HE.HEAD_WITH_LEG (resolved head + detached leg)",
      occurrences: []
    },
    QOF_HEAD_WITH_LEG: {
      description: "QOF.HEAD_WITH_LEG (unresolved head + detached leg)",
      occurrences: []
    }
  };

  const bigrams = new Map();
  const trigrams = new Map();

  const addNgram = (store, pattern, ref_key) => {
    const key = pattern.join(" -> ");
    const entry = store.get(key) ?? { pattern, count: 0, occurrences: [] };
    entry.count += 1;
    if (entry.occurrences.length < 40) {
      entry.occurrences.push(ref_key);
    }
    store.set(key, entry);
  };

  for (const row of fullRows) {
    const ops = row.flow_compact;
    if (ops.length === 0) {
      continue;
    }

    const hasMemOpen = ops.includes("MEM.OPEN");
    const hasMemClose = ops.includes("FINAL_MEM.CLOSE") || ops.includes("SPACE.MEM_AUTO_CLOSE");
    if (hasMemOpen && hasMemClose) {
      explicitPatterns.MEM_OPEN_TO_MEM_CLOSE.occurrences.push(row.ref_key);
    }

    const hasSupportDebt =
      ops.includes("NUN.SUPPORT_DEBT") || ops.includes("FINAL_NUN.SUPPORT_DEBT");
    const hasSameWordDischarge =
      ops.includes("SAMEKH.SUPPORT_DISCHARGE") || ops.includes("FINAL_NUN.SUPPORT_DISCHARGE");
    if (hasSupportDebt && hasSameWordDischarge) {
      explicitPatterns.SUPPORT_DEBT_TO_SAMEWORD_DISCHARGE.occurrences.push(row.ref_key);
    }

    if (ops[ops.length - 1] === "TAV.FINALIZE") {
      explicitPatterns.FINALIZE_AT_END.occurrences.push(row.ref_key);
    }
    if (ops.includes("HE.HEAD_WITH_LEG")) {
      explicitPatterns.HE_HEAD_WITH_LEG.occurrences.push(row.ref_key);
    }
    if (ops.includes("QOF.HEAD_WITH_LEG")) {
      explicitPatterns.QOF_HEAD_WITH_LEG.occurrences.push(row.ref_key);
    }

    for (let i = 0; i + 1 < ops.length; i += 1) {
      addNgram(bigrams, [ops[i], ops[i + 1]], row.ref_key);
    }
    for (let i = 0; i + 2 < ops.length; i += 1) {
      addNgram(trigrams, [ops[i], ops[i + 1], ops[i + 2]], row.ref_key);
    }
  }

  const toSortedArray = (map) =>
    Array.from(map.values())
      .sort(
        (left, right) =>
          right.count - left.count || left.pattern.join().localeCompare(right.pattern.join())
      )
      .slice(0, 250);

  return {
    explicit_patterns: Object.fromEntries(
      Object.entries(explicitPatterns).map(([key, value]) => [
        key,
        {
          description: value.description,
          count: value.occurrences.length,
          occurrences: value.occurrences
        }
      ])
    ),
    frequent_ngrams: {
      bigrams: toSortedArray(bigrams),
      trigrams: toSortedArray(trigrams)
    }
  };
}

function buildExemplarLibrary(fullRows) {
  const bySkeleton = new Map();

  for (const row of fullRows) {
    if (row.flow_compact.length === 0) {
      continue;
    }
    const key = row.flow_compact.join(" -> ");
    const entry = bySkeleton.get(key) ?? { flow_compact: row.flow_compact, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 3) {
      entry.examples.push({
        ref: row.ref,
        ref_key: row.ref_key,
        surface: row.surface,
        one_liner: row.one_liner
      });
    }
    bySkeleton.set(key, entry);
  }

  const top = Array.from(bySkeleton.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 60);

  return {
    exemplars: top.map((entry) => ({
      skeleton: entry.flow_compact,
      count: entry.count,
      examples: entry.examples
    }))
  };
}

function sha256FromBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function sha256FromFile(pathName) {
  const buffer = await fs.readFile(pathName);
  return sha256FromBuffer(buffer);
}

function countLines(rows) {
  return rows.length;
}

async function writeJson(pathName, payload) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  await fs.writeFile(pathName, JSON.stringify(payload, null, 2), "utf8");
}

async function writeJsonl(pathName, rows) {
  await fs.mkdir(path.dirname(pathName), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await fs.writeFile(pathName, content, "utf8");
}

async function readJson(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return JSON.parse(raw);
}

async function readJsonl(pathName) {
  const raw = await fs.readFile(pathName, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildRefKey(ref) {
  return `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`;
}

function resolveCorpusFilePath(inputPathOrDir) {
  const full = path.resolve(inputPathOrDir);
  if (full.endsWith(".jsonl")) {
    return full;
  }
  return path.join(full, "word_flows.full.jsonl");
}

async function pathExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

async function resolveTraceFilePath(inputPathOrDir) {
  const full = path.resolve(inputPathOrDir);
  if (full.endsWith(".jsonl")) {
    if (!(await pathExists(full))) {
      throw new Error(`Missing trace file: ${full}`);
    }
    return full;
  }

  const candidates = [
    path.join(full, "word_traces.jsonl"),
    path.join(full, "word_flows.full.jsonl"),
    path.join(full, "word_flows.skeleton.jsonl")
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Unable to resolve trace file from '${inputPathOrDir}'. Tried: ${candidates
      .map((candidate) => workspaceRelativePath(candidate))
      .join(", ")}`
  );
}

function toEventOp(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  if (value && typeof value === "object" && typeof value.type === "string") {
    return value.type;
  }
  return "";
}

function normalizeSkeleton(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => toEventOp(entry)).filter(Boolean);
}

function skeletonFromRow(row) {
  if (Array.isArray(row?.skeleton)) {
    return normalizeSkeleton(row.skeleton);
  }
  if (Array.isArray(row?.flow_compact)) {
    return normalizeSkeleton(row.flow_compact);
  }
  if (Array.isArray(row?.flow_skeleton)) {
    return normalizeSkeleton(row.flow_skeleton);
  }
  if (Array.isArray(row?.events)) {
    return normalizeSkeleton(row.events);
  }
  return [];
}

function normalizeTokenIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Number(entry));
}

function parseRefKey(refKey) {
  const pieces = String(refKey ?? "").split("/");
  if (pieces.length < 4) {
    return null;
  }
  const tokenIndexRaw = pieces.pop();
  const verseRaw = pieces.pop();
  const chapterRaw = pieces.pop();
  const book = pieces.join("/");
  const chapter = Number(chapterRaw);
  const verse = Number(verseRaw);
  const tokenIndex = Number(tokenIndexRaw);
  if (
    !book ||
    !Number.isFinite(chapter) ||
    !Number.isFinite(verse) ||
    !Number.isFinite(tokenIndex)
  ) {
    return null;
  }
  return {
    book,
    chapter,
    verse,
    token_index: tokenIndex
  };
}

function rowRefKey(row) {
  if (typeof row?.ref_key === "string" && row.ref_key.length > 0) {
    return row.ref_key;
  }
  const ref = row?.ref;
  if (ref && typeof ref === "object") {
    const tokenIndex =
      ref.token_index ?? ref.word_index_in_verse ?? ref.word_index ?? ref.index ?? null;
    if (
      typeof ref.book === "string" &&
      Number.isFinite(Number(ref.chapter)) &&
      Number.isFinite(Number(ref.verse)) &&
      Number.isFinite(Number(tokenIndex))
    ) {
      return `${ref.book}/${Number(ref.chapter)}/${Number(ref.verse)}/${Number(tokenIndex)}`;
    }
  }
  return "";
}

export {
  resolveWordTokenIds,
  runIsolatedWordFlow,
  runVerseWordFlows,
  runWindowWordFlows,
  explainDeltaByMode,
  countOps,
  skeletonDeltaOps,
  isSafetyRailDeltaAllowed,
  buildDebtDischargeSpans,
  buildVerseBoundaryResolution,
  buildVerseMotifs,
  buildPatternIndex,
  buildExemplarLibrary,
  sha256FromBuffer,
  sha256FromFile,
  countLines,
  writeJson,
  writeJsonl,
  readJson,
  readJsonl,
  buildRefKey,
  resolveCorpusFilePath,
  pathExists,
  resolveTraceFilePath,
  toEventOp,
  normalizeSkeleton,
  skeletonFromRow,
  normalizeTokenIds,
  parseRefKey,
  rowRefKey
};
