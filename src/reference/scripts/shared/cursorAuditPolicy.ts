import fs from "node:fs";
import path from "node:path";

export const DEFAULT_CURSOR_AUDIT_POLICY_PATH = path.resolve(
  process.cwd(),
  "config",
  "cursor-audit-allowlist.json"
);

export type CursorAuditDatasetStatus = "stable-only" | "stale-contaminated" | "blocked by `ט`";

export type CursorAuditPolicy = {
  version: number;
  glyph_universe: string[];
  stable_allowlist: string[];
  stale_excluded_families: string[];
  stale_excluded_glyphs: string[];
  graph_incomplete_families: string[];
  graph_incomplete_glyphs: string[];
};

export type CursorAuditWordStatus = {
  word: string;
  trackedGlyphs: string[];
  staleMatches: string[];
  graphIncompleteMatches: string[];
};

export type CursorAuditScope = {
  status: CursorAuditDatasetStatus;
  words: string[];
  stableAllowlist: string[];
  staleExcludedFamilies: string[];
  staleExcludedGlyphs: string[];
  graphIncompleteFamilies: string[];
  graphIncompleteGlyphs: string[];
  staleWords: CursorAuditWordStatus[];
  blockedWords: CursorAuditWordStatus[];
};

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function ensureStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`cursor audit policy field ${fieldName} must be a string[]`);
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

export function loadCursorAuditPolicy(
  policyPath: string = DEFAULT_CURSOR_AUDIT_POLICY_PATH
): CursorAuditPolicy {
  const raw = fs.readFileSync(policyPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const policy: CursorAuditPolicy = {
    version: Number(parsed.version ?? 0),
    glyph_universe: ensureStringArray(parsed.glyph_universe, "glyph_universe"),
    stable_allowlist: ensureStringArray(parsed.stable_allowlist, "stable_allowlist"),
    stale_excluded_families: ensureStringArray(
      parsed.stale_excluded_families,
      "stale_excluded_families"
    ),
    stale_excluded_glyphs: ensureStringArray(parsed.stale_excluded_glyphs, "stale_excluded_glyphs"),
    graph_incomplete_families: ensureStringArray(
      parsed.graph_incomplete_families,
      "graph_incomplete_families"
    ),
    graph_incomplete_glyphs: ensureStringArray(
      parsed.graph_incomplete_glyphs,
      "graph_incomplete_glyphs"
    )
  };

  assertCursorAuditPolicyConsistency(policy);
  return policy;
}

export function assertCursorAuditPolicyConsistency(policy: CursorAuditPolicy): void {
  if (!Number.isInteger(policy.version) || policy.version <= 0) {
    throw new Error("cursor audit policy version must be a positive integer");
  }

  const universe = new Set(policy.glyph_universe);
  const stale = new Set(policy.stale_excluded_glyphs);
  const graphIncomplete = new Set(policy.graph_incomplete_glyphs);
  const derivedStable = policy.glyph_universe.filter(
    (glyph) => !stale.has(glyph) && !graphIncomplete.has(glyph)
  );

  for (const glyph of [...policy.stable_allowlist, ...policy.stale_excluded_glyphs]) {
    if (!universe.has(glyph)) {
      throw new Error(`cursor audit policy glyph ${glyph} is not in glyph_universe`);
    }
  }

  for (const glyph of policy.graph_incomplete_glyphs) {
    if (!universe.has(glyph)) {
      throw new Error(
        `cursor audit policy graph-incomplete glyph ${glyph} is not in glyph_universe`
      );
    }
  }

  const stableMismatch =
    policy.stable_allowlist.length !== derivedStable.length ||
    policy.stable_allowlist.some((glyph, index) => glyph !== derivedStable[index]);
  if (stableMismatch) {
    throw new Error(
      "cursor audit policy stable_allowlist must equal glyph_universe minus stale and graph-incomplete glyphs"
    );
  }
}

export function extractTrackedGlyphs(word: string, policy: CursorAuditPolicy): string[] {
  const glyphs = new Set(policy.glyph_universe);
  return Array.from(word).filter((char) => glyphs.has(char));
}

export function analyzeCursorAuditWords(
  words: string[],
  policy: CursorAuditPolicy = loadCursorAuditPolicy()
): CursorAuditScope {
  const normalizedWords = words.map((word) => word.trim()).filter((word) => word.length > 0);
  const staleGlyphs = new Set(policy.stale_excluded_glyphs);
  const graphGlyphs = new Set(policy.graph_incomplete_glyphs);

  const analyzedWords = normalizedWords.map((word) => {
    const trackedGlyphs = extractTrackedGlyphs(word, policy);
    const staleMatches = uniqueInOrder(trackedGlyphs.filter((glyph) => staleGlyphs.has(glyph)));
    const graphIncompleteMatches = uniqueInOrder(
      trackedGlyphs.filter((glyph) => graphGlyphs.has(glyph))
    );
    return {
      word,
      trackedGlyphs,
      staleMatches,
      graphIncompleteMatches
    };
  });

  const staleWords = analyzedWords.filter((word) => word.staleMatches.length > 0);
  const blockedWords = analyzedWords.filter((word) => word.graphIncompleteMatches.length > 0);
  const status: CursorAuditDatasetStatus =
    blockedWords.length > 0
      ? "blocked by `ט`"
      : staleWords.length > 0
        ? "stale-contaminated"
        : "stable-only";

  return {
    status,
    words: normalizedWords,
    stableAllowlist: policy.stable_allowlist,
    staleExcludedFamilies: policy.stale_excluded_families,
    staleExcludedGlyphs: policy.stale_excluded_glyphs,
    graphIncompleteFamilies: policy.graph_incomplete_families,
    graphIncompleteGlyphs: policy.graph_incomplete_glyphs,
    staleWords,
    blockedWords
  };
}

function formatWords(words: string[]): string {
  return words.length > 0 ? words.map((word) => `\`${word}\``).join(", ") : "none";
}

function formatWordMatches(
  words: CursorAuditWordStatus[],
  matchKey: "staleMatches" | "graphIncompleteMatches"
): string {
  if (words.length === 0) {
    return "none";
  }
  return words
    .map((word) => `\`${word.word}\` (${word[matchKey].map((glyph) => `\`${glyph}\``).join(", ")})`)
    .join(", ");
}

export function renderCursorAuditScopeHeader(scope: CursorAuditScope): string {
  return [
    "## Cursor Audit Scope",
    "",
    `- dataset_status: \`${scope.status}\``,
    `- stable allowlist: \`${scope.stableAllowlist.join(" ")}\``,
    `- stale exclusions: families \`${scope.staleExcludedFamilies.join(" ")}\`; affected glyphs \`${scope.staleExcludedGlyphs.join(" ")}\``,
    `- graph-incomplete exclusions: families \`${scope.graphIncompleteFamilies.join(" ")}\`; affected glyphs \`${scope.graphIncompleteGlyphs.join(" ")}\``,
    `- scoped words: ${formatWords(scope.words)}`,
    `- stale-contaminated words: ${formatWordMatches(scope.staleWords, "staleMatches")}`,
    `- blocked-by-\`ט\` words: ${formatWordMatches(scope.blockedWords, "graphIncompleteMatches")}`
  ].join("\n");
}
