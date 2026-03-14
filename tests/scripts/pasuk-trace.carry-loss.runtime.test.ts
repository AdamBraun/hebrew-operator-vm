import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runPasukTrace } from "@ref/scripts/pasukTrace/runtime";
import { parseArgs, runPasukTraceCorpus } from "@ref/scripts/pasukTraceCorpus/runtime";

function sortEdges(edges: Iterable<string>): string[] {
  return [...new Set(edges)].sort();
}

function collectDeepTraceCarry(
  trace: Array<{ phases?: Array<{ snapshot?: { carry?: string[] } }> }>
): string[] {
  const out = new Set<string>();
  for (const entry of trace) {
    for (const phase of entry.phases ?? []) {
      for (const edge of phase.snapshot?.carry ?? []) {
        out.add(edge);
      }
    }
  }
  return sortEdges(out);
}

function collectDotCarry(dotText: string): string[] {
  const out = new Set<string>();
  const edgePattern = /^\s*"([^"]+)"\s*->\s*"([^"]+)"\s*\[[^\]]*xlabel="carry"[^\]]*\]/u;
  for (const line of dotText.split(/\r?\n/gu)) {
    const match = line.match(edgePattern);
    if (match) {
      out.add(`${match[1]}->${match[2]}`);
    }
  }
  return sortEdges(out);
}

function formatCarryLayers(layers: Record<string, string[]>): string {
  return JSON.stringify(layers, null, 2);
}

function diffEdges(expected: string[], actual: string[]): { missing: string[]; extra: string[] } {
  return {
    missing: expected.filter((edge) => !actual.includes(edge)),
    extra: actual.filter((edge) => !expected.includes(edge))
  };
}

type CarryLayers = {
  deep_trace: string[];
  final_in_memory: string[];
  trace_json: string[];
  graph_dot: string[];
};

function assertCarryLayersEqual(label: string, layers: CarryLayers, expectedEdges: string[]): void {
  const mismatches = Object.entries(layers)
    .map(([layer, edges]) => ({
      layer,
      ...diffEdges(expectedEdges, edges)
    }))
    .filter(({ missing, extra }) => missing.length > 0 || extra.length > 0);

  if (mismatches.length > 0) {
    throw new Error(
      [
        `${label} carry layers diverged`,
        `expected_edges: ${JSON.stringify(expectedEdges)}`,
        `layer_mismatches: ${JSON.stringify(mismatches, null, 2)}`,
        `carry_layers: ${formatCarryLayers(layers)}`
      ].join("\n")
    );
  }
}

async function runOneLetterCarryLayers(letter: string): Promise<CarryLayers> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-carry-loss-"));
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
                verses: [{ n: 1, he: letter }]
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

  const runtimeResult = await runPasukTrace({
    input: inputPath,
    ref: "Genesis/1/1",
    text: "",
    lang: "he",
    normalizeFinals: false,
    keepTeamim: false,
    allowRuntimeErrors: false,
    includeSnapshots: true,
    outJson: path.join(tmpDir, "trace.json"),
    outReport: path.join(tmpDir, "trace.txt"),
    printReport: false
  });

  const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

  await runPasukTraceCorpus(
    parseArgs([`--input=${inputPath}`, `--out-dir=${outDir}`, "--limit=1", "--no-print-progress"]),
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
    final_state?: { carry?: string[] };
  };

  return {
    deep_trace: collectDeepTraceCarry(runtimeResult.trace),
    final_in_memory: sortEdges(runtimeResult.final_state.carry ?? []),
    trace_json: sortEdges(tracePayload.final_state?.carry ?? []),
    graph_dot: collectDotCarry(dotText)
  };
}

describe("pasuk trace carry serialization controls", () => {
  it("keeps a live carry visible through graph.dot on a one-letter nun input", async () => {
    const layers = await runOneLetterCarryLayers("נ");
    const expectedCarry = ["C:1:1->נ:1:1"];

    assertCarryLayersEqual("one-letter נ", layers, expectedCarry);
    expect(layers).toEqual({
      deep_trace: expectedCarry,
      final_in_memory: expectedCarry,
      trace_json: expectedCarry,
      graph_dot: expectedCarry
    });
  });

  it("keeps a direct-support final nun carry-free across deep trace, final state, trace.json, and graph.dot", async () => {
    const layers = await runOneLetterCarryLayers("ן");

    const phantomCarryLayers = Object.entries(layers)
      .filter(([, edges]) => edges.length > 0)
      .map(([layer, edges]) => ({ layer, edges }));
    if (phantomCarryLayers.length > 0) {
      throw new Error(
        [
          "direct-support letter emitted phantom carry",
          `letter: ן`,
          `phantom_carry_layers: ${JSON.stringify(phantomCarryLayers, null, 2)}`,
          `carry_layers: ${formatCarryLayers(layers)}`
        ].join("\n")
      );
    }

    expect(layers).toEqual({
      deep_trace: [],
      final_in_memory: [],
      trace_json: [],
      graph_dot: []
    });
  });
});
