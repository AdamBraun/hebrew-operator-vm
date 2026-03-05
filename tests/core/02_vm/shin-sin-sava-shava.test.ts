import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

function nonSpace<T extends { token: string }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.token !== "□");
}

function parseEdge(edge: string): [string, string] {
  const [source, target] = edge.split("->");
  if (!source || !target) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [source, target];
}

function outgoingCount(edges: Set<string>, source: string): number {
  let count = 0;
  for (const edge of edges) {
    const [from] = parseEdge(edge);
    if (from === source) {
      count += 1;
    }
  }
  return count;
}

function selectionTargets(entry: {
  phases: Array<{ phase: string; detail?: Record<string, any> }>;
}): string[] {
  const select = entry.phases.find((phase) => phase.phase === "select")?.detail?.select_operands;
  const targets = select?.prefs?.selection_targets;
  return Array.isArray(targets) ? targets.map(String) : [];
}

describe("shin/sin pair: שָׂבָע vs שָׁבָע", () => {
  it("keeps vowels identical and diverges only by fork direction/topology at shin/sin", () => {
    const sinRun = runProgramWithDeepTrace("שָׂבָע", createInitialState(), {
      includeStateSnapshots: false
    });
    const shinRun = runProgramWithDeepTrace("שָׁבָע", createInitialState(), {
      includeStateSnapshots: false
    });

    const sinTrace = nonSpace(sinRun.trace);
    const shinTrace = nonSpace(shinRun.trace);
    const sinDeep = nonSpace(sinRun.deepTrace);
    const shinDeep = nonSpace(shinRun.deepTrace);
    const sinPrepared = nonSpace(sinRun.preparedTokens);
    const shinPrepared = nonSpace(shinRun.preparedTokens);

    const sinFork = sinTrace[0].events.find((event) => event.type === "shin");
    const shinFork = shinTrace[0].events.find((event) => event.type === "shin");
    const sinFocus = String(sinFork?.data?.focus ?? "");
    const shinFocus = String(shinFork?.data?.focus ?? "");
    const sinPorts = [sinFork?.data?.spine, sinFork?.data?.left, sinFork?.data?.right].map(String);
    const shinPorts = [shinFork?.data?.spine, shinFork?.data?.left, shinFork?.data?.right].map(
      String
    );

    expect(sinFork?.data?.direction).toBe("internal");
    expect(shinFork?.data?.direction).toBe("external");
    expect(outgoingCount(sinRun.state.sub, sinFocus)).toBe(3);
    expect(outgoingCount(sinRun.state.cont, sinFocus)).toBe(0);
    expect(outgoingCount(shinRun.state.sub, shinFocus)).toBe(0);
    expect(outgoingCount(shinRun.state.cont, shinFocus)).toBe(3);
    expect(sinRun.state.supp.size).toBe(0);
    expect(shinRun.state.supp.size).toBe(0);
    for (const id of sinPorts) {
      expect(sinRun.state.handles.get(id)?.kind).toBe("compartment");
    }
    for (const id of shinPorts) {
      expect(shinRun.state.handles.get(id)?.kind).toBe("structured");
    }
    expect(sinRun.state.handles.get(sinFocus)?.meta.fork_direction).toBe("internal");
    expect(shinRun.state.handles.get(shinFocus)?.meta.fork_direction).toBe("external");

    const sinSecondTargets = selectionTargets(sinDeep[1]);
    const shinSecondTargets = selectionTargets(shinDeep[1]);
    expect(sinSecondTargets).toEqual(sinPorts);
    expect(shinSecondTargets).toEqual([]);

    const sinFirstKinds = sinPrepared[0].diacritics
      .map((diacritic) => diacritic.kind)
      .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
      .sort();
    const shinFirstKinds = shinPrepared[0].diacritics
      .map((diacritic) => diacritic.kind)
      .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
      .sort();
    expect(sinFirstKinds).toEqual(shinFirstKinds);
    expect(sinPrepared[1].diacritics.map((diacritic) => diacritic.kind).sort()).toEqual(
      shinPrepared[1].diacritics.map((diacritic) => diacritic.kind).sort()
    );
    expect(sinPrepared[2].diacritics.map((diacritic) => diacritic.kind).sort()).toEqual(
      shinPrepared[2].diacritics.map((diacritic) => diacritic.kind).sort()
    );
  });
});
