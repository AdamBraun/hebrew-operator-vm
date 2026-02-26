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

function expectedGraphOptsHash(
  args: {
    boundary?: "auto" | "cluster" | "node" | "both";
    layout?: "plain" | "boot";
    prettyIds?: boolean;
  } = {}
): string {
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

function parseDotNodeIds(dotText: string): Set<string> {
  const nodeIds = new Set<string>();
  const lines = dotText.replace(/\r\n?/gu, "\n").split("\n");
  for (const line of lines) {
    if (/^\s*\/\//u.test(line)) {
      continue;
    }
    let match = line.match(/^\s*"([^"]+)"\s*\[/u);
    if (match) {
      nodeIds.add(match[1]);
      continue;
    }
    match = line.match(/^\s*"([^"]+)"\s*->\s*"([^"]+)"/u);
    if (match) {
      nodeIds.add(match[1]);
      nodeIds.add(match[2]);
      continue;
    }
    match = line.match(/^\s*"([^"]+)"\s*;\s*$/u);
    if (match) {
      nodeIds.add(match[1]);
    }
  }
  return nodeIds;
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
      "--concurrency=7",
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
    expect(parsed.concurrency).toBe(7);
    expect(parsed.verifyExisting).toBe(true);
    expect(parsed.printProgress).toBe(false);
  });

  it("defaults concurrency to 50", () => {
    const parsed = parseArgs([]);
    expect(parsed.concurrency).toBe(50);
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
                verses: [
                  { n: 1, he: "א" },
                  { n: 2, he: "ב" },
                  { n: 3, he: "ג" }
                ]
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
        rendererIds: TEST_RENDERER_IDS,
        traceExecutionMode: "in-process"
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

    const tracePayload = JSON.parse(traceJsonText) as {
      schema_version?: unknown;
      link_index?: unknown;
      final_state?: {
        handles?: Array<{ id?: unknown }>;
        vm?: {
          H?: unknown;
        };
      };
    };
    const traceFileSha = sha256Text(traceJsonText);
    const dotProv = parseDotProvenance(dotText);
    const reportProv = parseReportProvenance(traceTxt);

    expect(tracePayload.schema_version).toBe(2);
    expect(Array.isArray(tracePayload.link_index)).toBe(true);
    const linkRows = Array.isArray(tracePayload.link_index) ? tracePayload.link_index : [];
    const finalHandleIds = Array.isArray(tracePayload.final_state?.handles)
      ? tracePayload.final_state.handles
          .map((handle) => (typeof handle?.id === "string" ? handle.id : null))
          .filter((id): id is string => id !== null)
      : [];
    expect(linkRows.length).toBe(finalHandleIds.length);
    const linkRowsById = new Map(
      linkRows
        .filter(
          (
            row
          ): row is {
            handle_id: string;
            event_indices: number[];
          } =>
            !!row &&
            typeof row === "object" &&
            typeof (row as { handle_id?: unknown }).handle_id === "string" &&
            Array.isArray((row as { event_indices?: unknown }).event_indices)
        )
        .map((row) => [row.handle_id, row.event_indices])
    );
    const vmEvents = Array.isArray(tracePayload.final_state?.vm?.H)
      ? tracePayload.final_state.vm.H
      : [];
    const dotNodeIds = parseDotNodeIds(dotText);
    const unresolvedDotNodeIds = Array.from(dotNodeIds)
      .filter((nodeId) => finalHandleIds.includes(nodeId))
      .filter((nodeId) => {
        const eventIndices = linkRowsById.get(nodeId) ?? [];
        const validIndices = eventIndices.filter(
          (index) => Number.isInteger(index) && index >= 0 && index < vmEvents.length
        );
        return validIndices.length === 0;
      });
    expect(unresolvedDotNodeIds).toEqual([]);
    expect(dotProv.trace_file_sha256).toBe(traceFileSha);
    expect(dotProv.graph_renderer_id).toBe(TEST_RENDERER_IDS.graphRendererId);
    expect(dotProv.dot_schema).toBe(2);
    expect(dotProv.graph_opts_sha256).toBe(expectedGraphOptsHash());

    expect(reportProv.trace_file_sha256).toBe(traceFileSha);
    expect(reportProv.report_renderer_id).toBe(TEST_RENDERER_IDS.reportRendererId);
    expect(reportProv.report_schema).toBe(2);
  });

  it("full runs reset output before processing to force latest overwrite semantics", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-full-reset-"));
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

    const first = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );
    expect(first.manifest.totals.processed).toBe(1);

    const stalePath = path.join(outDir, "refs", "stale.txt");
    await fs.writeFile(stalePath, "stale", "utf8");

    const second = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );
    expect(second.manifest.totals.processed).toBe(1);
    expect(second.manifest.totals.skipped_existing).toBe(0);
    await expect(fs.stat(stalePath)).rejects.toThrow();
  });

  it("auto-skips unchanged existing artifacts without --skip-existing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-autoskip-"));
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

    const first = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );
    expect(first.manifest.totals.processed).toBe(1);

    const second = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );
    expect(second.manifest.totals.processed).toBe(0);
    expect(second.manifest.totals.skipped_existing).toBe(1);
  });

  it("auto-skips from provenance when refs/index.json is missing", async () => {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "pasuk-trace-corpus-autoskip-provenance-")
    );
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

    const first = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );
    expect(first.manifest.totals.processed).toBe(1);

    const indexPath = path.join(outDir, "refs", "index.json");
    await fs.rm(indexPath);

    const second = await runPasukTraceCorpus(
      parseArgs([
        `--input=${inputPath}`,
        `--out-dir=${outDir}`,
        "--limit=1",
        "--no-snapshots",
        "--no-print-progress"
      ]),
      { renderDotFromTraceJson: fakeRenderDot, rendererIds: TEST_RENDERER_IDS }
    );

    expect(second.manifest.totals.processed).toBe(0);
    expect(second.manifest.totals.skipped_existing).toBe(1);

    const rebuiltIndex = JSON.parse(await fs.readFile(indexPath, "utf8")) as Array<{
      sha256?: { trace_json?: string };
      stats?: { words?: number; trace_entries?: number };
    }>;
    expect(Array.isArray(rebuiltIndex)).toBe(true);
    expect(rebuiltIndex[0]?.sha256?.trace_json).toMatch(/^[0-9a-f]{64}$/u);
    expect((rebuiltIndex[0]?.stats?.words ?? 0) > 0).toBe(true);
    expect((rebuiltIndex[0]?.stats?.trace_entries ?? 0) > 0).toBe(true);
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

  it("repairs legacy schema-1 traces by shimming missing D/F pointers", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-legacy-schema-"));
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
    const traceReportPath = path.join(outDir, "refs", "genesis", "001", "001", "trace.txt");
    const dotPath = path.join(outDir, "refs", "genesis", "001", "001", "graph.dot");
    const legacyOmega = "legacy:omega";
    const legacyWordDomain = "legacy:word-domain";

    const traceRaw = await fs.readFile(traceJsonPath, "utf8");
    const traceObj = JSON.parse(traceRaw) as Record<string, any>;
    traceObj.schema_version = 1;
    if (traceObj.final_dump_state?.vm && typeof traceObj.final_dump_state.vm === "object") {
      traceObj.final_dump_state.vm.Omega = legacyOmega;
      delete traceObj.final_dump_state.vm.D;
      delete traceObj.final_dump_state.vm.F;
    }
    if (traceObj.post_reset_state?.vm && typeof traceObj.post_reset_state.vm === "object") {
      traceObj.post_reset_state.vm.Omega = legacyOmega;
      delete traceObj.post_reset_state.vm.D;
      delete traceObj.post_reset_state.vm.F;
    }
    if (Array.isArray(traceObj.deep_trace)) {
      for (const [index, entry] of traceObj.deep_trace.entries()) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        delete entry.D;
        if (index === 0) {
          entry.Omega = legacyWordDomain;
        }
      }
    }
    if (Array.isArray(traceObj.word_sections)) {
      for (const [index, section] of traceObj.word_sections.entries()) {
        if (!section || typeof section !== "object") {
          continue;
        }
        delete section.incoming_D;
        delete section.incoming_F;
        delete section.outgoing_D;
        delete section.outgoing_F;
        if (Array.isArray(section.op_entries)) {
          for (const [opIndex, opEntry] of section.op_entries.entries()) {
            if (!opEntry || typeof opEntry !== "object") {
              continue;
            }
            delete opEntry.D;
            if (opIndex === 0 && index === 0) {
              opEntry.Omega = legacyWordDomain;
            }
          }
        }
        if (section.exit_boundary && typeof section.exit_boundary === "object") {
          delete section.exit_boundary.D;
          delete section.exit_boundary.F;
        }
      }
    }
    await fs.writeFile(traceJsonPath, `${JSON.stringify(traceObj, null, 2)}\n`, "utf8");
    await fs.rm(traceReportPath);
    await fs.rm(dotPath);

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

    const [repairedReport, repairedDot] = await Promise.all([
      fs.readFile(traceReportPath, "utf8"),
      fs.readFile(dotPath, "utf8")
    ]);

    expect(repairedReport).toContain(`vm.D=${legacyOmega}; vm.F=Ω`);
    expect(repairedReport).toContain(`incoming_D=${legacyWordDomain}`);
    expect(parseReportProvenance(repairedReport).report_schema).toBe(2);
    expect(parseDotProvenance(repairedDot).dot_schema).toBe(2);
  });

  it("fails fast when trace schema is unsupported", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pasuk-trace-corpus-unsupported-"));
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
    const traceRaw = await fs.readFile(traceJsonPath, "utf8");
    const traceObj = JSON.parse(traceRaw) as Record<string, unknown>;
    traceObj.schema_version = 99;
    await fs.writeFile(traceJsonPath, `${JSON.stringify(traceObj, null, 2)}\n`, "utf8");

    await expect(
      runPasukTraceCorpus(
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
      )
    ).rejects.toThrow(/schema_version 99 is unsupported/);
  });
});
