import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type NormalizedMemGraph = {
  focus: string;
  edges: {
    cont: string[];
    carry: string[];
    supp: string[];
    head_of: string[];
    sub: string[];
  };
  boundary: {
    id: string;
    inside: string;
    outside: string;
    kind?: string;
    open?: boolean;
    closed?: boolean;
  };
  event: {
    type: string;
    data: {
      id: string;
      source: string;
      hold: string;
      inside: string;
      outside: string;
    };
  };
};

type MemGraphFixture = {
  scenario: string;
  letter: string;
  before: NormalizedMemGraph;
  after: NormalizedMemGraph;
};

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "mem-open.emitted-graph.before-after.json"
);

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function normalizeEdges(edges: string[] | undefined, ids: Record<string, string>): string[] {
  return (edges ?? [])
    .map((edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    })
    .sort();
}

function currentMemEmittedGraph(): NormalizedMemGraph {
  const result = runProgramWithDeepTrace("מ", createInitialState(), {
    includeStateSnapshots: true
  });
  const entry = result.deepTrace.find((row) => row.token === "מ");
  if (!entry) {
    throw new Error("Missing deep-trace entry for מ");
  }
  const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot as
    | {
        vm?: { F?: string };
        cont?: string[];
        carry?: string[];
        supp?: string[];
        head_of?: string[];
        sub?: string[];
        boundaries?: Array<{
          id: string;
          inside: string;
          outside: string;
          kind?: string;
          open?: boolean;
          closed?: boolean;
        }>;
      }
    | undefined;
  if (!snapshot) {
    throw new Error("Missing token_exit snapshot for מ");
  }

  const boundary = snapshot.boundaries?.[0];
  if (!boundary) {
    throw new Error("Missing mem boundary in token_exit snapshot");
  }
  const focus = String(snapshot.vm?.F ?? "");
  const hold = String(boundary.outside);
  const source = String((snapshot.supp ?? [])[0]?.split("->")[1] ?? "");
  const event = result.trace
    .find((row) => row.token === "מ")
    ?.events.find((e) => e.type === "mem_open");

  if (!focus || !hold || !source || !event) {
    throw new Error("Failed to derive normalized mem graph identifiers");
  }

  const ids: Record<string, string> = {
    [source]: "F0",
    [hold]: "H",
    [focus]: "I",
    [boundary.id]: "B"
  };

  return {
    focus: ids[focus] ?? focus,
    edges: {
      cont: normalizeEdges(snapshot.cont, ids),
      carry: normalizeEdges(snapshot.carry, ids),
      supp: normalizeEdges(snapshot.supp, ids),
      head_of: normalizeEdges(snapshot.head_of, ids),
      sub: normalizeEdges(snapshot.sub, ids)
    },
    boundary: {
      id: ids[boundary.id] ?? boundary.id,
      inside: ids[boundary.inside] ?? boundary.inside,
      outside: ids[boundary.outside] ?? boundary.outside,
      kind: boundary.kind,
      open: boundary.open,
      closed: boundary.closed
    },
    event: {
      type: event.type,
      data: {
        id: ids[String(event.data?.id ?? "")] ?? String(event.data?.id ?? ""),
        source: ids[String(event.data?.source ?? "")] ?? String(event.data?.source ?? ""),
        hold: ids[String(event.data?.hold ?? "")] ?? String(event.data?.hold ?? ""),
        inside: ids[String(event.data?.inside ?? "")] ?? String(event.data?.inside ?? ""),
        outside: ids[String(event.data?.outside ?? "")] ?? String(event.data?.outside ?? "")
      }
    }
  };
}

describe("mem emitted graph fixture", () => {
  it("matches the committed carry-removal graph and documents the before/after delta", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as MemGraphFixture;
    expect(currentMemEmittedGraph()).toEqual(fixture.after);
    expect(fixture.before).toEqual({
      ...fixture.after,
      edges: {
        ...fixture.after.edges,
        carry: ["F0->H"]
      }
    });
  });
});
