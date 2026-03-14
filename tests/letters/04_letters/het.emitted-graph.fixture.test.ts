import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hetOp } from "@ref/letters/het";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

type NormalizedHetGraph = {
  scenario: string;
  letter: string;
  focus: string;
  edges: {
    cont: string[];
    carry: string[];
    supp: string[];
    links: Array<{ from: string; to: string; label: string }>;
  };
  handles: {
    interface: {
      id: string;
      kind: string;
      formedBy: string;
      inside: string;
      outside: string;
      p_in: string;
      p_out: string;
    };
    ports: Array<{
      id: string;
      kind: string;
      edge_mode: string;
      portOf: string;
      envelope: {
        data_flow: string;
        edit_flow: string;
        x_flow: string;
        coupling: string;
      };
    }>;
  };
  event: {
    type: string;
    data: {
      id: string;
      inside: string;
      outside: string;
      p_in: string;
      p_out: string;
    };
  };
};

const FIXTURE_PATH = path.resolve(process.cwd(), "tests", "fixtures", "het.emitted-graph.json");

function parseEdge(edge: string): [string, string] {
  const [from, to] = edge.split("->");
  if (!from || !to) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [from, to];
}

function normalizeEdgeList(edges: Iterable<string>, ids: Record<string, string>): string[] {
  return [...edges]
    .map((edge) => {
      const [from, to] = parseEdge(edge);
      return `${ids[from] ?? from}->${ids[to] ?? to}`;
    })
    .sort();
}

function currentHetEmittedGraph(): NormalizedHetGraph {
  const state = createInitialState();
  state.handles.set("inside", createHandle("inside", "scope"));
  state.handles.set("outside", createHandle("outside", "scope"));
  state.vm.F = "inside";
  state.vm.R = "outside";

  const beforeFocus = state.vm.F;
  const selectResult = hetOp.select(state);
  const boundResult = hetOp.bound(selectResult.S, selectResult.ops);
  const sealResult = hetOp.seal(boundResult.S, boundResult.cons);
  state.vm.K.push(sealResult.h);
  state.vm.F = sealResult.advance_focus === false ? beforeFocus : sealResult.h;
  state.vm.R = sealResult.r;

  const interfaceId = String(sealResult.h);
  const iface = state.handles.get(interfaceId);
  const event = state.vm.H.find((entry) => entry.type === "interface");
  if (!iface || !event) {
    throw new Error("Failed to derive ח interface artifact");
  }

  const inside = String(iface.meta?.inside ?? "");
  const outside = String(iface.meta?.outside ?? "");
  const pIn = String(iface.meta?.p_in ?? "");
  const pOut = String(iface.meta?.p_out ?? "");
  const pInHandle = state.handles.get(pIn);
  const pOutHandle = state.handles.get(pOut);

  if (!inside || !outside || !pIn || !pOut || !pInHandle || !pOutHandle) {
    throw new Error("Failed to derive ח port identifiers");
  }

  const ids: Record<string, string> = {
    [inside]: "INSIDE",
    [outside]: "OUTSIDE",
    [pIn]: "P_IN",
    [pOut]: "P_OUT",
    [interfaceId]: "I"
  };

  return {
    scenario: "minimal_direct_state",
    letter: "ח",
    focus: ids[String(state.vm.F)] ?? String(state.vm.F),
    edges: {
      cont: normalizeEdgeList(state.cont, ids),
      carry: normalizeEdgeList(state.carry, ids),
      supp: normalizeEdgeList(state.supp, ids),
      links: state.links
        .map((link) => ({
          from: ids[link.from] ?? link.from,
          to: ids[link.to] ?? link.to,
          label: link.label
        }))
        .sort((left, right) =>
          `${left.from}:${left.to}:${left.label}`.localeCompare(
            `${right.from}:${right.to}:${right.label}`
          )
        )
    },
    handles: {
      interface: {
        id: ids[interfaceId] ?? interfaceId,
        kind: iface.kind,
        formedBy: String(iface.meta?.formedBy ?? ""),
        inside: ids[inside] ?? inside,
        outside: ids[outside] ?? outside,
        p_in: ids[pIn] ?? pIn,
        p_out: ids[pOut] ?? pOut
      },
      ports: [pInHandle, pOutHandle]
        .map((handle) => ({
          id: ids[handle.id] ?? handle.id,
          kind: handle.kind,
          edge_mode: handle.edge_mode,
          portOf: ids[String(handle.meta?.portOf ?? "")] ?? String(handle.meta?.portOf ?? ""),
          envelope: {
            data_flow: handle.envelope.data_flow,
            edit_flow: handle.envelope.edit_flow,
            x_flow: handle.envelope.x_flow,
            coupling: handle.envelope.coupling
          }
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    },
    event: {
      type: event.type,
      data: {
        id: ids[String(event.data?.id ?? "")] ?? String(event.data?.id ?? ""),
        inside: ids[String(event.data?.inside ?? "")] ?? String(event.data?.inside ?? ""),
        outside: ids[String(event.data?.outside ?? "")] ?? String(event.data?.outside ?? ""),
        p_in: ids[String(event.data?.p_in ?? "")] ?? String(event.data?.p_in ?? ""),
        p_out: ids[String(event.data?.p_out ?? "")] ?? String(event.data?.p_out ?? "")
      }
    }
  };
}

describe("het emitted graph fixture", () => {
  it("matches the committed direct-support interface graph", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as NormalizedHetGraph;
    const graph = currentHetEmittedGraph();

    expect(graph).toEqual(fixture);
    expect(graph.handles.ports).toHaveLength(2);
    expect(graph.edges.cont).toEqual(["INSIDE->P_IN", "OUTSIDE->P_OUT"]);
    expect(graph.edges.carry).toEqual([]);
    expect(graph.edges.carry).not.toContain("INSIDE->P_IN");
    expect(graph.edges.carry).not.toContain("OUTSIDE->P_OUT");
    expect(graph.edges.supp).toEqual(["P_IN->INSIDE", "P_OUT->OUTSIDE"]);
    expect(graph.edges.links).toEqual([
      { from: "P_IN", to: "I", label: "bridge" },
      { from: "P_OUT", to: "I", label: "bridge" }
    ]);
    expect(graph.focus).toBe("I");
  });
});
