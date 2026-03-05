import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

describe("zayin behavior", () => {
  it("creates a locked exported port with immediately resolved carry and keeps focus", () => {
    const { state, deepTrace } = runProgramWithDeepTrace("ז", createInitialState(), {
      includeStateSnapshots: true
    });
    const port = Array.from(state.handles.values()).find(
      (handle) => typeof handle.meta?.portOf === "string"
    );
    const portId = String(port?.id ?? "");
    const focusBefore = String(port?.meta?.portOf ?? "");
    const zayinEntry = deepTrace.find((entry) => entry.token_raw === "ז");
    const zayinExitSnapshot = zayinEntry?.phases.find((phase) => phase.phase === "token_exit")
      ?.snapshot as { vm?: { K?: string[]; F?: string } } | undefined;

    expect(portId.length).toBeGreaterThan(0);
    expect(focusBefore.length).toBeGreaterThan(0);
    expect(port?.policy).toBe("framed_lock");
    expect(state.cont.has(`${focusBefore}->${portId}`)).toBe(true);
    expect(state.carry.has(`${focusBefore}->${portId}`)).toBe(true);
    expect(state.supp.has(`${portId}->${focusBefore}`)).toBe(true);
    expect(zayinExitSnapshot?.vm?.K?.includes(portId)).toBe(true);
    expect(zayinExitSnapshot?.vm?.F).toBe(focusBefore);
    expect(state.links.some((link) => link.label === "gate")).toBe(false);
    expect(state.vm.H.some((event) => event.type === "gate")).toBe(false);
  });
});
