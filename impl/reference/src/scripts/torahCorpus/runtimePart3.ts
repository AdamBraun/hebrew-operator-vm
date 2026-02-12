/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import { formatWarningCounts, totalFromCounts, workspaceRelativePath } from "./report";
import {
  normalizeTokenIds,
  normalizeSkeleton,
  parseRefKey,
  pathExists,
  readJson,
  readJsonl,
  rowRefKey,
  resolveTraceFilePath,
  sha256FromBuffer,
  skeletonFromRow,
  sha256FromFile
} from "./runtimePart2";
import { compileFlowString } from "./runtimePart1";

function getSemanticVersion(value) {
  if (value && typeof value === "object") {
    if (typeof value.semantic_version === "string" && value.semantic_version.length > 0) {
      return value.semantic_version;
    }
    if (typeof value.semantics_version === "string" && value.semantics_version.length > 0) {
      return value.semantics_version;
    }
  }
  return "unknown";
}

function normalizeTraceRow(row, index, sourcePath) {
  const key = rowRefKey(row);
  if (!key) {
    throw new Error(
      `Row ${index + 1} in ${workspaceRelativePath(sourcePath)} is missing a stable identity (ref_key or ref + token_index)`
    );
  }
  const skeleton = skeletonFromRow(row);
  const flow =
    typeof row?.flow === "string"
      ? row.flow
      : typeof row?.one_liner === "string"
        ? row.one_liner
        : compileFlowString(skeleton, " ⇢ ");
  const refFromRow = row?.ref && typeof row.ref === "object" ? row.ref : null;
  const ref = refFromRow ?? parseRefKey(key) ?? null;

  return {
    key,
    ref,
    surface: String(row?.surface ?? ""),
    skeleton,
    flow,
    semantic_version: getSemanticVersion(row),
    token_ids: normalizeTokenIds(row?.token_ids ?? row?.tokens ?? []),
    source_path: workspaceRelativePath(sourcePath),
    row_index: index + 1
  };
}

function sortRefLike(left, right) {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

async function loadTraceRun(inputPathOrDir, label) {
  const tracePath = await resolveTraceFilePath(inputPathOrDir);
  const raw = await fs.readFile(tracePath, "utf8");
  const traceSha256 = sha256FromBuffer(Buffer.from(raw, "utf8"));
  const parsedRows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const map = new Map();
  const rows = [];
  const duplicates = [];
  const semanticVersions = new Set();

  for (let index = 0; index < parsedRows.length; index += 1) {
    const normalized = normalizeTraceRow(parsedRows[index], index, tracePath);
    semanticVersions.add(normalized.semantic_version);
    if (map.has(normalized.key)) {
      duplicates.push(normalized.key);
      continue;
    }
    map.set(normalized.key, normalized);
    rows.push(normalized);
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Stable identity failure (${label}): duplicate keys detected in ${workspaceRelativePath(
        tracePath
      )}: ${duplicates.slice(0, 10).join(", ")}`
    );
  }

  return {
    label,
    input_path: path.resolve(inputPathOrDir),
    trace_path: tracePath,
    trace_sha256: traceSha256,
    rows,
    map,
    semantic_versions: Array.from(semanticVersions).sort(sortRefLike)
  };
}

function sortCountObjectByKey(obj) {
  const out = {};
  for (const key of Object.keys(obj ?? {}).sort(sortRefLike)) {
    out[key] = obj[key];
  }
  return out;
}

function mergeCountObjects(base, delta) {
  const out = { ...base };
  for (const [key, count] of Object.entries(delta ?? {})) {
    out[key] = (out[key] ?? 0) + Number(count ?? 0);
  }
  return out;
}

function buildTokenWarningIndex(compiledPayload) {
  const tokenWarnings = new Map();
  for (const [tokenIdRaw, tokenMeta] of Object.entries(compiledPayload?.tokens ?? {})) {
    const tokenId = Number(tokenIdRaw);
    if (!Number.isFinite(tokenId)) {
      continue;
    }
    const warnings = Array.isArray(tokenMeta?.warnings) ? tokenMeta.warnings : [];
    const byCode = {};
    for (const warning of warnings) {
      const code =
        typeof warning?.code === "string" && warning.code.length > 0
          ? warning.code
          : "UNKNOWN_WARNING";
      byCode[code] = (byCode[code] ?? 0) + 1;
    }
    if (Object.keys(byCode).length > 0) {
      tokenWarnings.set(tokenId, byCode);
    }
  }
  return tokenWarnings;
}

function wordWarningSummary(row, compileContext) {
  if (!compileContext?.token_warning_index) {
    return { total: 0, by_code: {} };
  }
  let byCode = {};
  for (const tokenId of row?.token_ids ?? []) {
    const tokenCounts = compileContext.token_warning_index.get(Number(tokenId));
    if (!tokenCounts) {
      continue;
    }
    byCode = mergeCountObjects(byCode, tokenCounts);
  }
  byCode = sortCountObjectByKey(byCode);
  return {
    total: totalFromCounts(byCode),
    by_code: byCode
  };
}

function warningDeltaText(leftSummary, rightSummary) {
  const leftText = formatWarningCounts(leftSummary?.by_code ?? {});
  const rightText = formatWarningCounts(rightSummary?.by_code ?? {});
  if (leftText === rightText) {
    return `compile warnings unchanged (${leftText})`;
  }
  return `compile warnings ${leftText} -> ${rightText}`;
}

async function resolveCompiledPath(explicitPath, run) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!(await pathExists(resolved))) {
      throw new Error(`Missing compiled bundle: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [];
  const seen = new Set();
  const pushCandidate = (candidate) => {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    candidates.push(resolved);
  };

  let dir = path.dirname(run.trace_path);
  for (let i = 0; i < 4; i += 1) {
    pushCandidate(path.join(dir, "tokens.compiled.json"));
    pushCandidate(path.join(dir, "data", "tokens.compiled.json"));
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  pushCandidate(DEFAULT_COMPILED_BUNDLES_PATH);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

async function loadCompileContext(explicitPath, run) {
  const compiledPath = await resolveCompiledPath(explicitPath, run);
  if (!compiledPath) {
    return {
      path: "",
      semver: "unknown",
      registry_sha256: "unknown",
      definitions_sha256: "unknown",
      warning_count: null,
      warning_by_code: {},
      token_warning_index: null,
      load_error: "not found"
    };
  }

  try {
    const payload = await readJson(compiledPath);
    const warningByCode = sortCountObjectByKey(payload?.stats?.warning_by_code ?? {});
    return {
      path: compiledPath,
      semver: payload?.semantics?.semver ?? "unknown",
      registry_sha256: payload?.source?.registry_sha256 ?? "unknown",
      definitions_sha256: payload?.semantics?.definitions_sha256 ?? "unknown",
      warning_count:
        typeof payload?.stats?.warning_count === "number"
          ? payload.stats.warning_count
          : totalFromCounts(warningByCode),
      warning_by_code: warningByCode,
      token_warning_index: buildTokenWarningIndex(payload),
      load_error: ""
    };
  } catch (err) {
    if (explicitPath) {
      throw err;
    }
    return {
      path: compiledPath,
      semver: "unknown",
      registry_sha256: "unknown",
      definitions_sha256: "unknown",
      warning_count: null,
      warning_by_code: {},
      token_warning_index: null,
      load_error: String(err?.message ?? err)
    };
  }
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function sameEventMultiset(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  const counts = new Map();
  for (const event of left) {
    counts.set(event, (counts.get(event) ?? 0) + 1);
  }
  for (const event of right) {
    if (!counts.has(event)) {
      return false;
    }
    const next = counts.get(event) - 1;
    if (next === 0) {
      counts.delete(event);
    } else {
      counts.set(event, next);
    }
  }
  return counts.size === 0;
}

function buildLcsTable(left, right) {
  const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

function buildEditOps(left, right) {
  const table = buildLcsTable(left, right);
  const reversed = [];
  let i = left.length;
  let j = right.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      i -= 1;
      j -= 1;
      continue;
    }
    const up = i > 0 ? table[i - 1][j] : -1;
    const leftCell = j > 0 ? table[i][j - 1] : -1;
    if (i > 0 && (j === 0 || up >= leftCell)) {
      reversed.push({ kind: "delete", event: left[i - 1], index: i - 1 });
      i -= 1;
      continue;
    }
    if (j > 0) {
      reversed.push({ kind: "insert", event: right[j - 1], index: j - 1 });
      j -= 1;
      continue;
    }
  }

  return reversed.reverse();
}

function compressEditOps(ops) {
  const out = [];
  for (let index = 0; index < ops.length; index += 1) {
    const current = ops[index];
    const next = ops[index + 1];
    if (current.kind === "delete" && next?.kind === "insert") {
      out.push({
        kind: "replace",
        from_event: current.event,
        to_event: next.event,
        index: current.index
      });
      index += 1;
      continue;
    }
    if (current.kind === "insert" && next?.kind === "delete") {
      out.push({
        kind: "replace",
        from_event: next.event,
        to_event: current.event,
        index: next.index
      });
      index += 1;
      continue;
    }
    out.push(current);
  }
  return out;
}

function positionText(index, length) {
  if (index <= 0) {
    return "at start";
  }
  if (index >= length - 1) {
    return "at end";
  }
  return `at position ${index + 1}`;
}

function classifySkeletonDelta(previousSkeleton, nextSkeleton) {
  if (arraysEqual(previousSkeleton, nextSkeleton)) {
    return {
      change_type: "unchanged",
      signature: "UNCHANGED",
      summary: "No skeleton change",
      operations: []
    };
  }

  if (sameEventMultiset(previousSkeleton, nextSkeleton)) {
    let start = 0;
    while (
      start < previousSkeleton.length &&
      start < nextSkeleton.length &&
      previousSkeleton[start] === nextSkeleton[start]
    ) {
      start += 1;
    }
    let endPrev = previousSkeleton.length - 1;
    let endNext = nextSkeleton.length - 1;
    while (
      endPrev >= start &&
      endNext >= start &&
      previousSkeleton[endPrev] === nextSkeleton[endNext]
    ) {
      endPrev -= 1;
      endNext -= 1;
    }
    const movedFrom = previousSkeleton.slice(start, endPrev + 1);
    const movedTo = nextSkeleton.slice(start, endNext + 1);
    return {
      change_type: "event_order_changed",
      signature: `ORDER:${movedFrom.join("->")}=>${movedTo.join("->")}`,
      summary: `Reordered events ${movedFrom.join(" -> ")} => ${movedTo.join(" -> ")}`,
      operations: [
        {
          kind: "order",
          from: movedFrom,
          to: movedTo
        }
      ]
    };
  }

  const operations = compressEditOps(buildEditOps(previousSkeleton, nextSkeleton));
  const inserts = operations.filter((op) => op.kind === "insert");
  const deletes = operations.filter((op) => op.kind === "delete");
  const replaces = operations.filter((op) => op.kind === "replace");

  if (inserts.length > 0 && deletes.length === 0 && replaces.length === 0) {
    const events = inserts.map((entry) => entry.event);
    if (events.length === 1) {
      const op = inserts[0];
      return {
        change_type: "event_inserted",
        signature: `INSERT:${op.event}`,
        summary: `Inserted ${op.event} ${positionText(op.index, nextSkeleton.length)}`,
        operations
      };
    }
    return {
      change_type: "event_inserted",
      signature: `INSERT:${events.join(",")}`,
      summary: `Inserted ${events.length} events: ${events.join(", ")}`,
      operations
    };
  }

  if (deletes.length > 0 && inserts.length === 0 && replaces.length === 0) {
    const events = deletes.map((entry) => entry.event);
    if (events.length === 1) {
      const op = deletes[0];
      return {
        change_type: "event_removed",
        signature: `REMOVE:${op.event}`,
        summary: `Removed ${op.event} ${positionText(op.index, previousSkeleton.length)}`,
        operations
      };
    }
    return {
      change_type: "event_removed",
      signature: `REMOVE:${events.join(",")}`,
      summary: `Removed ${events.length} events: ${events.join(", ")}`,
      operations
    };
  }

  if (replaces.length > 0 && inserts.length === 0 && deletes.length === 0) {
    const pairs = replaces.map((entry) => `${entry.from_event}→${entry.to_event}`);
    if (pairs.length === 1) {
      const op = replaces[0];
      return {
        change_type: "event_replaced",
        signature: `REPLACE:${op.from_event}→${op.to_event}`,
        summary: `Replaced ${op.from_event} with ${op.to_event} ${positionText(
          op.index,
          previousSkeleton.length
        )}`,
        operations
      };
    }
    return {
      change_type: "event_replaced",
      signature: `REPLACE:${pairs.join("|")}`,
      summary: `Replaced ${pairs.length} events: ${pairs.join(", ")}`,
      operations
    };
  }

  const compact = operations.map((entry) => {
    if (entry.kind === "replace") {
      return `${entry.from_event}→${entry.to_event}`;
    }
    return entry.kind === "insert" ? `+${entry.event}` : `-${entry.event}`;
  });
  return {
    change_type: "mixed_delta",
    signature: `MIXED:${compact.join("|")}`,
    summary: `Mixed delta: ${compact.join(", ")}`,
    operations
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGoldenCase(caseRow, index) {
  const key = rowRefKey(caseRow) || caseRow?.key;
  if (!key) {
    throw new Error(`Golden case at index ${index} is missing key/ref`);
  }
  const expectedSkeleton = normalizeSkeleton(
    caseRow?.expected_skeleton ?? caseRow?.expectedSkeleton ?? caseRow?.skeleton ?? []
  );
  return {
    key,
    ref: caseRow?.ref ?? parseRefKey(key) ?? null,
    surface: typeof caseRow?.surface === "string" ? caseRow.surface : "",
    expected_skeleton: expectedSkeleton,
    notes: typeof caseRow?.notes === "string" ? caseRow.notes : "curated"
  };
}

async function loadGoldens(pathName) {
  if (!(await pathExists(pathName))) {
    return null;
  }
  const payload = await readJson(pathName);
  const rawCases = Array.isArray(payload) ? payload : asArray(payload?.cases);
  const cases = rawCases.map((caseRow, index) => normalizeGoldenCase(caseRow, index));
  return {
    payload,
    cases
  };
}


export {
  rowRefKey,
  normalizeTraceRow,
  sortRefLike,
  loadTraceRun,
  sortCountObjectByKey,
  mergeCountObjects,
  buildTokenWarningIndex,
  wordWarningSummary,
  warningDeltaText,
  resolveCompiledPath,
  loadCompileContext,
  arraysEqual,
  sameEventMultiset,
  buildLcsTable,
  buildEditOps,
  compressEditOps,
  positionText,
  classifySkeletonDelta,
  asArray,
  normalizeGoldenCase,
  loadGoldens
};
