import path from "node:path";

function sortRefLike(left: string, right: string): number {
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

function toPortablePath(value: string): string {
  return String(value).split(path.sep).join("/");
}

export function workspaceRelativePath(absPath: string): string {
  const resolved = path.resolve(absPath);
  const rel = path.relative(process.cwd(), resolved);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return toPortablePath(rel);
  }
  return toPortablePath(resolved);
}

export function totalFromCounts(byCode: Record<string, number> | undefined | null): number {
  return Object.values(byCode ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

export function formatWarningCounts(byCode: Record<string, number> | undefined | null): string {
  const entries = Object.entries(byCode ?? {}).filter(([, count]) => Number(count) > 0);
  if (entries.length === 0) {
    return "none";
  }
  return entries
    .sort((left, right) => sortRefLike(left[0], right[0]))
    .map(([code, count]) => `${code} x${count}`)
    .join(", ");
}

export function summarizeSemanticVersions(versions: string[] | undefined | null): string {
  if (!versions || versions.length === 0) {
    return "unknown";
  }
  if (versions.length === 1) {
    return versions[0];
  }
  return versions.join(", ");
}

export type PrettyRefRow = {
  key?: string;
  ref?: {
    book?: string;
    chapter?: string | number;
    verse?: string | number;
    token_index?: string | number;
    word_index_in_verse?: string | number;
    word_index?: string | number;
    index?: string | number;
  } | null;
};

export function prettyRef(row: PrettyRefRow | undefined | null): string {
  if (!row?.ref || typeof row.ref !== "object") {
    return row?.key ?? "unknown";
  }
  const chapter = row.ref.chapter ?? "?";
  const verse = row.ref.verse ?? "?";
  const tokenIndex =
    row.ref.token_index ??
    row.ref.word_index_in_verse ??
    row.ref.word_index ??
    row.ref.index ??
    "?";
  return `${row.ref.book} ${chapter}:${verse} (word ${tokenIndex})`;
}

export function markdownSafe(value: unknown): string {
  return String(value).replace(/\|/g, "\\|");
}
