import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotState = {
  vm?: { F?: string };
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  adjuncts?: Record<string, string[]>;
  links?: Array<{ from: string; to: string; label: string }>;
};

function qofExitSnapshot(
  word: string,
  state = createInitialState()
): {
  state: ReturnType<typeof runProgramWithDeepTrace>["state"];
  snapshot: SnapshotState;
  selectArgs: string[];
  events: Array<{ type: string; tau: number; data: any }>;
} {
  const result = runProgramWithDeepTrace(word, state, {
    includeStateSnapshots: true
  });
  const qofEntry = result.deepTrace.find((entry) => entry.token === "ק");
  const snapshot = (qofEntry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as SnapshotState;
  const selectArgs =
    qofEntry?.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ?? [];
  const events = result.trace.find((entry) => entry.token === "ק")?.events ?? [];
  return {
    state: result.state,
    snapshot,
    selectArgs: Array.isArray(selectArgs) ? selectArgs.map(String) : [],
    events
  };
}

describe("qof behavior", () => {
  it("at word start builds a bare head with a detached exported leg from the ambient", () => {
    const { state, snapshot, selectArgs, events } = qofExitSnapshot("ק");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, source] = headOfEdge.split("->");
    const [leg = ""] = snapshot.adjuncts?.[head] ?? [];
    const headEvent = events.find((event) => event.type === "head_with_leg");

    expect(selectArgs).toEqual(["Ω"]);
    expect(source).toBe("Ω");
    expect(leg.length).toBeGreaterThan(0);
    expect(snapshot.head_of).toEqual([`${head}->Ω`]);
    expect(snapshot.carry).toContain(`Ω->${head}`);
    expect(snapshot.carry).toContain(`${head}->${leg}`);
    expect(snapshot.cont).toContain(`Ω->${head}`);
    expect(snapshot.cont).toContain(`${head}->${leg}`);
    expect(snapshot.supp ?? []).toEqual([]);
    expect(snapshot.sub).toEqual([`${head}->${leg}`]);
    expect(snapshot.vm?.F).toBe(head);
    expect(state.links.some((link) => link.label === "approx")).toBe(false);
    expect(
      Array.from(state.handles.values()).some(
        (handle) => handle.kind === "alias" || handle.meta?.approx === true
      )
    ).toBe(false);
    expect(headEvent?.data).toMatchObject({
      letter: "ק",
      source: "Ω",
      head,
      focus: head,
      adjunct: leg,
      exported_adjuncts: [leg],
      resolved: false
    });
    expect(headEvent?.data?.edges).toEqual([
      { kind: "head_of", from: head, to: "Ω" },
      { kind: "carry", from: "Ω", to: head },
      { kind: "cont", from: head, to: leg },
      { kind: "carry", from: head, to: leg }
    ]);
  });

  it("mid-word selects the current construct and still ends focus on the new head", () => {
    const { snapshot, selectArgs, events } = qofExitSnapshot("נק");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, source] = headOfEdge.split("->");
    const [leg = ""] = snapshot.adjuncts?.[head] ?? [];
    const headEvent = events.find((event) => event.type === "head_with_leg");

    expect(selectArgs).toEqual(["נ:1:1"]);
    expect(source).toBe("נ:1:1");
    expect(snapshot.carry).toContain(`נ:1:1->${head}`);
    expect(snapshot.carry).toContain(`${head}->${leg}`);
    expect(snapshot.cont).toContain(`${head}->${leg}`);
    expect(snapshot.supp ?? []).toEqual([]);
    expect(snapshot.sub).toContain(`${head}->${leg}`);
    expect(snapshot.vm?.F).toBe(head);
    expect(headEvent?.data).toMatchObject({
      source: "נ:1:1",
      head,
      focus: head,
      adjunct: leg
    });
  });

  it("never allocates approx handles or approx links", () => {
    const state = runProgram("אק", createInitialState());
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "alias")).toBe(
      false
    );
    expect(Array.from(state.handles.values()).some((handle) => handle.meta?.approx === true)).toBe(
      false
    );
    expect(state.links.some((link) => link.label === "approx")).toBe(false);
  });
});
