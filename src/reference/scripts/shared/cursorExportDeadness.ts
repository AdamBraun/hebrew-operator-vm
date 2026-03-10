import path from "node:path";

import { runPasukTrace, type PasukTraceOptions } from "../pasukTrace/runtime";
import {
  getStableCursorConsumerBenchmarkCases,
  loadCursorConsumerBenchmark,
  type CursorConsumerBenchmark,
  type CursorConsumerBenchmarkCase
} from "./cursorConsumerBenchmark";
import { analyzeCursorAuditWords, renderCursorAuditScopeHeader } from "./cursorAuditPolicy";

type SnapshotState = Record<string, any>;
type SnapshotHandle = Record<string, any>;

export type CursorExportCarrier = "י" | "ז" | "ע" | "ה";
export type CursorExportKind =
  | "pin_export"
  | "port_export"
  | "origin_export"
  | "adjunct_export"
  | "export";
export type CursorExportOutcome =
  | "consumed_later"
  | "accompanied_later"
  | "live_unused_at_boundary";

export type CursorExportRecord = {
  handle_id: string;
  carrier: CursorExportCarrier;
  export_kind: CursorExportKind;
  created_at_step: number;
  created_by_token: string;
  referents: string[];
  outcome: CursorExportOutcome;
  consumed_by_step: number | null;
  consumed_by_token: string | null;
  accompanied_by_step: number | null;
  accompanied_by_token: string | null;
  live_at_boundary: boolean;
};

export type CursorExportDeadnessCaseResult = {
  case_id: string;
  token: string;
  ref: string;
  word_index: number;
  exported_points: CursorExportRecord[];
};

export type CursorExportDeadnessReport = {
  schema_version: 1;
  generated_at: string;
  benchmark_path: string;
  benchmark_name: string;
  mode: "isolated_stable";
  suite_status: "stable-only" | "stale-contaminated" | "blocked by `ט`";
  stable_case_count: number;
  counts: {
    total_exported_points: number;
    consumed: number;
    accompanied: number;
    dead: number;
    by_letter: Record<CursorExportCarrier, number>;
  };
  rates: {
    consumed_rate: number;
    accompanied_rate: number;
    dead_rate: number;
  };
  cases: CursorExportDeadnessCaseResult[];
  report_text: string;
};

type ExportInit = {
  handleId: string;
  carrier: CursorExportCarrier;
  exportKind: CursorExportKind;
  createdAtStep: number;
  createdByToken: string;
  referents: string[];
};

function phaseDetail(entry: Record<string, any>, phaseName: string): Record<string, any> | null {
  const found = Array.isArray(entry.phases)
    ? entry.phases.find((phase: Record<string, any>) => phase?.phase === phaseName)
    : null;
  return found && typeof found.detail === "object" ? (found.detail as Record<string, any>) : null;
}

function phaseSnapshot(entry: Record<string, any>, phaseName: string): SnapshotState | null {
  const found = Array.isArray(entry.phases)
    ? entry.phases.find((phase: Record<string, any>) => phase?.phase === phaseName)
    : null;
  return found && typeof found.snapshot === "object" ? (found.snapshot as SnapshotState) : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function snapshotHandles(snapshot: SnapshotState | null): Map<string, SnapshotHandle> {
  const out = new Map<string, SnapshotHandle>();
  const handles = Array.isArray(snapshot?.handles) ? snapshot.handles : [];
  for (const handle of handles) {
    if (!handle || typeof handle !== "object") {
      continue;
    }
    const id = (handle as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    out.set(id, handle as SnapshotHandle);
  }
  return out;
}

function createdHandleIds(pre: SnapshotState | null, post: SnapshotState | null): string[] {
  const preIds = new Set(snapshotHandles(pre).keys());
  return Array.from(snapshotHandles(post).keys()).filter((handleId) => !preIds.has(handleId));
}

function stackExports(snapshot: SnapshotState | null, focus: string): string[] {
  const vm = snapshot?.vm ?? {};
  const knownHandleIds = new Set(snapshotHandles(snapshot).keys());
  return uniqueStrings(
    [...asStringArray(vm.K), ...asStringArray(vm.W)].filter(
      (value) => value !== focus && value !== "Ω" && value !== "⊥" && knownHandleIds.has(value)
    )
  );
}

function adjunctExports(snapshot: SnapshotState | null): string[] {
  const adjuncts = snapshot?.adjuncts;
  if (!adjuncts || typeof adjuncts !== "object") {
    return [];
  }
  const out: string[] = [];
  for (const ids of Object.values(adjuncts as Record<string, unknown>)) {
    for (const handleId of asStringArray(ids)) {
      if (!out.includes(handleId)) {
        out.push(handleId);
      }
    }
  }
  return out;
}

function handleMetaRefs(handle: SnapshotHandle): string[] {
  const meta =
    handle.meta && typeof handle.meta === "object" ? (handle.meta as Record<string, any>) : {};
  const refs: string[] = [];
  for (const value of [
    meta.portOf,
    meta.pinOf,
    meta.target,
    meta.right,
    meta.referent,
    meta.whole,
    meta.focus
  ]) {
    if (typeof value === "string" && value.length > 0) {
      refs.push(value);
    }
  }
  return refs;
}

function adjunctParents(snapshot: SnapshotState | null, handleId: string): string[] {
  const adjuncts = snapshot?.adjuncts;
  if (!adjuncts || typeof adjuncts !== "object") {
    return [];
  }
  const parents: string[] = [];
  for (const [head, ids] of Object.entries(adjuncts as Record<string, unknown>)) {
    if (asStringArray(ids).includes(handleId) && !parents.includes(head)) {
      parents.push(head);
    }
  }
  return parents;
}

function handleReferents(snapshot: SnapshotState | null, handleId: string): string[] {
  const handle = snapshotHandles(snapshot).get(handleId);
  if (!handle) {
    return [handleId];
  }
  const refs = uniqueStrings([...handleMetaRefs(handle), ...adjunctParents(snapshot, handleId)]);
  return refs.length > 0 ? refs : [handleId];
}

function isLiveAddressable(snapshot: SnapshotState | null, handleId: string): boolean {
  const focus = typeof snapshot?.vm?.F === "string" ? snapshot.vm.F : "";
  return (
    stackExports(snapshot, focus).includes(handleId) ||
    (handleId !== focus && adjunctExports(snapshot).includes(handleId))
  );
}

function constructionFromEntry(entry: Record<string, any>): Record<string, any> | null {
  const toch = phaseDetail(entry, "toch");
  if (toch?.wrapped_construction && typeof toch.wrapped_construction === "object") {
    return toch.wrapped_construction as Record<string, any>;
  }
  const bound = phaseDetail(entry, "bound");
  if (bound?.construction && typeof bound.construction === "object") {
    return bound.construction as Record<string, any>;
  }
  return null;
}

function constructionReferents(entry: Record<string, any>): string[] {
  const construction = constructionFromEntry(entry);
  if (!construction) {
    return [];
  }
  const meta =
    construction.meta && typeof construction.meta === "object"
      ? (construction.meta as Record<string, any>)
      : {};
  const refs: string[] = [];
  for (const value of [
    construction.base,
    meta.source,
    meta.target,
    meta.focus,
    meta.whole,
    meta.constructId,
    meta.origin,
    meta.referent
  ]) {
    if (typeof value === "string" && value.length > 0) {
      refs.push(value);
    }
  }
  return uniqueStrings(refs);
}

function selectArgs(entry: Record<string, any>): string[] {
  const select = phaseDetail(entry, "select");
  const ops =
    select?.select_operands && typeof select.select_operands === "object"
      ? (select.select_operands as Record<string, any>)
      : {};
  return asStringArray(ops.args);
}

function exportedAdjunctIds(entry: Record<string, any>): string[] {
  const construction = constructionFromEntry(entry);
  const meta =
    construction?.meta && typeof construction.meta === "object"
      ? (construction.meta as Record<string, any>)
      : {};
  const fromMeta = asStringArray(meta.exported_adjuncts);
  const fromEvents = Array.isArray(entry.events)
    ? entry.events.flatMap((event: Record<string, any>) => {
        const data =
          event?.data && typeof event.data === "object" ? (event.data as Record<string, any>) : {};
        return asStringArray(data.exported_adjuncts);
      })
    : [];
  return uniqueStrings([...fromMeta, ...fromEvents]);
}

function detectExportKind(
  snapshot: SnapshotState | null,
  handleId: string,
  carrier: CursorExportCarrier
): CursorExportKind {
  if (carrier === "ה") {
    return "adjunct_export";
  }
  const handle = snapshotHandles(snapshot).get(handleId);
  const meta =
    handle?.meta && typeof handle.meta === "object" ? (handle.meta as Record<string, any>) : {};
  if (typeof meta.pinOf === "string") {
    return "pin_export";
  }
  if (typeof meta.portOf === "string" || meta.handle_label === "resolved_port") {
    return "port_export";
  }
  if (meta.export_origin === true || typeof meta.target === "string") {
    return "origin_export";
  }
  return "export";
}

function exportsCreatedByEntry(entry: Record<string, any>): ExportInit[] {
  const carrier = entry.token;
  if (carrier !== "י" && carrier !== "ז" && carrier !== "ע" && carrier !== "ה") {
    return [];
  }

  const pre = phaseSnapshot(entry, "token_enter");
  const post = phaseSnapshot(entry, "token_exit");
  const focus = typeof post?.vm?.F === "string" ? post.vm.F : "";
  const createdIds = createdHandleIds(pre, post);
  const createdSet = new Set(createdIds);
  const out: ExportInit[] = [];

  if (carrier === "ה") {
    for (const handleId of exportedAdjunctIds(entry)) {
      if (!createdSet.has(handleId)) {
        continue;
      }
      out.push({
        handleId,
        carrier,
        exportKind: "adjunct_export",
        createdAtStep: Number(entry.index ?? 0),
        createdByToken: String(entry.token_raw ?? entry.token ?? carrier),
        referents: handleReferents(post, handleId)
      });
    }
    return out;
  }

  for (const handleId of stackExports(post, focus)) {
    if (!createdSet.has(handleId)) {
      continue;
    }
    out.push({
      handleId,
      carrier,
      exportKind: detectExportKind(post, handleId, carrier),
      createdAtStep: Number(entry.index ?? 0),
      createdByToken: String(entry.token_raw ?? entry.token ?? carrier),
      referents: handleReferents(post, handleId)
    });
  }

  return out;
}

function classifyExport(
  exported: ExportInit,
  laterEntries: Record<string, any>[],
  boundarySnapshot: SnapshotState | null
): CursorExportRecord {
  for (const entry of laterEntries) {
    if (selectArgs(entry).includes(exported.handleId)) {
      return {
        handle_id: exported.handleId,
        carrier: exported.carrier,
        export_kind: exported.exportKind,
        created_at_step: exported.createdAtStep,
        created_by_token: exported.createdByToken,
        referents: exported.referents,
        outcome: "consumed_later",
        consumed_by_step: Number(entry.index ?? 0),
        consumed_by_token: String(entry.token_raw ?? entry.token ?? ""),
        accompanied_by_step: null,
        accompanied_by_token: null,
        live_at_boundary: isLiveAddressable(boundarySnapshot, exported.handleId)
      };
    }

    const pre = phaseSnapshot(entry, "token_enter");
    const post = phaseSnapshot(entry, "token_exit");
    const stillLive =
      isLiveAddressable(pre, exported.handleId) && isLiveAddressable(post, exported.handleId);
    if (!stillLive) {
      continue;
    }
    const laterReferents = new Set(constructionReferents(entry));
    if (exported.referents.some((referent) => laterReferents.has(referent))) {
      return {
        handle_id: exported.handleId,
        carrier: exported.carrier,
        export_kind: exported.exportKind,
        created_at_step: exported.createdAtStep,
        created_by_token: exported.createdByToken,
        referents: exported.referents,
        outcome: "accompanied_later",
        consumed_by_step: null,
        consumed_by_token: null,
        accompanied_by_step: Number(entry.index ?? 0),
        accompanied_by_token: String(entry.token_raw ?? entry.token ?? ""),
        live_at_boundary: isLiveAddressable(boundarySnapshot, exported.handleId)
      };
    }
  }

  const liveAtBoundary = isLiveAddressable(boundarySnapshot, exported.handleId);
  if (!liveAtBoundary) {
    throw new Error(
      `Exported handle ${exported.handleId} from ${exported.createdByToken} became unclassified before boundary`
    );
  }
  return {
    handle_id: exported.handleId,
    carrier: exported.carrier,
    export_kind: exported.exportKind,
    created_at_step: exported.createdAtStep,
    created_by_token: exported.createdByToken,
    referents: exported.referents,
    outcome: "live_unused_at_boundary",
    consumed_by_step: null,
    consumed_by_token: null,
    accompanied_by_step: null,
    accompanied_by_token: null,
    live_at_boundary: true
  };
}

async function analyzeStableCase(
  entry: CursorConsumerBenchmarkCase,
  inputPath: string
): Promise<CursorExportDeadnessCaseResult> {
  const trace = await runPasukTrace({
    input: inputPath,
    ref: "Genesis/1/1",
    text: entry.isolated_text,
    lang: "he",
    normalizeFinals: false,
    keepTeamim: false,
    allowRuntimeErrors: false,
    includeSnapshots: true,
    showPostReset: false,
    outJson: path.resolve(process.cwd(), ".tmp", "axis", `${entry.id}.json`),
    outReport: path.resolve(process.cwd(), ".tmp", "axis", `${entry.id}.txt`),
    printReport: false
  } satisfies PasukTraceOptions);

  const word = trace.word_sections[0];
  if (!word) {
    throw new Error(`Stable cursor export audit found no word section for ${entry.id}`);
  }

  const boundarySnapshot = phaseSnapshot(
    word.op_entries[word.op_entries.length - 1] as Record<string, any>,
    "token_exit"
  );
  const exportedPoints: CursorExportRecord[] = [];

  word.op_entries.forEach((opEntry, index) => {
    const exportsForStep = exportsCreatedByEntry(opEntry as Record<string, any>);
    if (exportsForStep.length === 0) {
      return;
    }
    const laterEntries = word.op_entries.slice(index + 1) as Array<Record<string, any>>;
    for (const exported of exportsForStep) {
      exportedPoints.push(classifyExport(exported, laterEntries, boundarySnapshot));
    }
  });

  return {
    case_id: entry.id,
    token: entry.token,
    ref: entry.ref,
    word_index: entry.word_index,
    exported_points: exportedPoints
  };
}

function formatRate(value: number): string {
  return value.toFixed(3);
}

function formatCaseLine(result: CursorExportDeadnessCaseResult): string[] {
  const lines: string[] = [];
  lines.push(`### \`${result.token}\` — \`${result.case_id}\``);
  lines.push("");
  lines.push(`- ref: \`${result.ref}\` word \`${result.word_index}\``);
  if (result.exported_points.length === 0) {
    lines.push("- exported points: none");
    lines.push("");
    return lines;
  }
  lines.push("| handle | carrier | kind | outcome | later step | live at boundary |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const exported of result.exported_points) {
    const laterStep =
      exported.outcome === "consumed_later"
        ? `consumed by \`${exported.consumed_by_token}\` @ ${exported.consumed_by_step}`
        : exported.outcome === "accompanied_later"
          ? `accompanied by \`${exported.accompanied_by_token}\` @ ${exported.accompanied_by_step}`
          : "-";
    lines.push(
      `| \`${exported.handle_id}\` | \`${exported.carrier}\` | \`${exported.export_kind}\` | \`${exported.outcome}\` | ${laterStep} | \`${exported.live_at_boundary}\` |`
    );
  }
  lines.push("");
  return lines;
}

export function renderCursorExportDeadnessReport(
  summary: Omit<CursorExportDeadnessReport, "report_text">
): string {
  const suiteScope = analyzeCursorAuditWords(summary.cases.map((entry) => entry.token));
  const lines: string[] = [];
  lines.push("# Stable Cursor Export Deadness Audit");
  lines.push("");
  lines.push(renderCursorAuditScopeHeader(suiteScope));
  lines.push("");
  lines.push("## Goal");
  lines.push("");
  lines.push(
    "Measure how often the stable benchmark creates independently addressable non-`F` points that are later consumed, accompanied, or left live but unused at boundary."
  );
  lines.push("");
  lines.push("## Mode");
  lines.push("");
  lines.push("- benchmark mode: `isolated_stable`");
  lines.push(
    "- rationale: isolated-token execution preserves the stable-only allowlist and avoids verse-context contamination from stale letters outside the benchmark token"
  );
  lines.push(
    "- note: the current stable suite contains no dedicated `י` case, so `י` export counts are `0` in this baseline"
  );
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- stable cases: \`${summary.stable_case_count}\``);
  lines.push(`- total exported non-\`F\` points: \`${summary.counts.total_exported_points}\``);
  lines.push(
    `- consumed later: \`${summary.counts.consumed}\` (\`${formatRate(summary.rates.consumed_rate)}\`)`
  );
  lines.push(
    `- accompanied later: \`${summary.counts.accompanied}\` (\`${formatRate(summary.rates.accompanied_rate)}\`)`
  );
  lines.push(
    `- live but unused at boundary: \`${summary.counts.dead}\` (\`${formatRate(summary.rates.dead_rate)}\`)`
  );
  lines.push(
    `- by letter: \`י=${summary.counts.by_letter["י"]}\` \`ז=${summary.counts.by_letter["ז"]}\` \`ע=${summary.counts.by_letter["ע"]}\` \`ה=${summary.counts.by_letter["ה"]}\``
  );
  lines.push("");
  lines.push("## Cases");
  lines.push("");
  for (const result of summary.cases) {
    lines.push(...formatCaseLine(result));
  }
  return lines.join("\n");
}

export async function analyzeStableCursorExportDeadness(
  options: {
    benchmark?: CursorConsumerBenchmark;
    benchmarkPath?: string;
    inputPath?: string;
  } = {}
): Promise<Omit<CursorExportDeadnessReport, "report_text">> {
  const benchmark = options.benchmark ?? loadCursorConsumerBenchmark(options.benchmarkPath);
  const stableCases = getStableCursorConsumerBenchmarkCases(benchmark);
  const inputPath = path.resolve(process.cwd(), options.inputPath ?? "data/torah.json");
  const suiteScope = analyzeCursorAuditWords(stableCases.map((entry) => entry.token));

  const caseResults: CursorExportDeadnessCaseResult[] = [];
  for (const entry of stableCases) {
    caseResults.push(await analyzeStableCase(entry, inputPath));
  }

  const counts = {
    total_exported_points: 0,
    consumed: 0,
    accompanied: 0,
    dead: 0,
    by_letter: {
      י: 0,
      ז: 0,
      ע: 0,
      ה: 0
    } as Record<CursorExportCarrier, number>
  };

  for (const result of caseResults) {
    for (const exported of result.exported_points) {
      counts.total_exported_points += 1;
      counts.by_letter[exported.carrier] += 1;
      if (exported.outcome === "consumed_later") {
        counts.consumed += 1;
      } else if (exported.outcome === "accompanied_later") {
        counts.accompanied += 1;
      } else {
        counts.dead += 1;
      }
    }
  }

  const denominator = counts.total_exported_points || 1;
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    benchmark_path: options.benchmarkPath
      ? path.resolve(process.cwd(), options.benchmarkPath)
      : path.resolve(process.cwd(), "config", "cursor-consumer-benchmark.v1.json"),
    benchmark_name: benchmark.suite_name,
    mode: "isolated_stable",
    suite_status: suiteScope.status,
    stable_case_count: stableCases.length,
    counts,
    rates: {
      consumed_rate: counts.consumed / denominator,
      accompanied_rate: counts.accompanied / denominator,
      dead_rate: counts.dead / denominator
    },
    cases: caseResults
  };
}
