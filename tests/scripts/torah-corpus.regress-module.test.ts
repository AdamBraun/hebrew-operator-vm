import { describe, expect, it } from "vitest";
import { buildCuratedGoldens, buildRegressionReport } from "@ref/scripts/torahCorpus/regress";

describe("torah corpus regress module", () => {
  it("builds curated goldens from delta groups and row families", () => {
    const runRows = [
      {
        key: "Genesis/1/1/1",
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
        surface: "הּ",
        skeleton: ["HE.DECLARE_PIN"]
      },
      {
        key: "Genesis/1/1/2",
        ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
        surface: "אב",
        skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"]
      }
    ];
    const runMap = new Map(runRows.map((row) => [row.key, row]));
    const cases = buildCuratedGoldens({
      runRows,
      runMap,
      groupedDeltas: [{ signature: "REPLACE:A->B", sample_keys: ["Genesis/1/1/2"] }],
      changedSkeletonRows: [{ key: "Genesis/1/1/1" }],
      goldenLimit: 5
    });

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.map((entry) => entry.key)).toContain("Genesis/1/1/2");
  });

  it("renders regression report with failure details", () => {
    const lines = buildRegressionReport({
      runB: {
        trace_path: `${process.cwd()}/corpus/word_traces.jsonl`,
        semantic_versions: ["1.0.0"]
      },
      compileB: {
        path: `${process.cwd()}/data/tokens.compiled.json`,
        warning_count: 1,
        warning_by_code: { WARN_A: 1 }
      },
      goldensPath: `${process.cwd()}/tests/goldens.json`,
      regressionPasses: ["Genesis/1/1/1"],
      regressionFailures: [
        {
          key: "Genesis/1/1/2",
          surface: "אב",
          ref: "Genesis 1:1 (word 2)",
          reason: "skeleton mismatch",
          expected_skeleton: ["ALEPH.ALIAS"],
          actual_skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
          delta_summary: "Inserted TAV.FINALIZE"
        }
      ]
    });

    const text = lines.join("\n");
    expect(text).toContain("## Result");
    expect(text).toContain("- FAIL");
    expect(text).toContain("Inserted TAV.FINALIZE");
  });
});
