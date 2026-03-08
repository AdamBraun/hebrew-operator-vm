import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotState = {
  vm?: { F?: string; K?: string[] };
  handles?: Array<{ id: string; meta?: Record<string, any> }>;
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  rules?: unknown[];
};

describe("yod behavior", () => {
  it("allocates a single cont-only pin, exports it, and keeps focus on the anchor", () => {
    const { state, trace, deepTrace } = runProgramWithDeepTrace("י", createInitialState(), {
      includeStateSnapshots: true
    });
    const yodEntry = deepTrace.find((entry) => entry.token_raw === "י");
    const snapshot = (yodEntry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
      {}) as SnapshotState;
    const selectArgs =
      yodEntry?.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ??
      [];
    const anchor = String(selectArgs[0] ?? "");
    const pinId = String(
      snapshot.handles?.find(
        (handle) => handle.meta?.pinOf === anchor && handle.id.startsWith("י:")
      )?.id ?? ""
    );
    const pinEvent = trace
      .find((entry) => entry.token === "י")
      ?.events.find((event) => event.type === "pin");

    expect(anchor).not.toBe("");
    expect(pinId).not.toBe("");
    expect(
      (snapshot.handles ?? []).filter(
        (handle) => handle.id.startsWith("י:") && handle.meta?.pinOf === anchor
      )
    ).toHaveLength(1);
    expect(snapshot.cont).toEqual([`${anchor}->${pinId}`]);
    expect(snapshot.carry).toEqual([]);
    expect(snapshot.supp).toEqual([]);
    expect(snapshot.head_of).toEqual([]);
    expect(snapshot.sub).toEqual([]);
    expect(snapshot.rules).toEqual([]);
    expect(snapshot.vm?.F).toBe(anchor);
    expect(snapshot.vm?.K?.includes(pinId)).toBe(true);
    expect(snapshot.vm?.K?.at(-1)).toBe(pinId);
    expect(state.handles.get(pinId)?.meta).toMatchObject({
      pinOf: anchor,
      selectable_pin: 1
    });
    expect(pinEvent?.data).toEqual({
      letter: "י",
      anchor,
      pin: pinId,
      exported: pinId,
      focus_before: anchor,
      focus_after: anchor,
      focus_unchanged: true,
      note: "focus remains unchanged",
      edges: [{ kind: "cont", from: anchor, to: pinId }]
    });
  });
});
