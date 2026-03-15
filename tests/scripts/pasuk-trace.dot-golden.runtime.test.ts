import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, runPasukTraceCorpus } from "@ref/scripts/pasukTraceCorpus/runtime";

const FIXTURE_PATH = path.resolve(process.cwd(), "tests", "fixtures", "nun.live-carry.graph.dot");

function normalizeDotForGolden(dotText: string): string {
  const normalized = dotText.replace(/\r\n?/gu, "\n");
  const digraphStart = normalized.indexOf("digraph ");
  if (digraphStart < 0) {
    throw new Error(`DOT output did not contain a digraph body.\n${normalized}`);
  }
  const body = normalized.slice(digraphStart);
  return body.endsWith("\n") ? body : `${body}\n`;
}

describe("pasuk trace DOT golden", () => {
  it("matches the committed live-carry DOT for one-letter nun", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-dot-golden-"));
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

    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");
    const [actualDotText, expectedDotText] = await Promise.all([
      fs.readFile(dotPath, "utf8"),
      fs.readFile(FIXTURE_PATH, "utf8")
    ]);

    const actualDot = normalizeDotForGolden(actualDotText);
    const expectedDot = normalizeDotForGolden(expectedDotText);
    const liveCarryEdge = '"C:1:1" -> "נ:1:1" [xlabel="carry"];';

    expect(expectedDot).toContain(liveCarryEdge);
    expect(actualDot).toContain(liveCarryEdge);
    expect(actualDot).toBe(expectedDot);
  });
});
