import {
  formatWarningCounts,
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
    semantic_versions: string[];
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
      predicate: (row: GoldenCandidateRow) =>
        row.surface.includes("הּ") || row.skeleton.includes("HE.DECLARE_PIN")
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
    `- semantic_versions: ${summarizeSemanticVersions(runB.semantic_versions)}`,
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
