import { describe, expect, it } from "vitest";
import {
  buildArtifacts,
  parseArgs,
  parseInputRecords,
  type ExtractTokenRegistryOptions
} from "@ref/scripts/extractTokenRegistry/runtime";

const DEFAULT_OPTS: ExtractTokenRegistryOptions = {
  input: "/tmp/torah.normalized.txt",
  registryOut: "/tmp/tokens.registry.json",
  signaturesOut: "/tmp/tokens.signatures.txt",
  reportOut: "/tmp/token_registry_report.md",
  top: 100
};

describe("extract token registry runtime", () => {
  it("parses command/options and validates --top", () => {
    const parsed = parseArgs([
      "verify",
      "--input=/tmp/in.txt",
      "--registry-out=/tmp/registry.json",
      "--signatures-out=/tmp/signatures.txt",
      "--report-out=/tmp/report.md",
      "--top=12"
    ]);

    expect(parsed.command).toBe("verify");
    expect(parsed.opts).toEqual({
      input: "/tmp/in.txt",
      registryOut: "/tmp/registry.json",
      signaturesOut: "/tmp/signatures.txt",
      reportOut: "/tmp/report.md",
      top: 12
    });

    expect(() => parseArgs(["--top=0"])).toThrow("Invalid --top value '0'");
  });

  it("parses mixed line formats into records", () => {
    const records = parseInputRecords(["Genesis 1:1\tאב", "", "ג", ""].join("\n"));

    expect(records).toEqual([
      { ref: "Genesis 1:1", lineNumber: 1, text: "אב" },
      { ref: "line:3", lineNumber: 3, text: "ג" }
    ]);
  });

  it("builds deterministic artifacts for stable token assignment", () => {
    const input = [
      "Genesis 1:1\tשִׂיר בָּרָא",
      "Genesis 1:2\tהּ וּ אֳ מָֽיִם׃",
      "Genesis 1:3\tא־ב",
      ""
    ].join("\n");

    const first = buildArtifacts(input, DEFAULT_OPTS, "/tmp/input.txt");
    const second = buildArtifacts(input, DEFAULT_OPTS, "/tmp/input.txt");

    expect(second.registryJson).toBe(first.registryJson);
    expect(second.signaturesText).toBe(first.signaturesText);
    expect(second.reportText).toBe(first.reportText);

    const registry = JSON.parse(first.registryJson) as {
      stats: { clusters_scanned: number; clusters_mapped: number; distinct_signatures: number };
    };

    expect(registry.stats.clusters_mapped).toBe(registry.stats.clusters_scanned);
    expect(registry.stats.distinct_signatures).toBeGreaterThan(0);
    expect(first.signaturesText).toContain("BASE=ש|MARKS=U+05B4,U+05C2");
  });

  it("fails loudly for unsupported combining marks", () => {
    expect(() => buildArtifacts("Genesis 1:1\tא\u0301\n", DEFAULT_OPTS, "/tmp/input.txt")).toThrow(
      /Unsupported combining mark U\+0301/
    );
  });
});
