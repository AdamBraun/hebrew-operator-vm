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

describe("pasuk trace carry loss reproduction", () => {
  it("reproduces graph serialization dropping live carry on a one-letter nun input", async () => {
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
      final_state?: { carry?: string[] };
    };

    const deepTraceCarry = collectDeepTraceCarry(runtimeResult.trace);
    const finalInMemoryCarry = sortEdges(runtimeResult.final_state.carry ?? []);
    const traceJsonCarry = sortEdges(tracePayload.final_state?.carry ?? []);
    const graphDotCarry = collectDotCarry(dotText);

    const layers = {
      deep_trace: deepTraceCarry,
      final_in_memory: finalInMemoryCarry,
      trace_json: traceJsonCarry,
      graph_dot: graphDotCarry
    };

    expect(deepTraceCarry).toEqual(["C:1:1->נ:1:1"]);
    expect(finalInMemoryCarry).toEqual(["C:1:1->נ:1:1"]);
    expect(traceJsonCarry).toEqual(["C:1:1->נ:1:1"]);

    const missingFromGraphDot = deepTraceCarry.filter((edge) => !graphDotCarry.includes(edge));
    if (missingFromGraphDot.length > 0) {
      throw new Error(
        [
          "carry lost before/during graph.dot serialization",
          `missing_from_graph_dot: ${JSON.stringify(missingFromGraphDot)}`,
          `carry_layers: ${formatCarryLayers(layers)}`
        ].join("\n")
      );
    }

    expect(graphDotCarry).toEqual(["C:1:1->נ:1:1"]);
  });
});
