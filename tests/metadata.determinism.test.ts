import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMetadataPlan,
  DEFAULT_METADATA_DATASET_PATH
} from "../src/layers/metadata/buildMetadataPlan";
import { extractRefOrder } from "../src/layers/metadata/extractRefOrder";

const PROJECT_ROOT = process.cwd();
const IMPORT_RE = /(?:import|export)\s+(?:[^"'`]*?\sfrom\s+)?["'`]([^"'`]+)["'`]/gu;

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  return null;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function loadDataset(): unknown {
  return JSON.parse(fs.readFileSync(DEFAULT_METADATA_DATASET_PATH, "utf8")) as unknown;
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function tryResolveLocalModule(baseFilePath: string, specifier: string): string | null {
  const fromDir = path.dirname(baseFilePath);
  const resolvedBase = path.resolve(fromDir, specifier);
  const candidates = [
    resolvedBase,
    `${resolvedBase}.ts`,
    `${resolvedBase}.tsx`,
    `${resolvedBase}.js`,
    `${resolvedBase}.mjs`,
    `${resolvedBase}.cjs`,
    `${resolvedBase}.json`,
    path.join(resolvedBase, "index.ts"),
    path.join(resolvedBase, "index.tsx"),
    path.join(resolvedBase, "index.js"),
    path.join(resolvedBase, "index.mjs"),
    path.join(resolvedBase, "index.cjs")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.resolve(candidate);
    }
  }
  return null;
}

function extractLocalImports(filePath: string): string[] {
  const text = fs.readFileSync(filePath, "utf8");
  const out: string[] = [];
  let match = IMPORT_RE.exec(text);

  while (match) {
    const specifier = match[1] ?? "";
    if (!specifier.startsWith(".")) {
      match = IMPORT_RE.exec(text);
      continue;
    }
    const resolved = tryResolveLocalModule(filePath, specifier);
    if (resolved) {
      out.push(resolved);
    }
    match = IMPORT_RE.exec(text);
  }

  return out;
}

function collectImportGraph(entryFilePaths: readonly string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...entryFilePaths.map((entry) => path.resolve(entry))];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const imported of extractLocalImports(current)) {
      if (!visited.has(imported)) {
        queue.push(imported);
      }
    }
  }

  return visited;
}

describe("metadata determinism + isolation", () => {
  it("produces byte-identical JSON for identical inputs across runs", async () => {
    const dataset = loadDataset();
    const refOrder = await extractRefOrder();
    const generatedAt = "2026-03-03T00:00:00.000Z";

    const runA = await buildMetadataPlan({
      dataset,
      refOrder,
      generatedAt
    });
    const runB = await buildMetadataPlan({
      dataset,
      refOrder,
      generatedAt
    });

    expect(canonicalJson(runA)).toBe(canonicalJson(runB));
  });

  it("keeps metadata builder import graph isolated from VM/engine modules", () => {
    const entryFiles = [
      path.resolve(PROJECT_ROOT, "src", "layers", "metadata", "buildMetadataPlan.ts"),
      path.resolve(PROJECT_ROOT, "src", "cli", "build-layer-metadata.ts")
    ];
    const graph = collectImportGraph(entryFiles);
    const graphPaths = [...graph].map((filePath) => normalizeFilePath(filePath));
    const forbiddenSubpaths = [
      "/src/core/",
      "/src/reference/core/",
      "/src/wrapper/",
      "/src/layers/letters/",
      "/src/layers/niqqud/",
      "/src/layers/cantillation/",
      "/src/layers/layout/"
    ];

    for (const filePath of graphPaths) {
      for (const forbidden of forbiddenSubpaths) {
        expect(filePath.includes(forbidden)).toBe(false);
      }
    }
  });
});
