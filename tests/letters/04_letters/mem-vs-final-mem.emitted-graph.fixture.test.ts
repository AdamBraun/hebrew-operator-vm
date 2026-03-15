import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type NormalizedGraph = {
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
    close_mode?: string;
    closed_by?: string;
  };
  event: {
    type: string;
    data: Record<string, string>;
  };
};

type MemFamilyFixture = {
  scenario: string;
  graphs: {
    מ: NormalizedGraph;
    ם: NormalizedGraph;
  };
};

type TokenExitSnapshot = {
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
    close_mode?: string;
    closed_by?: string;
  }>;
};

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "mem-vs-final-mem.emitted-graphs.json"
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

function normalizeEventData(
  data: Record<string, unknown> | undefined,
  ids: Record<string, string>
): Record<string, string> {
  if (!data) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data)
      .map(([key, value]) => {
        if (typeof value !== "string") {
          return [key, String(value)];
        }
        return [key, ids[value] ?? value];
      })
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function findTokenSnapshot(
  deepTrace: Array<{ token?: string; phases: Array<{ phase: string; snapshot?: unknown }> }>,
  token: string
): TokenExitSnapshot {
  const entry = deepTrace.find((row) => row.token === token);
  if (!entry) {
    throw new Error(`Missing deep-trace entry for ${token}`);
  }
  const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
  if (!snapshot) {
    throw new Error(`Missing token_exit snapshot for ${token}`);
  }
  return snapshot as TokenExitSnapshot;
}

function currentMemFamilyGraphs(): MemFamilyFixture["graphs"] {
  const result = runProgramWithDeepTrace("מם", createInitialState(), {
    includeStateSnapshots: true
  });
  const memSnapshot = findTokenSnapshot(result.deepTrace, "מ");
  const finalMemSnapshot = findTokenSnapshot(result.deepTrace, "ם");
  const memBoundary = memSnapshot.boundaries?.[0];
  const finalMemBoundary = finalMemSnapshot.boundaries?.[0];
  const memOpenEvent = result.trace
    .find((row) => row.token === "מ")
    ?.events.find((event) => event.type === "mem_open");
  const memCloseEvent = result.trace
    .find((row) => row.token === "ם")
    ?.events.find((event) => event.type === "mem_close");

  if (!memBoundary || !finalMemBoundary || !memOpenEvent || !memCloseEvent) {
    throw new Error("Failed to derive mem/final-mem graph artifacts");
  }

  const source = String(memOpenEvent.data?.source ?? "");
  const hold = String(memOpenEvent.data?.hold ?? "");
  const inside = String(memOpenEvent.data?.inside ?? "");
  const sealed = String(memCloseEvent.data?.sealed ?? "");

  if (!source || !hold || !inside || !sealed) {
    throw new Error("Failed to derive normalized mem/final-mem identifiers");
  }

  const ids: Record<string, string> = {
    [source]: "F0",
    [hold]: "H",
    [inside]: "I",
    [sealed]: "S",
    [memBoundary.id]: "B",
    [finalMemBoundary.id]: "B"
  };

  return {
    מ: {
      focus: ids[String(memSnapshot.vm?.F ?? "")] ?? String(memSnapshot.vm?.F ?? ""),
      edges: {
        cont: normalizeEdges(memSnapshot.cont, ids),
        carry: normalizeEdges(memSnapshot.carry, ids),
        supp: normalizeEdges(memSnapshot.supp, ids),
        head_of: normalizeEdges(memSnapshot.head_of, ids),
        sub: normalizeEdges(memSnapshot.sub, ids)
      },
      boundary: {
        id: ids[memBoundary.id] ?? memBoundary.id,
        inside: ids[memBoundary.inside] ?? memBoundary.inside,
        outside: ids[memBoundary.outside] ?? memBoundary.outside,
        kind: memBoundary.kind,
        open: memBoundary.open,
        closed: memBoundary.closed
      },
      event: {
        type: memOpenEvent.type,
        data: normalizeEventData(memOpenEvent.data as Record<string, unknown> | undefined, ids)
      }
    },
    ם: {
      focus: ids[String(finalMemSnapshot.vm?.F ?? "")] ?? String(finalMemSnapshot.vm?.F ?? ""),
      edges: {
        cont: normalizeEdges(finalMemSnapshot.cont, ids),
        carry: normalizeEdges(finalMemSnapshot.carry, ids),
        supp: normalizeEdges(finalMemSnapshot.supp, ids),
        head_of: normalizeEdges(finalMemSnapshot.head_of, ids),
        sub: normalizeEdges(finalMemSnapshot.sub, ids)
      },
      boundary: {
        id: ids[finalMemBoundary.id] ?? finalMemBoundary.id,
        inside: ids[finalMemBoundary.inside] ?? finalMemBoundary.inside,
        outside: ids[finalMemBoundary.outside] ?? finalMemBoundary.outside,
        kind: finalMemBoundary.kind,
        open: finalMemBoundary.open,
        closed: finalMemBoundary.closed,
        close_mode: finalMemBoundary.close_mode,
        closed_by: finalMemBoundary.closed_by
      },
      event: {
        type: memCloseEvent.type,
        data: normalizeEventData(memCloseEvent.data as Record<string, unknown> | undefined, ids)
      }
    }
  };
}

describe("mem versus final mem emitted graphs", () => {
  it("matches the committed open-versus-close fixture and keeps both graphs carryless", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as MemFamilyFixture;
    const graphs = currentMemFamilyGraphs();

    expect(graphs).toEqual(fixture.graphs);
    expect(graphs["מ"].edges.carry).toEqual([]);
    expect(graphs["ם"].edges.carry).toEqual([]);
    expect(graphs["ם"].edges.cont).toEqual([...graphs["מ"].edges.cont, "I->S"]);
    expect(graphs["ם"].edges.supp).toEqual([...graphs["מ"].edges.supp, "S->I"]);
    expect(graphs["מ"].boundary).toMatchObject({ open: true, closed: false });
    expect(graphs["ם"].boundary).toMatchObject({
      open: false,
      closed: true,
      close_mode: "explicit",
      closed_by: "ם"
    });
  });
});
