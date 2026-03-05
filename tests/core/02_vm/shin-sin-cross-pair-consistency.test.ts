import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

function nonSpace<T extends { token: string }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.token !== "□");
}

function selectionTargets(entry: {
  phases: Array<{ phase: string; detail?: Record<string, any> }>;
}): string[] {
  const select = entry.phases.find((phase) => phase.phase === "select")?.detail?.select_operands;
  const targets = select?.prefs?.selection_targets;
  return Array.isArray(targets) ? targets.map(String) : [];
}

function firstForkPorts(
  trace: Array<{ token: string; events: Array<{ type: string; data: any }> }>
): string[] {
  const firstLetter = trace.find((entry) => entry.token !== "□");
  const fork = firstLetter?.events.find((event) => event.type === "shin");
  return [fork?.data?.spine, fork?.data?.left, fork?.data?.right].map(String);
}

describe("shin/sin cross-pair consistency", () => {
  it("fires the same fan-in observability clause for sin-led words and keeps shin-led words single-target", () => {
    const sinSava = runProgramWithDeepTrace("שָׂבָע", createInitialState(), {
      includeStateSnapshots: false
    });
    const sinSara = runProgramWithDeepTrace("שָׂרָה", createInitialState(), {
      includeStateSnapshots: false
    });
    const shinShava = runProgramWithDeepTrace("שָׁבָע", createInitialState(), {
      includeStateSnapshots: false
    });
    const shinShara = runProgramWithDeepTrace("שָׁרָה", createInitialState(), {
      includeStateSnapshots: false
    });

    const sinSavaDeep = nonSpace(sinSava.deepTrace);
    const sinSaraDeep = nonSpace(sinSara.deepTrace);
    const shinShavaDeep = nonSpace(shinShava.deepTrace);
    const shinSharaDeep = nonSpace(shinShara.deepTrace);

    const sinSavaTargets = selectionTargets(sinSavaDeep[1]);
    const sinSaraTargets = selectionTargets(sinSaraDeep[1]);
    const shinShavaTargets = selectionTargets(shinShavaDeep[1]);
    const shinSharaTargets = selectionTargets(shinSharaDeep[1]);

    expect(sinSavaTargets).toEqual(firstForkPorts(sinSava.trace));
    expect(sinSaraTargets).toEqual(firstForkPorts(sinSara.trace));
    expect(sinSavaTargets).toHaveLength(3);
    expect(sinSaraTargets).toHaveLength(3);

    expect(shinShavaTargets).toEqual([]);
    expect(shinSharaTargets).toEqual([]);
  });
});
