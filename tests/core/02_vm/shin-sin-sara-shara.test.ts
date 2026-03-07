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

function tochLetterMode(entry: {
  phases: Array<{ phase: string; detail?: Record<string, any> }>;
}): string | null {
  return (
    (entry.phases.find((phase) => phase.phase === "toch")?.detail?.letter_mode as string | null) ??
    null
  );
}

describe("shin/sin pair: שָׂרָה vs שָׁרָה", () => {
  it("keeps kamatz processing equal and diverges by internal-vs-external fork observability", () => {
    const sinRun = runProgramWithDeepTrace("שָׂרָה", createInitialState(), {
      includeStateSnapshots: false
    });
    const shinRun = runProgramWithDeepTrace("שָׁרָה", createInitialState(), {
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
    expect(outgoingCount(sinRun.state.cont, sinFocus)).toBe(1);
    expect(outgoingCount(shinRun.state.sub, shinFocus)).toBe(0);
    expect(outgoingCount(shinRun.state.cont, shinFocus)).toBe(4);
    expect(sinRun.state.supp.size).toBe(3);
    expect(shinRun.state.supp.size).toBe(3);
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

    expect(tochLetterMode(sinDeep[2])).toBeNull();
    expect(tochLetterMode(shinDeep[2])).toBeNull();

    for (const index of [0, 1, 2]) {
      const sinKinds = sinPrepared[index].diacritics
        .map((diacritic) => diacritic.kind)
        .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
        .sort();
      const shinKinds = shinPrepared[index].diacritics
        .map((diacritic) => diacritic.kind)
        .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
        .sort();
      expect(sinKinds).toEqual(shinKinds);
    }
    expect(
      sinPrepared[0].diacritics
        .map((diacritic) => diacritic.kind)
        .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
    ).toContain("kamatz");
    expect(
      sinPrepared[1].diacritics
        .map((diacritic) => diacritic.kind)
        .filter((kind) => kind !== "shin_dot_left" && kind !== "shin_dot_right")
    ).toContain("kamatz");
  });
});
