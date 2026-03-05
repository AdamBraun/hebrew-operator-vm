import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

describe("vm deep trace", () => {
  it("captures select/bound/seal phases and snapshots for letters", () => {
    const { trace, deepTrace, preparedTokens } = runProgramWithDeepTrace(
      "וְהָאָרֶץ",
      createInitialState()
    );

    expect(deepTrace.length).toBe(trace.length);
    expect(preparedTokens.length).toBe(trace.length);

    const firstLetter = deepTrace.find((entry) => entry.token !== "□");
    expect(firstLetter).toBeDefined();
    expect(firstLetter?.phases.some((phase) => phase.phase === "select")).toBe(true);
    expect(firstLetter?.phases.some((phase) => phase.phase === "bound")).toBe(true);
    expect(firstLetter?.phases.some((phase) => phase.phase === "seal")).toBe(true);

    const selectPhase = firstLetter?.phases.find((phase) => phase.phase === "select");
    expect(selectPhase?.snapshot).toBeDefined();
    expect(typeof selectPhase?.snapshot?.vm?.F).toBe("string");
  });

  it("supports disabling snapshots", () => {
    const { deepTrace } = runProgramWithDeepTrace("הּ", createInitialState(), {
      includeStateSnapshots: false
    });

    expect(deepTrace.length).toBeGreaterThan(0);
    for (const entry of deepTrace) {
      for (const phase of entry.phases) {
        expect(phase.snapshot).toBeUndefined();
      }
    }
  });

  it("captures immutable state snapshots per phase", () => {
    const { deepTrace } = runProgramWithDeepTrace("נס", createInitialState(), {
      includeStateSnapshots: true
    });

    const nunEntry = deepTrace.find((entry) => entry.token_raw === "נ");
    const nunExit = nunEntry?.phases.find((phase) => phase.phase === "token_exit");
    const snapshotStack = nunExit?.snapshot?.vm?.OStack_word;

    expect(Array.isArray(snapshotStack)).toBe(true);
    expect(snapshotStack?.length).toBe(0);
  });
});
