import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotHandle = {
  id: string;
  edge_mode?: string;
  envelope?: {
    data_flow?: string;
    edit_flow?: string;
    x_flow?: string;
    coupling?: string;
  };
  meta?: Record<string, any>;
};

type TokenExitSnapshot = {
  vm?: {
    F?: string;
    K?: string[];
  };
  handles?: SnapshotHandle[];
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  links?: Array<{ label: string }>;
  rules?: unknown[];
};

function tokenExitSnapshots(word: string): TokenExitSnapshot[] {
  const { deepTrace } = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });

  return deepTrace
    .filter((entry) => entry.token_raw !== "□")
    .map((entry) => {
      const snapshot = entry.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
      if (!snapshot) {
        throw new Error(`Missing token_exit snapshot for '${entry.token_raw}' in '${word}'`);
      }
      return snapshot as TokenExitSnapshot;
    });
}

function baselineId(snapshot: TokenExitSnapshot): string {
  const baseline = snapshot.handles?.find(
    (handle) => handle.meta?.construct_role === "baseline"
  )?.id;
  if (!baseline) {
    throw new Error("Missing word baseline handle");
  }
  return baseline;
}

function familyNodeIds(snapshot: TokenExitSnapshot, prefix: string): string[] {
  return (snapshot.handles ?? [])
    .map((handle) => handle.id)
    .filter((id) => id.startsWith(`${prefix}:`))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeEdges(edges: string[] | undefined, names: Record<string, string>): string[] {
  return (edges ?? []).map((edge) => {
    const [from = "", to = ""] = edge.split("->");
    return `${names[from] ?? from}->${names[to] ?? to}`;
  });
}

function expectNoExtraSemantics(snapshot: TokenExitSnapshot): void {
  expect(snapshot.head_of ?? []).toEqual([]);
  expect(snapshot.sub ?? []).toEqual([]);
  expect(snapshot.links ?? []).toEqual([]);
  expect(snapshot.rules ?? []).toEqual([]);
}

describe("continuation family behavior", () => {
  it("כ allocates a single resolved hold and ends focus on it", () => {
    const [snapshot] = tokenExitSnapshots("כ");
    const start = baselineId(snapshot);
    const [holdId] = familyNodeIds(snapshot, "כ");

    expect(familyNodeIds(snapshot, "כ")).toEqual(["כ:1:1"]);
    expect(snapshot.cont ?? []).toEqual([`${start}->${holdId}`]);
    expect(snapshot.carry ?? []).toEqual([`${start}->${holdId}`]);
    expect(snapshot.supp ?? []).toEqual([`${holdId}->${start}`]);
    expect(snapshot.vm?.F).toBe(holdId);
    expectNoExtraSemantics(snapshot);
  });

  it("ו allocates one fresh continuation node and advances focus with no carry or supp", () => {
    const [snapshot] = tokenExitSnapshots("ו");
    const start = baselineId(snapshot);
    const [node] = familyNodeIds(snapshot, "ו");

    expect(familyNodeIds(snapshot, "ו")).toEqual(["ו:1:1"]);
    expect(snapshot.cont ?? []).toEqual([`${start}->${node}`]);
    expect(snapshot.carry ?? []).toEqual([]);
    expect(snapshot.supp ?? []).toEqual([]);
    expect(snapshot.vm?.F).toBe(node);
    expectNoExtraSemantics(snapshot);
  });

  it("וו forms a length-2 continuation chain with no carry or supp", () => {
    const [first, second] = tokenExitSnapshots("וו");
    const start = baselineId(second);
    const [firstNode, secondNode] = familyNodeIds(second, "ו");

    expect(familyNodeIds(first, "ו")).toEqual(["ו:1:1"]);
    expect(first.vm?.F).toBe("ו:1:1");
    expect(familyNodeIds(second, "ו")).toEqual(["ו:1:1", "ו:1:2"]);
    expect(second.cont ?? []).toEqual([`${start}->${firstNode}`, `${firstNode}->${secondNode}`]);
    expect(second.carry ?? []).toEqual([]);
    expect(second.supp ?? []).toEqual([]);
    expect(second.vm?.F).toBe(secondNode);
    expectNoExtraSemantics(second);
  });

  it("נ keeps the same forward continuation shape as ו but adds carry and no supp", () => {
    const [vavSnapshot] = tokenExitSnapshots("ו");
    const [nunSnapshot] = tokenExitSnapshots("נ");
    const nunStart = baselineId(nunSnapshot);
    const [nunNode] = familyNodeIds(nunSnapshot, "נ");

    expect(
      normalizeEdges(vavSnapshot.cont, { [baselineId(vavSnapshot)]: "F0", "ו:1:1": "F1" })
    ).toEqual(["F0->F1"]);
    expect(normalizeEdges(nunSnapshot.cont, { [nunStart]: "F0", [nunNode]: "F1" })).toEqual([
      "F0->F1"
    ]);
    expect(nunSnapshot.carry ?? []).toEqual([`${nunStart}->${nunNode}`]);
    expect(nunSnapshot.supp ?? []).toEqual([]);
    expect(nunSnapshot.vm?.F).toBe(nunNode);
    expectNoExtraSemantics(nunSnapshot);
  });

  it("ן keeps the same forward continuation shape as ו and adds both carry and supp", () => {
    const [vavSnapshot] = tokenExitSnapshots("ו");
    const [finalNunSnapshot] = tokenExitSnapshots("ן");
    const finalNunStart = baselineId(finalNunSnapshot);
    const [finalNunNode] = familyNodeIds(finalNunSnapshot, "ן");
    const finalNunHandle = finalNunSnapshot.handles?.find((handle) => handle.id === finalNunNode);

    expect(
      normalizeEdges(vavSnapshot.cont, { [baselineId(vavSnapshot)]: "F0", "ו:1:1": "F1" })
    ).toEqual(["F0->F1"]);
    expect(
      normalizeEdges(finalNunSnapshot.cont, { [finalNunStart]: "F0", [finalNunNode]: "F1" })
    ).toEqual(["F0->F1"]);
    expect(finalNunSnapshot.carry ?? []).toEqual([`${finalNunStart}->${finalNunNode}`]);
    expect(finalNunSnapshot.supp ?? []).toEqual([`${finalNunNode}->${finalNunStart}`]);
    expect(finalNunHandle?.edge_mode).toBe("committed");
    expect(finalNunHandle?.envelope?.data_flow).toBe("SNAPSHOT");
    expect(finalNunHandle?.envelope?.edit_flow).toBe("TIGHT");
    expect(finalNunHandle?.envelope?.x_flow).toBe("EXPLICIT_ONLY");
    expect(finalNunHandle?.envelope?.coupling).toBe("CopyNoBacklink");
    expect(finalNunSnapshot.vm?.F).toBe(finalNunNode);
    expectNoExtraSemantics(finalNunSnapshot);
  });

  it("ז exports a committed resolved port on the same forward shape but keeps focus at the source", () => {
    const [vavSnapshot] = tokenExitSnapshots("ו");
    const [zayinSnapshot] = tokenExitSnapshots("ז");
    const start = baselineId(zayinSnapshot);
    const [portId] = familyNodeIds(zayinSnapshot, "ז");
    const port = zayinSnapshot.handles?.find((handle) => handle.id === portId);

    expect(
      normalizeEdges(vavSnapshot.cont, { [baselineId(vavSnapshot)]: "F0", "ו:1:1": "F1" })
    ).toEqual(["F0->F1"]);
    expect(normalizeEdges(zayinSnapshot.cont, { [start]: "F0", [portId]: "F1" })).toEqual([
      "F0->F1"
    ]);
    expect(zayinSnapshot.carry ?? []).toEqual([`${start}->${portId}`]);
    expect(zayinSnapshot.supp ?? []).toEqual([`${portId}->${start}`]);
    expect(port?.meta?.portOf).toBe(start);
    expect(port?.edge_mode).toBe("committed");
    expect(port?.envelope?.data_flow).toBe("SNAPSHOT");
    expect(port?.envelope?.edit_flow).toBe("TIGHT");
    expect(port?.envelope?.x_flow).toBe("EXPLICIT_ONLY");
    expect(port?.envelope?.coupling).toBe("CopyNoBacklink");
    expect(zayinSnapshot.vm?.K).toContain(portId);
    expect(zayinSnapshot.vm?.F).toBe(start);
    expectNoExtraSemantics(zayinSnapshot);
  });
});
