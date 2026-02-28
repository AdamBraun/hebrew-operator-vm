import fs from "node:fs/promises";
import path from "node:path";

export type PerVerseJoinPayload = {
  verseBoundary?: Record<string, unknown>;
  traceMeta?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function resolvePerVerseOutputPath(outputPath: string, workspaceRoot: string): string {
  const base = workspaceRoot ? path.resolve(workspaceRoot) : process.cwd();
  if (path.isAbsolute(outputPath)) {
    return path.resolve(outputPath);
  }
  return path.resolve(base, outputPath);
}

export async function loadPerVersePayload(
  outputPath: string,
  workspaceRoot: string
): Promise<PerVerseJoinPayload> {
  const resolved = resolvePerVerseOutputPath(outputPath, workspaceRoot);
  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read per-verse payload ${resolved}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in per-verse payload ${resolved}: ${message}`);
  }

  const root = asObject(parsed);
  if (!root) {
    throw new Error(`Invalid per-verse payload ${resolved}: expected top-level object.`);
  }

  return {
    verseBoundary: asObject(root.verseBoundary),
    traceMeta: asObject(root.traceMeta ?? root.trace_meta),
    provenance: asObject(root.provenance)
  };
}
