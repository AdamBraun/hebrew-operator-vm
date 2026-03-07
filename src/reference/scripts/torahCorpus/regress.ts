import {
  formatWarningCounts,
  markdownSafe,
  prettyRef,
  type PrettyRefRow,
  summarizeSemanticVersions,
  workspaceRelativePath
} from "./report";

type GoldenCandidateRow = {
  key: string;
  ref: unknown;
  surface: string;
  skeleton: string[];
};

type DeltaGroup = {
  signature: string;
  sample_keys?: string[];
};

type ChangedSkeletonRow = {
  key: string;
};

type BuildCuratedGoldensInput = {
  runRows: GoldenCandidateRow[];
  runMap: Map<string, GoldenCandidateRow>;
  groupedDeltas: DeltaGroup[];
  changedSkeletonRows: ChangedSkeletonRow[];
  goldenLimit: number;
};

type RegressionFailure = {
  key: string;
  surface: string;
  ref: string;
  reason: string;
  expected_skeleton: string[] | null;
  actual_skeleton: string[] | null;
  delta_summary: string;
};

type BuildRegressionReportInput = {
  runB: {
    trace_path: string;
    semantics_versions: string[];
  };
  compileB: {
    path?: string;
    warning_count?: number;
    warning_by_code?: Record<string, number>;
  };
  goldensPath: string;
  regressionFailures: RegressionFailure[];
  regressionPasses: string[];
};

type RegressDiffRow = PrettyRefRow & {
  surface: string;
  flow: string;
  skeleton: string[];
  semantics_version: string;
};

type RegressDiffRun = {
  trace_path: string;
  trace_sha256: string;
  semantics_versions: string[];
  rows: unknown[];
  map: Map<string, RegressDiffRow>;
};

type RegressDiffCompile = {
  path?: string;
  registry_sha256: string;
  warning_count?: number;
  warning_by_code?: Record<string, number>;
  load_error?: string;
};

type RegressDeltaGroup = {
  count: number;
  change_type: string;
  signature: string;
  summary: string;
  sample_keys: string[];
};

type RegressSkeletonChange = {
  key: string;
  row_a: RegressDiffRow;
  row_b: RegressDiffRow;
  delta: {
    summary: string;
  };
  semantic_reason: string;
  warning_reason: string;
};

type RegressRenderingChange = {
  key: string;
  row_a: RegressDiffRow;
  row_b: RegressDiffRow;
  semantic_reason: string;
  warning_reason: string;
};

type BuildRegressDiffLinesInput = {
  runA: RegressDiffRun;
  runB: RegressDiffRun;
  compileA: RegressDiffCompile;
  compileB: RegressDiffCompile;
  addedKeys: string[];
  removedKeys: string[];
  skeletonChanges: RegressSkeletonChange[];
  renderingChanges: RegressRenderingChange[];
  topGroupedDeltas: RegressDeltaGroup[];
};

type CompareRunsInput = {
  runA: RegressDiffRun;
  runB: RegressDiffRun;
  compileA: unknown;
  compileB: unknown;
  sortRefLike: (left: string, right: string) => number;
  arraysEqual: (left: string[], right: string[]) => boolean;
  classifySkeletonDelta: (
    previousSkeleton: string[],
    nextSkeleton: string[]
  ) => {
    change_type: string;
    signature: string;
    summary: string;
  };
  wordWarningSummary: (row: RegressDiffRow, compileContext: unknown) => unknown;
  warningDeltaText: (leftSummary: unknown, rightSummary: unknown) => string;
};

type EvaluateGoldenCasesInput = {
  goldenCases: Array<{
    key: string;
    surface: string;
    expected_skeleton: string[];
  }>;
  runBMap: Map<string, RegressDiffRow>;
  arraysEqual: (left: string[], right: string[]) => boolean;
  classifySkeletonDelta: (
    previousSkeleton: string[],
    nextSkeleton: string[]
  ) => {
    summary: string;
  };
};

function sortRefLike(left: string, right: string): number {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

function addGoldenKey(
  selectedKeys: string[],
  notesByKey: Map<string, Set<string>>,
  key: string,
  note: string
): void {
  if (!key) {
    return;
  }
  if (!notesByKey.has(key)) {
    notesByKey.set(key, new Set());
    selectedKeys.push(key);
  }
  if (note) {
    notesByKey.get(key)?.add(note);
  }
}

function findFirstRow(
  rows: GoldenCandidateRow[],
  usedKeys: Set<string>,
  predicate: (row: GoldenCandidateRow) => boolean
): GoldenCandidateRow | null {
  for (const row of rows) {
    if (usedKeys.has(row.key)) {
      continue;
    }
    if (predicate(row)) {
      return row;
    }
  }
  return null;
}

export function buildCuratedGoldens({
  runRows,
  runMap,
  groupedDeltas,
  changedSkeletonRows,
  goldenLimit
}: BuildCuratedGoldensInput): Array<{
  key: string;
  ref: unknown;
  surface: string;
  expected_skeleton: string[];
  notes: string;
}> {
  const selectedKeys: string[] = [];
  const notesByKey = new Map<string, Set<string>>();
  const usedKeys = new Set<string>();

  for (const group of groupedDeltas) {
    const candidate = group.sample_keys?.[0];
    if (!candidate || usedKeys.has(candidate)) {
      continue;
    }
    usedKeys.add(candidate);
    addGoldenKey(selectedKeys, notesByKey, candidate, `delta:${group.signature}`);
    if (selectedKeys.length >= goldenLimit) {
      break;
    }
  }

  const edgeRules = [
    {
      note: "edge:mappiq",
      predicate: (row: GoldenCandidateRow) => row.surface.includes("הּ")
    },
    {
      note: "edge:shin_sin",
      predicate: (row: GoldenCandidateRow) =>
        row.surface.includes("שׁ") ||
        row.surface.includes("שׂ") ||
        row.skeleton.includes("SHIN.FORK")
    },
    {
      note: "edge:finals",
      predicate: (row: GoldenCandidateRow) =>
        /[ךםןףץ]/u.test(row.surface) || row.skeleton.some((op) => op.startsWith("FINAL_"))
    }
  ];

  for (const rule of edgeRules) {
    if (selectedKeys.length >= goldenLimit) {
      break;
    }
    const row = findFirstRow(runRows, usedKeys, rule.predicate);
    if (!row) {
      continue;
    }
    usedKeys.add(row.key);
    addGoldenKey(selectedKeys, notesByKey, row.key, rule.note);
  }

  const familyRules = [
    {
      note: "family:ALEPH",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("ALEPH."))
    },
    {
      note: "family:HE",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("HE."))
    },
    {
      note: "family:TAV",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("TAV."))
    },
    {
      note: "family:MEM",
      predicate: (row: GoldenCandidateRow) => row.skeleton.includes("MEM.OPEN")
    },
    {
      note: "family:FINAL_MEM",
      predicate: (row: GoldenCandidateRow) => row.skeleton.includes("FINAL_MEM.CLOSE")
    },
    {
      note: "family:NUN",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("NUN."))
    },
    {
      note: "family:SAMEKH",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("SAMEKH."))
    },
    {
      note: "family:SHIN",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("SHIN."))
    },
    {
      note: "family:TSADI",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.includes("TSADI."))
    },
    {
      note: "family:SPACE",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("SPACE."))
    },
    {
      note: "family:PE",
      predicate: (row: GoldenCandidateRow) => row.skeleton.some((op) => op.startsWith("PE."))
    }
  ];

  for (const rule of familyRules) {
    if (selectedKeys.length >= goldenLimit) {
      break;
    }
    const row = findFirstRow(runRows, usedKeys, rule.predicate);
    if (!row) {
      continue;
    }
    usedKeys.add(row.key);
    addGoldenKey(selectedKeys, notesByKey, row.key, rule.note);
  }

  for (const change of changedSkeletonRows) {
    if (selectedKeys.length >= goldenLimit) {
      break;
    }
    if (usedKeys.has(change.key)) {
      continue;
    }
    const row = runMap.get(change.key);
    if (!row) {
      continue;
    }
    usedKeys.add(change.key);
    addGoldenKey(selectedKeys, notesByKey, change.key, "changed:representative");
  }

  const cases = [];
  for (const key of selectedKeys) {
    if (cases.length >= goldenLimit) {
      break;
    }
    const row = runMap.get(key);
    if (!row) {
      continue;
    }
    const notes = Array.from(notesByKey.get(key) ?? []).sort(sortRefLike);
    cases.push({
      key,
      ref: row.ref,
      surface: row.surface,
      expected_skeleton: row.skeleton,
      notes: notes.length > 0 ? notes.join("; ") : "curated"
    });
  }
  return cases;
}

export function buildRegressionReport({
  runB,
  compileB,
  goldensPath,
  regressionFailures,
  regressionPasses
}: BuildRegressionReportInput): string[] {
  const lines = [
    "# Regression Report",
    "",
    "## Inputs",
    `- run_b: ${workspaceRelativePath(runB.trace_path)}`,
    `- semantics_versions: ${summarizeSemanticVersions(runB.semantics_versions)}`,
    `- goldens: ${workspaceRelativePath(goldensPath)}`,
    `- compile_bundle: ${compileB.path ? workspaceRelativePath(compileB.path) : "not found"}`,
    `- compile_warnings: ${compileB.warning_count ?? "unknown"} (${formatWarningCounts(
      compileB.warning_by_code
    )})`,
    "",
    "## Summary",
    `- total_goldens: ${regressionPasses.length + regressionFailures.length}`,
    `- passed: ${regressionPasses.length}`,
    `- failed: ${regressionFailures.length}`
  ];

  if (regressionFailures.length === 0) {
    lines.push("", "## Result", "- PASS");
    return lines;
  }

  lines.push("", "## Result", "- FAIL");
  lines.push("", "## Failures");
  for (const failure of regressionFailures) {
    lines.push(`- ${failure.key} (${failure.surface || "n/a"})`);
    lines.push(`  - ref: ${failure.ref}`);
    lines.push(`  - reason: ${failure.reason}`);
    if (failure.expected_skeleton) {
      lines.push(`  - expected: ${failure.expected_skeleton.join(" -> ") || "(empty)"}`);
    }
    if (failure.actual_skeleton) {
      lines.push(`  - actual: ${failure.actual_skeleton.join(" -> ") || "(empty)"}`);
    }
    if (failure.delta_summary) {
      lines.push(`  - delta: ${failure.delta_summary}`);
    }
  }

  return lines;
}

function truncate(value: unknown, max = 120): string {
  const text = String(value);
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

type InterestingSample = {
  kind: string;
  key: string;
  summary: string;
  semantic_reason: string;
  warning_reason: string;
  row_a: RegressDiffRow | null;
  row_b: RegressDiffRow | null;
};

export function buildRegressDiffLines({
  runA,
  runB,
  compileA,
  compileB,
  addedKeys,
  removedKeys,
  skeletonChanges,
  renderingChanges,
  topGroupedDeltas
}: BuildRegressDiffLinesInput): string[] {
  const diffLines = [
    "# Run-to-Run Diff Report",
    "",
    "## Header",
    `- run_a: ${workspaceRelativePath(runA.trace_path)}`,
    `- run_b: ${workspaceRelativePath(runB.trace_path)}`,
    `- trace_sha256_a: ${runA.trace_sha256}`,
    `- trace_sha256_b: ${runB.trace_sha256}`,
    `- semantics_versions_a: ${summarizeSemanticVersions(runA.semantics_versions)}`,
    `- semantics_versions_b: ${summarizeSemanticVersions(runB.semantics_versions)}`,
    `- compiled_bundle_a: ${compileA.path ? workspaceRelativePath(compileA.path) : "not found"}`,
    `- compiled_bundle_b: ${compileB.path ? workspaceRelativePath(compileB.path) : "not found"}`,
    `- registry_sha256_a: ${compileA.registry_sha256}`,
    `- registry_sha256_b: ${compileB.registry_sha256}`,
    `- compile_warnings_a: ${compileA.warning_count ?? "unknown"} (${formatWarningCounts(
      compileA.warning_by_code
    )})`,
    `- compile_warnings_b: ${compileB.warning_count ?? "unknown"} (${formatWarningCounts(
      compileB.warning_by_code
    )})`,
    "",
    "## Summary",
    `- total_words_a: ${runA.rows.length}`,
    `- total_words_b: ${runB.rows.length}`,
    `- stable_identity: PASS (duplicate keys rejected per-run)`,
    `- ingestion_changes: ${addedKeys.length + removedKeys.length}`,
    `- skeleton_changes: ${skeletonChanges.length}`,
    `- rendering_only_changes: ${renderingChanges.length}`
  ];

  if (compileA.load_error) {
    diffLines.push(`- compile_context_a_note: ${compileA.load_error}`);
  }
  if (compileB.load_error) {
    diffLines.push(`- compile_context_b_note: ${compileB.load_error}`);
  }

  diffLines.push("", "## Breaking Changes (Tokenization / Ingestion)");
  diffLines.push(`- added_keys_in_b: ${addedKeys.length}`);
  diffLines.push(`- removed_keys_from_a: ${removedKeys.length}`);

  if (addedKeys.length > 0) {
    diffLines.push("", "### Added Samples");
    for (const key of addedKeys.slice(0, 20)) {
      const row = runB.map.get(key);
      if (!row) {
        continue;
      }
      diffLines.push(`- ${key} | ${prettyRef(row)} | ${row.surface} | ${row.flow}`);
    }
  }

  if (removedKeys.length > 0) {
    diffLines.push("", "### Removed Samples");
    for (const key of removedKeys.slice(0, 20)) {
      const row = runA.map.get(key);
      if (!row) {
        continue;
      }
      diffLines.push(`- ${key} | ${prettyRef(row)} | ${row.surface} | ${row.flow}`);
    }
  }

  diffLines.push("", "## Top Skeleton Delta Groups");
  if (topGroupedDeltas.length === 0) {
    diffLines.push("- none");
  } else {
    diffLines.push("| rank | count | change_type | signature | sample_summary |");
    diffLines.push("| ---: | ---: | --- | --- | --- |");
    for (let index = 0; index < topGroupedDeltas.length; index += 1) {
      const entry = topGroupedDeltas[index];
      diffLines.push(
        `| ${index + 1} | ${entry.count} | ${markdownSafe(entry.change_type)} | ${markdownSafe(
          truncate(entry.signature, 100)
        )} | ${markdownSafe(truncate(entry.summary, 100))} |`
      );
    }
  }

  diffLines.push("", "## Rendering-Only Changes");
  if (renderingChanges.length === 0) {
    diffLines.push("- none");
  } else {
    for (const change of renderingChanges.slice(0, 20)) {
      diffLines.push(`- ${change.key} | ${prettyRef(change.row_b)} | ${change.row_b.surface}`);
      diffLines.push(`  - skeleton: ${(change.row_b.skeleton ?? []).join(" -> ") || "(empty)"}`);
      diffLines.push(`  - flow_a: ${change.row_a.flow}`);
      diffLines.push(`  - flow_b: ${change.row_b.flow}`);
    }
  }

  const interesting: InterestingSample[] = [];
  const seenInteresting = new Set<string>();
  const addInteresting = (entry: InterestingSample) => {
    const id = `${entry.kind}:${entry.key}`;
    if (seenInteresting.has(id)) {
      return;
    }
    seenInteresting.add(id);
    interesting.push(entry);
  };

  for (const group of topGroupedDeltas.slice(0, 12)) {
    const sampleKey = group.sample_keys[0];
    const sample = skeletonChanges.find((change) => change.key === sampleKey);
    if (!sample) {
      continue;
    }
    addInteresting({
      kind: "skeleton_delta",
      key: sample.key,
      summary: sample.delta.summary,
      semantic_reason: sample.semantic_reason,
      warning_reason: sample.warning_reason,
      row_a: sample.row_a,
      row_b: sample.row_b
    });
  }

  for (const key of addedKeys.slice(0, 4)) {
    const row = runB.map.get(key);
    if (!row) {
      continue;
    }
    addInteresting({
      kind: "added",
      key,
      summary: "New key present in run B only",
      semantic_reason: `semantics_version ${row.semantics_version}`,
      warning_reason: "compile warning delta unavailable for added key",
      row_a: null,
      row_b: row
    });
  }

  for (const key of removedKeys.slice(0, 4)) {
    const row = runA.map.get(key);
    if (!row) {
      continue;
    }
    addInteresting({
      kind: "removed",
      key,
      summary: "Key removed from run B",
      semantic_reason: `semantics_version ${row.semantics_version}`,
      warning_reason: "compile warning delta unavailable for removed key",
      row_a: row,
      row_b: null
    });
  }

  for (const change of renderingChanges.slice(0, 4)) {
    addInteresting({
      kind: "rendering_only",
      key: change.key,
      summary: "Flow text changed, skeleton unchanged",
      semantic_reason: change.semantic_reason,
      warning_reason: change.warning_reason,
      row_a: change.row_a,
      row_b: change.row_b
    });
  }

  diffLines.push("", "## Most Interesting Samples");
  if (interesting.length === 0) {
    diffLines.push("- none");
  } else {
    for (const sample of interesting.slice(0, 20)) {
      const rowForRef = sample.row_b ??
        sample.row_a ?? {
          key: sample.key,
          surface: "",
          flow: "",
          skeleton: [],
          semantics_version: "unknown"
        };
      diffLines.push(`- [${sample.kind}] ${sample.key} | ${prettyRef(rowForRef)}`);
      diffLines.push(`  - summary: ${sample.summary}`);
      diffLines.push(`  - why: ${sample.semantic_reason}; ${sample.warning_reason}`);
      if (sample.row_a) {
        diffLines.push(`  - run_a: ${sample.row_a.surface} :: ${sample.row_a.flow}`);
      }
      if (sample.row_b) {
        diffLines.push(`  - run_b: ${sample.row_b.surface} :: ${sample.row_b.flow}`);
      }
    }
  }

  return diffLines;
}

export function compareRegressRuns({
  runA,
  runB,
  compileA,
  compileB,
  sortRefLike,
  arraysEqual,
  classifySkeletonDelta,
  wordWarningSummary,
  warningDeltaText
}: CompareRunsInput): {
  addedKeys: string[];
  removedKeys: string[];
  renderingChanges: RegressRenderingChange[];
  skeletonChanges: RegressSkeletonChange[];
  groupedDeltas: RegressDeltaGroup[];
  topGroupedDeltas: RegressDeltaGroup[];
} {
  const allKeys = Array.from(new Set([...runA.map.keys(), ...runB.map.keys()])).sort(sortRefLike);
  const addedKeys: string[] = [];
  const removedKeys: string[] = [];
  const renderingChanges: RegressRenderingChange[] = [];
  const skeletonChanges: RegressSkeletonChange[] = [];
  const groupedDeltaMap = new Map<string, RegressDeltaGroup>();

  for (const key of allKeys) {
    const rowA = runA.map.get(key);
    const rowB = runB.map.get(key);
    if (!rowA && rowB) {
      addedKeys.push(key);
      continue;
    }
    if (rowA && !rowB) {
      removedKeys.push(key);
      continue;
    }
    if (!rowA || !rowB) {
      continue;
    }

    if (!arraysEqual(rowA.skeleton, rowB.skeleton)) {
      const delta = classifySkeletonDelta(rowA.skeleton, rowB.skeleton);
      const warningsA = wordWarningSummary(rowA, compileA);
      const warningsB = wordWarningSummary(rowB, compileB);
      const semanticReason =
        rowA.semantics_version === rowB.semantics_version
          ? `semantics_version unchanged (${rowA.semantics_version})`
          : `semantics_version ${rowA.semantics_version} -> ${rowB.semantics_version}`;
      const warningReason = warningDeltaText(warningsA, warningsB);

      const change = {
        key,
        row_a: rowA,
        row_b: rowB,
        delta,
        semantic_reason: semanticReason,
        warning_reason: warningReason
      };
      skeletonChanges.push(change);

      const group = groupedDeltaMap.get(delta.signature) ?? {
        signature: delta.signature,
        change_type: delta.change_type,
        summary: delta.summary,
        count: 0,
        sample_keys: []
      };
      group.count += 1;
      if (group.sample_keys.length < 20) {
        group.sample_keys.push(key);
      }
      groupedDeltaMap.set(delta.signature, group);
      continue;
    }

    if (rowA.flow !== rowB.flow) {
      const semanticReason =
        rowA.semantics_version === rowB.semantics_version
          ? `semantics_version unchanged (${rowB.semantics_version})`
          : `semantics_version ${rowA.semantics_version} -> ${rowB.semantics_version}`;
      const warningReason = warningDeltaText(
        wordWarningSummary(rowA, compileA),
        wordWarningSummary(rowB, compileB)
      );
      renderingChanges.push({
        key,
        row_a: rowA,
        row_b: rowB,
        semantic_reason: semanticReason,
        warning_reason: warningReason
      });
    }
  }

  const groupedDeltas = Array.from(groupedDeltaMap.values()).sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }
    return sortRefLike(left.signature, right.signature);
  });
  const topGroupedDeltas = groupedDeltas.slice(0, 20);

  return {
    addedKeys,
    removedKeys,
    renderingChanges,
    skeletonChanges,
    groupedDeltas,
    topGroupedDeltas
  };
}

export function evaluateGoldenCases({
  goldenCases,
  runBMap,
  arraysEqual,
  classifySkeletonDelta
}: EvaluateGoldenCasesInput): {
  regressionFailures: RegressionFailure[];
  regressionPasses: string[];
} {
  const regressionFailures: RegressionFailure[] = [];
  const regressionPasses: string[] = [];

  for (const golden of goldenCases) {
    const actual = runBMap.get(golden.key);
    const refText = actual ? prettyRef(actual) : prettyRef(golden);
    if (!actual) {
      regressionFailures.push({
        key: golden.key,
        surface: golden.surface,
        ref: refText,
        reason: "missing key in run B",
        expected_skeleton: golden.expected_skeleton,
        actual_skeleton: null,
        delta_summary: ""
      });
      continue;
    }

    if (!arraysEqual(golden.expected_skeleton, actual.skeleton)) {
      const delta = classifySkeletonDelta(golden.expected_skeleton, actual.skeleton);
      regressionFailures.push({
        key: golden.key,
        surface: actual.surface,
        ref: refText,
        reason: "skeleton mismatch",
        expected_skeleton: golden.expected_skeleton,
        actual_skeleton: actual.skeleton,
        delta_summary: delta.summary
      });
      continue;
    }

    regressionPasses.push(golden.key);
  }

  return {
    regressionFailures,
    regressionPasses
  };
}
