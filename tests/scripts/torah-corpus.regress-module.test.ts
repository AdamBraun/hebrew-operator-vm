import { describe, expect, it } from "vitest";
import {
  buildCuratedGoldens,
  compareRegressRuns,
  evaluateGoldenCases,
  buildRegressionReport,
  buildRegressDiffLines
} from "@ref/scripts/torahCorpus/regress";

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
        semantics_versions: ["1.0.0"]
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

  it("renders regress diff report narrative sections", () => {
    const lines = buildRegressDiffLines({
      runA: {
        trace_path: `${process.cwd()}/outputs/a/word_traces.jsonl`,
        trace_sha256: "a".repeat(64),
        semantics_versions: ["1.0.0"],
        rows: [{}],
        map: new Map([
          [
            "Genesis/1/1/1",
            {
              key: "Genesis/1/1/1",
              ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
              surface: "אב",
              flow: "a",
              skeleton: ["ALEPH.ALIAS"],
              semantics_version: "1.0.0"
            }
          ]
        ])
      },
      runB: {
        trace_path: `${process.cwd()}/outputs/b/word_traces.jsonl`,
        trace_sha256: "b".repeat(64),
        semantics_versions: ["1.1.0"],
        rows: [{}],
        map: new Map([
          [
            "Genesis/1/1/1",
            {
              key: "Genesis/1/1/1",
              ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
              surface: "אב",
              flow: "b",
              skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
              semantics_version: "1.1.0"
            }
          ]
        ])
      },
      compileA: {
        path: `${process.cwd()}/data/a.json`,
        registry_sha256: "a1",
        warning_count: 0,
        warning_by_code: {}
      },
      compileB: {
        path: `${process.cwd()}/data/b.json`,
        registry_sha256: "b1",
        warning_count: 1,
        warning_by_code: { WARN_A: 1 }
      },
      addedKeys: [],
      removedKeys: [],
      skeletonChanges: [
        {
          key: "Genesis/1/1/1",
          row_a: {
            key: "Genesis/1/1/1",
            ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
            surface: "אב",
            flow: "a",
            skeleton: ["ALEPH.ALIAS"],
            semantics_version: "1.0.0"
          },
          row_b: {
            key: "Genesis/1/1/1",
            ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
            surface: "אב",
            flow: "b",
            skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
            semantics_version: "1.1.0"
          },
          delta: { summary: "Inserted TAV.FINALIZE" },
          semantic_reason: "semantics_version 1.0.0 -> 1.1.0",
          warning_reason: "compile warnings unchanged (none)"
        }
      ],
      renderingChanges: [],
      topGroupedDeltas: [
        {
          count: 1,
          change_type: "event_added",
          signature: "ADD:TAV.FINALIZE",
          summary: "Inserted TAV.FINALIZE",
          sample_keys: ["Genesis/1/1/1"]
        }
      ]
    });

    const text = lines.join("\n");
    expect(text).toContain("## Top Skeleton Delta Groups");
    expect(text).toContain("## Most Interesting Samples");
    expect(text).toContain("ADD:TAV.FINALIZE");
  });

  it("compares runs into skeleton/rendering/ingestion buckets", () => {
    const result = compareRegressRuns({
      runA: {
        trace_path: "a",
        trace_sha256: "a",
        semantics_versions: ["1.0.0"],
        rows: [{}],
        map: new Map([
          [
            "Genesis/1/1/1",
            {
              key: "Genesis/1/1/1",
              ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
              surface: "אב",
              flow: "a",
              skeleton: ["ALEPH.ALIAS"],
              semantics_version: "1.0.0"
            }
          ]
        ])
      },
      runB: {
        trace_path: "b",
        trace_sha256: "b",
        semantics_versions: ["1.1.0"],
        rows: [{}, {}],
        map: new Map([
          [
            "Genesis/1/1/1",
            {
              key: "Genesis/1/1/1",
              ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
              surface: "אב",
              flow: "b",
              skeleton: ["ALEPH.ALIAS", "TAV.FINALIZE"],
              semantics_version: "1.1.0"
            }
          ],
          [
            "Genesis/1/1/2",
            {
              key: "Genesis/1/1/2",
              ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 2 },
              surface: "גד",
              flow: "c",
              skeleton: ["GIMEL.BESTOW"],
              semantics_version: "1.1.0"
            }
          ]
        ])
      },
      compileA: {},
      compileB: {},
      sortRefLike: (left, right) => left.localeCompare(right, "en", { numeric: true }),
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      classifySkeletonDelta: (left, right) => ({
        change_type: "event_added",
        signature: `${left.join("|")}=>${right.join("|")}`,
        summary: "changed"
      }),
      wordWarningSummary: () => ({ by_code: {} }),
      warningDeltaText: () => "warnings unchanged"
    });

    expect(result.addedKeys).toEqual(["Genesis/1/1/2"]);
    expect(result.skeletonChanges).toHaveLength(1);
    expect(result.topGroupedDeltas).toHaveLength(1);
  });

  it("evaluates golden cases into passes/failures", () => {
    const result = evaluateGoldenCases({
      goldenCases: [
        {
          key: "Genesis/1/1/1",
          surface: "אב",
          expected_skeleton: ["ALEPH.ALIAS"]
        },
        {
          key: "Genesis/1/1/2",
          surface: "גד",
          expected_skeleton: ["GIMEL.BESTOW"]
        }
      ],
      runBMap: new Map([
        [
          "Genesis/1/1/1",
          {
            key: "Genesis/1/1/1",
            ref: { book: "Genesis", chapter: 1, verse: 1, token_index: 1 },
            surface: "אב",
            flow: "x",
            skeleton: ["ALEPH.ALIAS"],
            semantics_version: "1.0.0"
          }
        ]
      ]),
      arraysEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      classifySkeletonDelta: () => ({ summary: "delta" })
    });

    expect(result.regressionPasses).toEqual(["Genesis/1/1/1"]);
    expect(result.regressionFailures).toHaveLength(1);
    expect(result.regressionFailures[0].reason).toBe("missing key in run B");
  });
});
