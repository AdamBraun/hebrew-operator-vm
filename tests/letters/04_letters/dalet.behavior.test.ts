import { describe, expect, it } from "vitest";
import { eff, isCarryResolved } from "@ref/state/eff";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotState = {
  vm?: { F?: string };
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  boundaries?: unknown[];
};

function daletExitSnapshot(
  word: string,
  state = createInitialState()
): {
  state: ReturnType<typeof runProgramWithDeepTrace>["state"];
  snapshot: SnapshotState;
  selectArgs: string[];
} {
  const result = runProgramWithDeepTrace(word, state, {
    includeStateSnapshots: true
  });
  const daletEntry = result.deepTrace.find((entry) => entry.token === "ד");
  const snapshot = (daletEntry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as SnapshotState;
  const selectArgs =
    daletEntry?.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ??
    [];
  return {
    state: result.state,
    snapshot,
    selectArgs: Array.isArray(selectArgs) ? selectArgs.map(String) : []
  };
}

describe("dalet behavior", () => {
  it("at word start exposes a backed head from the word-entry ambient", () => {
    const state = createInitialState();
    const omega = state.handles.get("Ω");
    omega!.meta = { ...omega!.meta, witness: { ambient: 1 } };

    const { state: finalState, snapshot, selectArgs } = daletExitSnapshot("ד", state);
    const head = String(snapshot.vm?.F ?? "");

    expect(selectArgs).toEqual(["Ω"]);
    expect(snapshot.head_of).toEqual([`${head}->Ω`]);
    expect(snapshot.carry).toEqual([`Ω->${head}`]);
    expect(snapshot.cont).toEqual([`Ω->${head}`]);
    expect(snapshot.supp).toEqual([`${head}->Ω`]);
    expect(snapshot.boundaries).toEqual([]);
    expect(eff(finalState, head, { focusNodeId: head })).toEqual({ ambient: 1 });
    expect(isCarryResolved(finalState, "Ω", head, { focusNodeId: head })).toBe(true);
  });

  it("mid-word exposes a backed head from the current focus and advances focus to that head", () => {
    const { snapshot, selectArgs } = daletExitSnapshot("נד");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, body] = headOfEdge.split("->");

    expect(selectArgs).toEqual(["נ:1:1"]);
    expect(body.length).toBeGreaterThan(0);
    expect(snapshot.head_of).toEqual([`${head}->${body}`]);
    expect(snapshot.carry).toContain(`${body}->${head}`);
    expect(snapshot.supp).toEqual([`${head}->${body}`]);
    expect(snapshot.vm?.F).toBe(head);
  });
});
