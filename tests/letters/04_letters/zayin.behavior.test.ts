import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

describe("zayin behavior", () => {
  it("creates a committed exported supported projection with no carry and keeps focus", () => {
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
    expect(port?.edge_mode).toBe("committed");
    expect(port?.meta?.handle_label).toBe("resolved_port");
    expect(port?.envelope.data_flow).toBe("SNAPSHOT");
    expect(port?.envelope.edit_flow).toBe("TIGHT");
    expect(port?.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(port?.envelope.coupling).toBe("CopyNoBacklink");
    expect(state.cont.has(`${focusBefore}->${portId}`)).toBe(true);
    expect(state.carry.has(`${focusBefore}->${portId}`)).toBe(false);
    expect(state.supp.has(`${portId}->${focusBefore}`)).toBe(true);
    expect(zayinExitSnapshot?.vm?.K?.includes(portId)).toBe(true);
    expect(zayinExitSnapshot?.vm?.F).toBe(focusBefore);
    expect(state.links.some((link) => link.label === "gate")).toBe(false);
    expect(state.vm.H.some((event) => event.type === "gate")).toBe(false);
  });

  it("emits the exact edge list snapshot cont+supp with no carry", () => {
    const { state } = runProgramWithDeepTrace("ז", createInitialState(), {
      includeStateSnapshots: true
    });
    const port = Array.from(state.handles.values()).find(
      (handle) => typeof handle.meta?.portOf === "string"
    );
    const portId = String(port?.id ?? "");
    const focusBefore = String(port?.meta?.portOf ?? "");

    expect({
      cont: Array.from(state.cont).sort(),
      carry: Array.from(state.carry).sort(),
      supp: Array.from(state.supp).sort(),
      focus: state.vm.F,
      exportedTop: state.vm.K[state.vm.K.length - 1] ?? null,
      portId,
      focusBefore
    }).toMatchInlineSnapshot(`
      {
        "carry": [],
        "cont": [
          "C:1:1->ז:1:1",
        ],
        "exportedTop": "⊥",
        "focus": "Ω",
        "focusBefore": "C:1:1",
        "portId": "ז:1:1",
        "supp": [
          "ז:1:1->C:1:1",
        ],
      }
    `);
  });
});
