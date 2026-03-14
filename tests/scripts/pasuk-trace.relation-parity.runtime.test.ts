import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, runPasukTraceCorpus } from "@ref/scripts/pasukTraceCorpus/runtime";

type RelationName = "cont" | "carry" | "supp" | "head_of" | "sub";

const RELATION_NAMES: RelationName[] = ["cont", "carry", "supp", "head_of", "sub"];

function sortEdges(edges: Iterable<string>): string[] {
  return [...new Set(edges)].sort();
}

function collectJsonRelations(finalState: Record<string, unknown>): Record<RelationName, string[]> {
  return Object.fromEntries(
    RELATION_NAMES.map((name) => [
      name,
      sortEdges((finalState[name] as string[] | undefined) ?? [])
    ])
  ) as Record<RelationName, string[]>;
}

function collectDotRelations(dotText: string): Record<RelationName, string[]> {
  const relationSets = Object.fromEntries(
    RELATION_NAMES.map((name) => [name, new Set<string>()])
  ) as Record<RelationName, Set<string>>;
  const edgePattern = /^\s*"([^"]+)"\s*->\s*"([^"]+)"\s*\[[^\]]*xlabel="([^"]+)"[^\]]*\]/u;

  for (const line of dotText.split(/\r?\n/gu)) {
    const match = line.match(edgePattern);
    if (!match) {
      continue;
    }
    const [, from, to, label] = match;
    if (!RELATION_NAMES.includes(label as RelationName)) {
      continue;
    }
    relationSets[label as RelationName].add(`${from}->${to}`);
  }

  return Object.fromEntries(
    RELATION_NAMES.map((name) => [name, sortEdges(relationSets[name])])
  ) as Record<RelationName, string[]>;
}

function collectMissingRelations(
  jsonRelations: Record<RelationName, string[]>,
  dotRelations: Record<RelationName, string[]>
): Record<RelationName, string[]> {
  return Object.fromEntries(
    RELATION_NAMES.map((name) => [
      name,
      jsonRelations[name].filter((edge) => !dotRelations[name].includes(edge))
    ])
  ) as Record<RelationName, string[]>;
}

describe("pasuk trace JSON vs DOT relation parity", () => {
  it("keeps live-carry relations present in graph.dot whenever they exist in trace.json", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-relation-parity-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "out");

    await fs.writeFile(
      inputPath,
      JSON.stringify(
        {
          books: [
            {
              name: "Genesis",
              chapters: [
                {
                  n: 1,
                  verses: [{ n: 1, he: "נ" }]
                }
              ]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-print-progress"
      ]),
      {
        renderDotFromTraceJson,
        traceExecutionMode: "in-process"
      }
    );

    const traceJsonPath = path.join(outDir, "refs", "genesis", "001", "001", "trace.json");
    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");
    const [traceJsonText, dotText] = await Promise.all([
      fs.readFile(traceJsonPath, "utf8"),
      fs.readFile(dotPath, "utf8")
    ]);

    const tracePayload = JSON.parse(traceJsonText) as {
      final_state?: Record<string, unknown>;
    };
    const jsonRelations = collectJsonRelations(tracePayload.final_state ?? {});
    const dotRelations = collectDotRelations(dotText);
    const missingRelations = collectMissingRelations(jsonRelations, dotRelations);

    expect(jsonRelations).toEqual({
      cont: ["C:1:1->נ:1:1"],
      carry: ["C:1:1->נ:1:1"],
      supp: ["נ:1:1->C:1:1"],
      head_of: [],
      sub: []
    });

    const anyMissing = RELATION_NAMES.some((name) => missingRelations[name].length > 0);
    if (anyMissing) {
      throw new Error(
        [
          "graph.dot is missing relations that exist in trace.json",
          `missing_relations: ${JSON.stringify(missingRelations, null, 2)}`,
          `json_relations: ${JSON.stringify(jsonRelations, null, 2)}`,
          `dot_relations: ${JSON.stringify(dotRelations, null, 2)}`
        ].join("\n")
      );
    }

    expect(missingRelations).toEqual({
      cont: [],
      carry: [],
      supp: [],
      head_of: [],
      sub: []
    });
  });
});
