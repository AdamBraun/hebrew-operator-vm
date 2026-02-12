import { describe, expect, it } from "vitest";
import {
  assertExecuteTokenSources,
  buildVerseWordRowsMeta,
  resolveExecutePaths,
  resolveSemanticVersion
} from "@ref/scripts/torahCorpus/execute";

describe("torah corpus execute module helpers", () => {
  it("resolves execute paths to absolute paths", () => {
    const paths = resolveExecutePaths({
      input: "data/torah.json",
      tokenRegistry: "data/tokens.registry.json",
      compiledBundles: "data/tokens.compiled.json",
      traceOut: "corpus/word_traces.jsonl",
      flowsOut: "corpus/word_flows.txt",
      reportOut: "reports/execution_report.md",
      verseTraceOut: "corpus/verse_traces.jsonl",
      verseReportOut: "reports/verse_execution_report.md",
      verseMotifIndexOut: "index/verse_motif_index.json"
    });
    expect(paths.inputPath.endsWith("/data/torah.json")).toBe(true);
    expect(paths.verseMotifIndexOutPath.endsWith("/index/verse_motif_index.json")).toBe(true);
  });

  it("resolves semantic version with fallback order", () => {
    expect(resolveSemanticVersion("2.0.0", { semantics: { semver: "1.0.0" } }, { semver: "0.9.0" })).toBe(
      "2.0.0"
    );
    expect(resolveSemanticVersion("", { semantics: { semver: "1.0.0" } }, { semver: "0.9.0" })).toBe(
      "1.0.0"
    );
    expect(resolveSemanticVersion("", {}, { semver: "0.9.0" })).toBe("0.9.0");
  });

  it("validates token sources", () => {
    expect(() =>
      assertExecuteTokenSources({
        tokenIdBySignatureSize: 0,
        compiledTokenCount: 1,
        tokenRegistryPath: "/tmp/a",
        compiledBundlesPath: "/tmp/b"
      })
    ).toThrow(/No tokens loaded/);
    expect(() =>
      assertExecuteTokenSources({
        tokenIdBySignatureSize: 1,
        compiledTokenCount: 0,
        tokenRegistryPath: "/tmp/a",
        compiledBundlesPath: "/tmp/b"
      })
    ).toThrow(/No compiled bundles/);
  });

  it("builds per-verse word rows and tracks missing/unknown tokens", () => {
    const result = buildVerseWordRowsMeta({
      verseEntry: {
        ref: { book: "Genesis", chapter: 1, verse: 1 },
        words: ["אב", "גד"]
      },
      tokenize: () => [],
      tokenIdBySignature: new Map([["known", 1]]),
      compiledTokenIdSet: new Set(["1"]),
      buildRefKey: (ref) => `${ref.book}/${ref.chapter}/${ref.verse}/${ref.token_index}`,
      resolveWordTokenIds: ({ surface }) =>
        surface === "אב"
          ? { token_ids: [1], unknown_signatures: [], missing_bundle_ids: [] }
          : { token_ids: [2], unknown_signatures: ["unknown"], missing_bundle_ids: [2] }
    });

    expect(result.wordRowsMeta).toHaveLength(2);
    expect(result.missingBundles).toHaveLength(1);
    expect(result.unknownSignatures).toHaveLength(1);
  });
});
