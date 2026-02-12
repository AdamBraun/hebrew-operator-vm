import { workspaceRelativePath } from "./report";

type ComparableRow = {
  ref_key: string;
  surface: unknown;
  tokens: unknown;
  events: unknown;
  flow_skeleton: unknown;
  one_liner: unknown;
};

type DiffInputRow = {
  ref_key?: string;
  surface?: unknown;
  tokens?: unknown;
  events?: unknown;
  flow_skeleton?: unknown;
  one_liner?: unknown;
};

export function normalizeComparableRow(row: DiffInputRow): ComparableRow {
  return {
    ref_key: String(row.ref_key ?? ""),
    surface: row.surface,
    tokens: row.tokens,
    events: row.events,
    flow_skeleton: row.flow_skeleton,
    one_liner: row.one_liner
  };
}

export function buildDiffPayload(
  prevPath: string,
  nextPath: string,
  prevRows: DiffInputRow[],
  nextRows: DiffInputRow[]
): {
  schema_version: number;
  prev: string;
  next: string;
  summary: {
    total_prev: number;
    total_next: number;
    changed_words: number;
    by_reason: Record<string, number>;
  };
  groups: Record<string, string[]>;
  changed_words: Array<{ ref_key: string; why: string[] }>;
} {
  const prevMap = new Map(
    prevRows.map((row) => [String(row.ref_key ?? ""), normalizeComparableRow(row)])
  );
  const nextMap = new Map(
    nextRows.map((row) => [String(row.ref_key ?? ""), normalizeComparableRow(row)])
  );
  const keys = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()])).sort((left, right) =>
    left.localeCompare(right, "en")
  );

  const groups: Record<string, string[]> = {
    added: [],
    removed: [],
    token_sequence_changed: [],
    event_stream_changed: [],
    flow_skeleton_changed: [],
    one_liner_changed: [],
    surface_changed: []
  };

  const changedWords: Array<{ ref_key: string; why: string[] }> = [];

  for (const key of keys) {
    if (!key) {
      continue;
    }
    const prev = prevMap.get(key);
    const next = nextMap.get(key);
    if (!prev && next) {
      groups.added.push(key);
      changedWords.push({ ref_key: key, why: ["added"] });
      continue;
    }
    if (prev && !next) {
      groups.removed.push(key);
      changedWords.push({ ref_key: key, why: ["removed"] });
      continue;
    }
    if (!prev || !next) {
      continue;
    }

    const why: string[] = [];
    if (JSON.stringify(prev.surface) !== JSON.stringify(next.surface)) {
      groups.surface_changed.push(key);
      why.push("surface_changed");
    }
    if (JSON.stringify(prev.tokens) !== JSON.stringify(next.tokens)) {
      groups.token_sequence_changed.push(key);
      why.push("token_sequence_changed");
    }
    if (JSON.stringify(prev.events) !== JSON.stringify(next.events)) {
      groups.event_stream_changed.push(key);
      why.push("event_stream_changed");
    }
    if (JSON.stringify(prev.flow_skeleton) !== JSON.stringify(next.flow_skeleton)) {
      groups.flow_skeleton_changed.push(key);
      why.push("flow_skeleton_changed");
    }
    if (JSON.stringify(prev.one_liner) !== JSON.stringify(next.one_liner)) {
      groups.one_liner_changed.push(key);
      why.push("one_liner_changed");
    }
    if (why.length > 0) {
      changedWords.push({ ref_key: key, why });
    }
  }

  return {
    schema_version: 1,
    prev: workspaceRelativePath(prevPath),
    next: workspaceRelativePath(nextPath),
    summary: {
      total_prev: prevRows.length,
      total_next: nextRows.length,
      changed_words: changedWords.length,
      by_reason: Object.fromEntries(Object.entries(groups).map(([key, refs]) => [key, refs.length]))
    },
    groups,
    changed_words: changedWords
  };
}
