import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATOMIC_EVENTS_JSONL_FILE,
  ATOMIC_EVENTS_TEXT_FILE,
  buildAtomicArtifactsFromTraceJsonl,
  parseArgs,
  runAtomicRender
} from "@ref/scripts/renderAtomic/runtime";

const VALID_WORD_TRACE_FIXTURE = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "trace-schema",
  "valid.word-trace.json"
);

describe("render atomic runtime", () => {
  it("parses required options", () => {
    const parsed = parseArgs(["--trace=/tmp/word-traces.jsonl", "--out=/tmp/out"]);
    expect(parsed).toEqual({
      trace: "/tmp/word-traces.jsonl",
      outDir: "/tmp/out"
    });

    expect(() => parseArgs(["--nope"])).toThrow("Unknown argument '--nope'");
  });

  it("builds deterministic anchored atomic artifacts from canonical trace JSONL", () => {
    const fixtureJson = JSON.stringify(
      JSON.parse(fs.readFileSync(VALID_WORD_TRACE_FIXTURE, "utf8")) as Record<string, unknown>
    );
    const jsonl = `${fixtureJson}\n`;

    const first = buildAtomicArtifactsFromTraceJsonl(jsonl, "fixture.jsonl");
    const second = buildAtomicArtifactsFromTraceJsonl(jsonl, "fixture.jsonl");

    expect(second.atomicEventsText).toBe(first.atomicEventsText);
    expect(second.atomicEventsJsonl).toBe(first.atomicEventsJsonl);
    expect(first.words).toBe(1);
    expect(first.events).toBe(4);
    expect(first.atomicEventsText).toContain(
      "Genesis/1/1/2\t2\t0\texport handle rosh kind=RESH.BOUNDARY_CLOSE"
    );
  });

  it("writes atomic outputs end-to-end", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-atomic-test-"));
    const tracePath = path.join(tmpDir, "word_traces.jsonl");
    const outDir = path.join(tmpDir, "out");
    const fixtureJson = JSON.stringify(
      JSON.parse(fs.readFileSync(VALID_WORD_TRACE_FIXTURE, "utf8")) as Record<string, unknown>
    );
    fs.writeFileSync(tracePath, `${fixtureJson}\n`);

    const result = await runAtomicRender({
      trace: tracePath,
      outDir
    });

    const textOut = path.join(outDir, ATOMIC_EVENTS_TEXT_FILE);
    const jsonlOut = path.join(outDir, ATOMIC_EVENTS_JSONL_FILE);

    expect(result.words).toBe(1);
    expect(result.events).toBe(4);
    expect(fs.existsSync(textOut)).toBe(true);
    expect(fs.existsSync(jsonlOut)).toBe(true);
    expect(fs.readFileSync(textOut, "utf8")).toBe(result.atomicEventsText);
    expect(fs.readFileSync(jsonlOut, "utf8")).toBe(result.atomicEventsJsonl);
  });
});
