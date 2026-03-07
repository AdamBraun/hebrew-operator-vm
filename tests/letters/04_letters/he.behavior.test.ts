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
  rules?: unknown[];
};

function heExitSnapshot(
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
  const heEntry = result.deepTrace.find((entry) => entry.token === "ה");
  const snapshot = (heEntry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as SnapshotState;
  const selectArgs =
    heEntry?.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ?? [];
  const events = result.trace.find((entry) => entry.token === "ה")?.events ?? [];
  return {
    state: result.state,
    snapshot,
    selectArgs: Array.isArray(selectArgs) ? selectArgs.map(String) : [],
    events
  };
}

describe("he behavior", () => {
  it("at word start builds a resolved head with a detached exported leg from the ambient", () => {
    const { state, snapshot, selectArgs, events } = heExitSnapshot("ה");
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
    expect(snapshot.supp).toEqual([`${head}->Ω`, `${leg}->${head}`]);
    expect(snapshot.sub).toEqual([`${head}->${leg}`]);
    expect(snapshot.vm?.F).toBe(head);
    expect(state.rules).toEqual([]);
    expect(
      Array.from(state.handles.values()).some(
        (handle) => handle.kind === "rule" || handle.meta?.public
      )
    ).toBe(false);
    expect(headEvent?.data).toMatchObject({
      letter: "ה",
      source: "Ω",
      head,
      adjunct: leg,
      adjuncts: [leg],
      resolved: true
    });
    expect(headEvent?.data?.edges).toEqual([
      { kind: "head_of", from: head, to: "Ω" },
      { kind: "carry", from: "Ω", to: head },
      { kind: "supp", from: head, to: "Ω" },
      { kind: "cont", from: head, to: leg },
      { kind: "carry", from: head, to: leg },
      { kind: "supp", from: leg, to: head }
    ]);
  });

  it("mid-word selects the current construct and still ends focus on the new head", () => {
    const { snapshot, selectArgs, events } = heExitSnapshot("נה");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, source] = headOfEdge.split("->");
    const [leg = ""] = snapshot.adjuncts?.[head] ?? [];
    const headEvent = events.find((event) => event.type === "head_with_leg");

    expect(selectArgs).toEqual(["נ:1:1"]);
    expect(source).toBe("נ:1:1");
    expect(snapshot.carry).toContain(`נ:1:1->${head}`);
    expect(snapshot.carry).toContain(`${head}->${leg}`);
    expect(snapshot.supp).toContain(`${head}->נ:1:1`);
    expect(snapshot.supp).toContain(`${leg}->${head}`);
    expect(snapshot.sub).toContain(`${head}->${leg}`);
    expect(snapshot.vm?.F).toBe(head);
    expect(headEvent?.data).toMatchObject({
      source: "נ:1:1",
      head,
      adjunct: leg
    });
  });

  it("never allocates declaration handles, even word-final", () => {
    const state = runProgram("אה", createInitialState());
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(state.rules).toEqual([]);
  });
});
