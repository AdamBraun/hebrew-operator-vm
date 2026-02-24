import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRefs,
  parseArgs,
  parseDotProvenance,
  parseReportProvenance,
  runPasukTraceCorpus,
  sha256Text,
  stableStringify
} from "@ref/scripts/pasukTraceCorpus/runtime";

const TEST_RENDERER_IDS = {
  graphRendererId: "test-renderer/graph@1",
  reportRendererId: "test-renderer/report@1"
};

function fakeRenderDot(input: unknown): string {
  const payload = input as { ref_key?: string };
  return `digraph Test {\n  label=${JSON.stringify(String(payload.ref_key ?? "unknown"))};\n}\n`;
}

function expectedGraphOptsHash(args: {
  boundary?: "auto" | "cluster" | "node" | "both";
  layout?: "plain" | "boot";
  prettyIds?: boolean;
} = {}): string {
  const layout = args.layout ?? "boot";
  const opts = {
    theme: "light",
    mode: "full",
    boundary: args.boundary ?? "cluster",
    prune: "orphans",
    pruneKeepKinds: "",
    pruneKeepIds: "",
    layout,
    prettyIds: args.prettyIds ?? true,
    legend: layout === "boot",
    wordsMode: "cluster"
  };
  return sha256Text(stableStringify(opts));
}

describe("pasuk trace corpus runtime", () => {
  it("parses defaults and explicit graph flags", () => {
    const parsed = parseArgs([
      "--input=data/torah.json",
      "--out-dir=outputs/pasuk-trace-corpus/test",
      "--lang=he",
      "--boundary=cluster",
      "--layout=boot",
      "--theme=light",
      "--mode=full",
      "--words=cluster",
      "--verify-existing",
      "--no-print-progress"
    ]);

    expect(parsed.input).toBe("data/torah.json");
    expect(parsed.outDir).toBe("outputs/pasuk-trace-corpus/test");
    expect(parsed.lang).toBe("he");
    expect(parsed.keepTeamim).toBe(true);
    expect(parsed.includeSnapshots).toBe(true);
    expect(parsed.graphBoundary).toBe("cluster");
    expect(parsed.graphLayout).toBe("boot");
    expect(parsed.graphPrettyIds).toBe(true);
    expect(parsed.emitDot).toBe(true);
    expect(parsed.verifyExisting).toBe(true);
    expect(parsed.printProgress).toBe(false);
  });

  it("collects refs with book + ref window filters", async () => {
    const refs = await collectRefs(
      {
        books: [
          {
            name: "Genesis",
            chapters: [
              {
                n: 1,
                verses: [{ n: 1, he: "א" }, { n: 2, he: "ב" }, { n: 3, he: "ג" }]
              }
            ]
          },
          {
            name: "Exodus",
            chapters: [{ n: 1, verses: [{ n: 1, he: "ד" }] }]
          }
        ]
      },
      {
        books: ["Genesis"],
        fromRef: "Genesis/1/2",
        toRef: "Genesis/1/3",
        limit: 0
      }
    );

    expect(refs.map((row) => row.refKey)).toEqual(["Genesis/1/2", "Genesis/1/3"]);
  });

  it("emits provenance headers for dot and report", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-prov-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "out");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [{ n: 1, he: "א ב" }]
            }
          ]
        }
      ]
    };

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    const result = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      {
        renderDotFromTraceJson: fakeRenderDot,
        rendererIds: TEST_RENDERER_IDS
      }
    );

    expect(result.manifest.totals.processed).toBe(1);

    const traceJsonPath = path.join(outDir, "refs", "genesis", "001", "001", "trace.json");
    const traceTxtPath = path.join(outDir, "refs", "genesis", "001", "001", "trace.txt");
    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");

    const [traceJsonText, traceTxt, dotText] = await Promise.all([
      fs.readFile(traceJsonPath, "utf8"),
      fs.readFile(traceTxtPath, "utf8"),
      fs.readFile(dotPath, "utf8")
    ]);

    const traceFileSha = sha256Text(traceJsonText);
    const dotProv = parseDotProvenance(dotText);
    const reportProv = parseReportProvenance(traceTxt);

    expect(dotProv.trace_file_sha256).toBe(traceFileSha);
    expect(dotProv.graph_renderer_id).toBe(TEST_RENDERER_IDS.graphRendererId);
    expect(dotProv.dot_schema).toBe(1);
    expect(dotProv.graph_opts_sha256).toBe(expectedGraphOptsHash());

    expect(reportProv.trace_file_sha256).toBe(traceFileSha);
    expect(reportProv.report_renderer_id).toBe(TEST_RENDERER_IDS.reportRendererId);
    expect(reportProv.report_schema).toBe(1);
  });

  it("fails verify-existing when graph options drift under skip-existing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-verify-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "out");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [{ n: 1, verses: [{ n: 1, he: "א ב" }] }]
        }
      ]
    };
    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--boundary=cluster",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    await expect(
      runPasukTraceCorpus(
        parseArgs([
          `--input=${inputPath}`,
          `--out-dir=${outDir}`,
          "--limit=1",
          "--skip-existing",
          "--verify-existing",
          "--no-snapshots",
          "--boundary=node",
          "--no-print-progress"
        ]),
        { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
      )
    ).rejects.toThrow(/verify-existing failed/);
  });

  it("repairs dot provenance drift under skip-existing --repair-existing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-repair-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "out");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [{ n: 1, verses: [{ n: 1, he: "א ב" }] }]
        }
      ]
    };
    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--boundary=cluster",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");
    const beforeDot = await fs.readFile(dotPath, "utf8");
    const beforeProv = parseDotProvenance(beforeDot);
    expect(beforeProv.graph_opts_sha256).toBe(expectedGraphOptsHash({ boundary: "cluster" }));

    const repaired = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--skip-existing",
        "--repair-existing",
        "--no-snapshots",
        "--boundary=node",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    expect(repaired.manifest.totals.repaired_existing).toBe(1);

    const afterDot = await fs.readFile(dotPath, "utf8");
    const afterProv = parseDotProvenance(afterDot);
    expect(afterProv.graph_opts_sha256).toBe(expectedGraphOptsHash({ boundary: "node" }));
    expect(afterProv.graph_opts_sha256).not.toBe(beforeProv.graph_opts_sha256);
  });

  it("detects trace drift and repair-existing rebinds derived artifacts to new trace hash", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-trace-drift-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "out");

    const payload = {
      books: [
        {
          name: "Genesis",
          chapters: [{ n: 1, verses: [{ n: 1, he: "א ב" }] }]
        }
      ]
    };
    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), "utf8");

    await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    const traceJsonPath = path.join(outDir, "refs", "genesis", "001", "001", "trace.json");
    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");

    const traceRaw = await fs.readFile(traceJsonPath, "utf8");
    const traceObj = JSON.parse(traceRaw) as Record<string, unknown>;
    traceObj.generated_at = "2099-01-01T00:00:00.000Z";
    const driftedTrace = `${JSON.stringify(traceObj, null, 2)}\n`;
    await fs.writeFile(traceJsonPath, driftedTrace, "utf8");

    await expect(
      runPasukTraceCorpus(
        parseArgs([
          `--input=${inputPath}`,
          `--out-dir=${outDir}`,
          "--limit=1",
          "--skip-existing",
          "--verify-existing",
          "--no-snapshots",
          "--no-print-progress"
        ]),
        { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
      )
    ).rejects.toThrow(/verify-existing failed/);

    const repaired = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--skip-existing",
        "--repair-existing",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    expect(repaired.manifest.totals.repaired_existing).toBe(1);

    const repairedDot = await fs.readFile(dotPath, "utf8");
    const dotProv = parseDotProvenance(repairedDot);
    expect(dotProv.trace_file_sha256).toBe(sha256Text(driftedTrace));
  });
});
