import { describe, expect, it } from "vitest";

function findWordCluster(dot: string, label: string): string | null {
  const clusters = dot
    .split("subgraph cluster_word_")
    .slice(1)
    .map((chunk) => `subgraph cluster_word_${chunk}`);
  return clusters.find((cluster) => cluster.includes(`label="${label}";`)) ?? null;
}

describe("pasuk graph renderer", () => {
  it("clusters nodes by word-section ownership (tau) and keeps maqqef sections split", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const tracePayload = {
      ref_key: "Genesis/2/10",
      cleaned_text: "אֶת־הַגָּן וְהָיָה לְאַרְבָּעָה רָאשִׁים",
      word_sections: [
        {
          word_index: 1,
          surface: "אֶת",
          op_entries: [{ tauBefore: 7, tauAfter: 7 }],
          exit_boundary: { mode: "glue_maqqef" }
        },
        {
          word_index: 2,
          surface: "הַגָּן",
          op_entries: [{ tauBefore: 8, tauAfter: 8 }],
          exit_boundary: { mode: "cut" }
        },
        {
          word_index: 3,
          surface: "וְהָיָה",
          op_entries: [{ tauBefore: 14, tauAfter: 14 }],
          exit_boundary: { mode: "cut" }
        },
        {
          word_index: 4,
          surface: "לְאַרְבָּעָה",
          op_entries: [{ tauBefore: 15, tauAfter: 15 }],
          exit_boundary: { mode: "cut" }
        },
        {
          word_index: 5,
          surface: "רָאשִׁים",
          op_entries: [{ tauBefore: 16, tauAfter: 16 }],
          exit_boundary: null
        }
      ],
      vm: {
        tau: 19,
        Omega: "ב:15:1",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "א:7:2", kind: "scope", meta: {} },
          { id: "ה:8:3", kind: "rule", meta: {} },
          { id: "ו:14:7", kind: "structured", meta: {} },
          { id: "ה:14:4", kind: "rule", meta: {} },
          { id: "ב:15:1", kind: "boundary", meta: {} },
          { id: "ל:15:3", kind: "boundary", meta: {} },
          { id: "ר:16:4", kind: "boundary", meta: {} }
        ],
        links: [],
        boundaries: []
      }
    };

    const dot = renderDotFromTraceJson(tracePayload, {
      layout: "plain",
      wordsMode: "cluster",
      prune: "none",
      legend: false,
      prettyIds: false
    });

    expect(dot).toContain('label="אֶת";');
    expect(dot).toContain('label="הַגָּן";');
    expect(dot).not.toContain('label="אֶת־הַגָּן";');

    const larbaahCluster = findWordCluster(dot, "לְאַרְבָּעָה");
    expect(larbaahCluster).toBeTruthy();
    expect(larbaahCluster).toContain('"ב:15:1";');
    expect(larbaahCluster).toContain('"ל:15:3";');

    const rashimCluster = findWordCluster(dot, "רָאשִׁים");
    expect(rashimCluster).toBeTruthy();
    expect(rashimCluster).toContain('"ר:16:4";');
    expect(rashimCluster).not.toContain('"ב:15:1";');
  });
});
