import { describe, expect, it } from "vitest";

function findWordCluster(dot: string, label: string): string | null {
  const clusters = dot
    .split("subgraph cluster_word_")
    .slice(1)
    .map((chunk) => `subgraph cluster_word_${chunk}`);
  return clusters.find((cluster) => cluster.includes(`label="${label}";`)) ?? null;
}

function findBoundaryCluster(dot: string, boundaryId: string): string | null {
  const marker = `label="Boundary ${boundaryId}";`;
  const start = dot.indexOf(marker);
  if (start < 0) {
    return null;
  }
  const clusterStart = dot.lastIndexOf("subgraph cluster_", start);
  if (clusterStart < 0) {
    return null;
  }
  const clusterEnd = dot.indexOf("  }\n", start);
  if (clusterEnd < 0) {
    return null;
  }
  return dot.slice(clusterStart, clusterEnd + 4);
}

function expectDomainAndFocusEdges(dot: string): void {
  const lines = dot.split(/\r?\n/u);
  const domainEdge = lines.find((line) => line.includes("domain") && line.includes("penwidth=4"));
  const focusEdge = lines.find((line) => line.includes("focus") && line.includes("penwidth=4"));
  expect(domainEdge).toBeTruthy();
  expect(focusEdge).toBeTruthy();
}

describe("pasuk graph renderer", () => {
  it("always renders thick domain and focus edges and reports D/F in legend", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const tracePayload = {
      ref_key: "Genesis/1/1",
      cleaned_text: "א",
      vm: {
        tau: 1,
        D: "Ω",
        F: "Ω",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          { id: "א:1:1", kind: "scope", meta: {} }
        ],
        links: [],
        boundaries: []
      }
    };

    const dot = renderDotFromTraceJson(tracePayload, {
      layout: "plain",
      prune: "orphans",
      legend: true,
      prettyIds: false
    });

    expect(dot).toContain('"Ω" -> "Ω"');
    expect(dot).toContain("domain");
    expect(dot).toContain("F_marker [");
    expect(dot).toContain('label="F"');
    expect(dot).toContain('F_marker -> "Ω"');
    expect(dot).toContain("focus");
    expect(dot).toContain("D=Ω | F=Ω");
    expectDomainAndFocusEdges(dot);
  });

  it("force-keeps domain/focus target nodes under orphan pruning", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const tracePayload = {
      ref_key: "Genesis/1/2",
      cleaned_text: "א",
      vm: {
        tau: 2,
        D: "hD",
        F: "hF",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          { id: "hD", kind: "scope", meta: {} },
          { id: "hF", kind: "scope", meta: {} }
        ],
        links: [],
        boundaries: []
      }
    };

    const dot = renderDotFromTraceJson(tracePayload, {
      layout: "plain",
      prune: "orphans",
      legend: false,
      prettyIds: false
    });

    expect(dot).toContain("hD [");
    expect(dot).toContain("hF [");
    expect(dot).toContain('"Ω" -> hD');
    expect(dot).toContain("F_marker -> hF");
    expectDomainAndFocusEdges(dot);
  });

  it("renders thick domain/focus edges across payload shapes and defaults", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const cases: Array<{
      payload: Record<string, unknown>;
      opts: Record<string, unknown>;
    }> = [
      {
        payload: {
          ref_key: "Genesis/1/3",
          cleaned_text: "א",
          vm: {
            tau: 3,
            D: "Ω",
            F: "Ω",
            handles: [
              { id: "Ω", kind: "scope", meta: {} },
              { id: "⊥", kind: "empty", meta: {} },
              { id: "א:3:1", kind: "scope", meta: {} }
            ],
            links: [],
            boundaries: []
          }
        },
        opts: {
          layout: "plain",
          prune: "orphans",
          legend: false,
          prettyIds: false
        }
      },
      {
        payload: {
          ref_key: "Genesis/1/4",
          cleaned_text: "א",
          vm: {
            tau: 4,
            handles: [
              { id: "Ω", kind: "scope", meta: {} },
              { id: "⊥", kind: "empty", meta: {} },
              { id: "א:4:1", kind: "scope", meta: {} }
            ],
            links: [],
            boundaries: []
          }
        },
        opts: {
          layout: "plain",
          prune: "none",
          legend: false,
          prettyIds: false,
          mode: "summary"
        }
      },
      {
        payload: {
          ref_key: "Genesis/1/5",
          final_state: {
            vm: { tau: 5, D: "Ω", F: "Ω" },
            handles: [
              { id: "Ω", kind: "scope", meta: {} },
              { id: "⊥", kind: "empty", meta: {} },
              { id: "א:5:1", kind: "scope", meta: {} }
            ],
            links: [],
            boundaries: []
          }
        },
        opts: {
          layout: "boot",
          prune: "orphans",
          legend: true,
          prettyIds: true
        }
      }
    ];

    for (const testCase of cases) {
      const dot = renderDotFromTraceJson(testCase.payload, testCase.opts);
      expectDomainAndFocusEdges(dot);
    }
  });

  it("clusters by origin tau from id, not mutable word metadata", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const tracePayload = {
      ref_key: "Genesis/3/1",
      cleaned_text: "א ב",
      word_sections: [
        {
          word_index: 1,
          surface: "א",
          op_entries: [{ tauBefore: 7, tauAfter: 7 }],
          exit_boundary: { mode: "cut" }
        },
        {
          word_index: 2,
          surface: "ב",
          op_entries: [{ tauBefore: 8, tauAfter: 8 }],
          exit_boundary: null
        }
      ],
      vm: {
        tau: 9,
        D: "Ω",
        F: "Ω",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          // Simulate later-word references mutating metadata.
          { id: "א:7:1", kind: "scope", meta: { word_index: 2 } },
          { id: "ב:8:1", kind: "scope", meta: { word_index: 1 } }
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

    const firstWordCluster = findWordCluster(dot, "א");
    expect(firstWordCluster).toBeTruthy();
    expect(firstWordCluster).toContain('"א:7:1";');
    expect(firstWordCluster).not.toContain('"ב:8:1";');

    const secondWordCluster = findWordCluster(dot, "ב");
    expect(secondWordCluster).toBeTruthy();
    expect(secondWordCluster).toContain('"ב:8:1";');
    expect(secondWordCluster).not.toContain('"א:7:1";');
  });

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
        D: "ב:15:1",
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

  it("renders sub edges as dashed compartment links and places sub-children in boundary clusters", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const sinPayload = {
      ref_key: "manual",
      cleaned_text: "כבשׂ",
      vm: {
        tau: 2,
        D: "Ω",
        F: "Ω",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          { id: "ב:1:1", kind: "boundary", meta: {} },
          { id: "כ:1:1", kind: "scope", meta: { scope_path: ["ב:1:1"] } },
          { id: "ש:1:1", kind: "compartment", meta: { parent: "ב:1:1" } },
          { id: "ש:1:2", kind: "compartment", meta: { parent: "ב:1:1" } },
          { id: "ש:1:3", kind: "compartment", meta: { parent: "ב:1:1" } }
        ],
        links: [
          { from: "ב:1:1", to: "כ:1:1", label: "boundary" },
          { from: "כ:1:1", to: "ב:1:1", label: "boundary" }
        ],
        boundaries: [{ id: "ב:1:1", inside: "כ:1:1", outside: "Ω", members: ["כ:1:1"] }],
        sub: [
          "ב:1:1->ש:1:1",
          "ב:1:1->ש:1:2",
          "ב:1:1->ש:1:3",
          "ש:1:1->ש:1:2",
          "ש:1:2->ש:1:3",
          "ש:1:3->ש:1:1"
        ]
      }
    };

    const shinPayload = {
      ref_key: "manual",
      cleaned_text: "כבשׁ",
      vm: {
        tau: 2,
        D: "Ω",
        F: "Ω",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          { id: "ב:1:1", kind: "boundary", meta: {} },
          { id: "כ:1:1", kind: "scope", meta: { scope_path: ["ב:1:1"] } },
          { id: "ש:1:1", kind: "structured", meta: { parent: "ב:1:1", role: "spine" } },
          { id: "ש:1:2", kind: "structured", meta: { parent: "ב:1:1", role: "left" } },
          { id: "ש:1:3", kind: "structured", meta: { parent: "ב:1:1", role: "right" } }
        ],
        links: [
          { from: "ב:1:1", to: "כ:1:1", label: "boundary" },
          { from: "כ:1:1", to: "ב:1:1", label: "boundary" },
          { from: "ב:1:1", to: "ש:1:1", label: "branch" },
          { from: "ב:1:1", to: "ש:1:2", label: "branch" },
          { from: "ב:1:1", to: "ש:1:3", label: "branch" }
        ],
        boundaries: [{ id: "ב:1:1", inside: "כ:1:1", outside: "Ω", members: ["כ:1:1"] }],
        sub: []
      }
    };

    const sinDot = renderDotFromTraceJson(sinPayload, {
      layout: "plain",
      prune: "orphans",
      boundary: "cluster",
      legend: false,
      prettyIds: false
    });
    const shinDot = renderDotFromTraceJson(shinPayload, {
      layout: "plain",
      prune: "orphans",
      boundary: "cluster",
      legend: false,
      prettyIds: false
    });

    expect(sinDot).toContain('"ב:1:1" -> "ש:1:1" [xlabel="sub", style="dashed", color="#6A8E4E"]');
    expect(sinDot).toContain('"ב:1:1" -> "ש:1:2" [xlabel="sub", style="dashed", color="#6A8E4E"]');
    expect(sinDot).toContain('"ב:1:1" -> "ש:1:3" [xlabel="sub", style="dashed", color="#6A8E4E"]');
    expect(sinDot).toContain('"ש:1:1" -> "ש:1:2" [xlabel="loop", style="dotted", color="#8FB07A"]');
    expect(sinDot).toContain('"ש:1:2" -> "ש:1:3" [xlabel="loop", style="dotted", color="#8FB07A"]');
    expect(sinDot).toContain('"ש:1:3" -> "ש:1:1" [xlabel="loop", style="dotted", color="#8FB07A"]');

    const boundaryCluster = findBoundaryCluster(sinDot, "ב:1:1");
    expect(boundaryCluster).toBeTruthy();
    expect(boundaryCluster).toContain('"כ:1:1";');
    expect(boundaryCluster).toContain('"ש:1:1";');
    expect(boundaryCluster).toContain('"ש:1:2";');
    expect(boundaryCluster).toContain('"ש:1:3";');

    expect(shinDot).not.toContain('xlabel="sub"');
  });

  it("renders fan-in and branch edge styles and promotes compartments into the parent's boundary cluster", async () => {
    const { renderDotFromTraceJson } = await import("../../scripts/render/pasukGraph.mjs");

    const payload = {
      ref_key: "manual",
      cleaned_text: "fanin",
      vm: {
        tau: 3,
        D: "Ω",
        F: "Ω",
        handles: [
          { id: "Ω", kind: "scope", meta: {} },
          { id: "⊥", kind: "empty", meta: {} },
          { id: "ב:2:1", kind: "boundary", meta: {} },
          { id: "כ:2:1", kind: "scope", meta: {} },
          { id: "נ:2:1", kind: "scope", meta: {} },
          { id: "ש:2:1", kind: "compartment", meta: { parent: "כ:2:1" } },
          { id: "ש:2:2", kind: "compartment", meta: { parent: "כ:2:1" } },
          { id: "ש:2:3", kind: "compartment", meta: { parent: "כ:2:1" } },
          { id: "פ:2:1", kind: "structured", meta: { parent: "כ:2:1", role: "p1" } }
        ],
        links: [
          { from: "כ:2:1", to: "ב:2:1", label: "boundary" },
          { from: "ב:2:1", to: "כ:2:1", label: "boundary" },
          { from: "ב:2:1", to: "ש:2:1", label: "boundary" }
        ],
        boundaries: [{ id: "ב:2:1", inside: "כ:2:1", outside: "Ω", members: ["כ:2:1"] }],
        cont: ["נ:2:1->כ:2:1", "נ:2:1->ש:2:1", "כ:2:1->פ:2:1"],
        carry: ["נ:2:1->כ:2:1", "נ:2:1->ש:2:1"],
        sub: [
          "כ:2:1->ש:2:1",
          "כ:2:1->ש:2:2",
          "כ:2:1->ש:2:3",
          "ש:2:1->ש:2:2",
          "ש:2:2->ש:2:3",
          "ש:2:3->ש:2:1"
        ]
      }
    };

    const dot = renderDotFromTraceJson(payload, {
      layout: "plain",
      prune: "none",
      boundary: "cluster",
      legend: false,
      prettyIds: false
    });

    const boundaryCluster = findBoundaryCluster(dot, "ב:2:1");
    expect(boundaryCluster).toBeTruthy();
    expect(boundaryCluster).toContain('"כ:2:1";');
    expect(boundaryCluster).toContain('"ש:2:1";');
    expect(boundaryCluster).toContain('"ש:2:2";');
    expect(boundaryCluster).toContain('"ש:2:3";');

    expect(dot).toContain('"נ:2:1" -> "כ:2:1" [xlabel="carry"]');
    expect(dot).toContain('"נ:2:1" -> "ש:2:1" [xlabel="carry", style="dashed"]');
    expect(dot).toContain('"ב:2:1" -> "ש:2:1" [xlabel="boundary", style="dashed"]');
    expect(dot).toContain('"כ:2:1" -> "פ:2:1" [xlabel="branch"');
  });
});
