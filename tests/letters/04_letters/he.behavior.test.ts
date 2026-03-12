import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { selectCurrentFocus, selectExportedAdjunctsOfCurrentFocus } from "@ref/vm/select";
import { executeLetterForTest, runProgram, runProgramWithDeepTrace } from "@ref/vm/vm";

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

function executeHeOnOrdinaryFocus() {
  const state = createInitialState();
  const [token] = tokenize("ה");
  if (!token) {
    throw new Error("Missing token for ה");
  }

  state.handles.set("X", createHandle("X", "scope"));
  state.vm.F = "X";
  state.vm.K = ["X", BOT_ID];
  state.vm.R = BOT_ID;
  state.vm.wordHasContent = true;
  state.vm.activeConstruct = "C:mid";

  executeLetterForTest(state, token, {
    wordText: "אה",
    isWordFinal: false,
    prevBoundaryMode: "hard"
  });

  return state;
}

describe("he behavior", () => {
  it("at word start builds a resolved head with a detached exported leg from the ambient", () => {
    const { state, snapshot, selectArgs, events } = heExitSnapshot("ה");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, source] = headOfEdge.split("->");
    const [leg = ""] = snapshot.adjuncts?.[head] ?? [];
    const legHandle = state.handles.get(leg);
    const headEvent = events.find((event) => event.type === "head_with_leg");

    expect(selectArgs).toEqual(["Ω"]);
    expect(source).toBe("Ω");
    expect(leg.length).toBeGreaterThan(0);
    expect(snapshot.head_of).toEqual([`${head}->Ω`]);
    expect(snapshot.carry).toEqual([]);
    expect(snapshot.cont).toContain(`Ω->${head}`);
    expect(snapshot.cont).toContain(`${head}->${leg}`);
    expect(snapshot.supp).toEqual([`${head}->Ω`, `${leg}->${head}`]);
    expect(snapshot.sub).toEqual([`${head}->${leg}`]);
    expect(snapshot.vm?.F).toBe(head);
    expect(legHandle?.meta?.handle_label).toBe("detached_adjunct_leg");
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
      focus: head,
      adjunct: leg,
      adjunct_label: "detached_adjunct_leg",
      exported_adjuncts: [leg],
      resolved: true
    });
    expect(headEvent?.data?.edges).toEqual([
      { kind: "head_of", from: head, to: "Ω" },
      { kind: "cont", from: "Ω", to: head },
      { kind: "supp", from: head, to: "Ω" },
      { kind: "cont", from: head, to: leg },
      { kind: "supp", from: leg, to: head }
    ]);
  });

  it("mid-word selects the current construct and still ends focus on the new head", () => {
    const { state, snapshot, selectArgs, events } = heExitSnapshot("נה");
    const head = String(snapshot.vm?.F ?? "");
    const [headOfEdge = "->"] = snapshot.head_of ?? [];
    const [, source] = headOfEdge.split("->");
    const [leg = ""] = snapshot.adjuncts?.[head] ?? [];
    const headEvent = events.find((event) => event.type === "head_with_leg");

    expect(selectArgs).toEqual(["נ:1:1"]);
    expect(source).toBe("נ:1:1");
    expect(snapshot.carry ?? []).not.toContain(`${head}->${leg}`);
    expect(snapshot.carry ?? []).not.toContain(`נ:1:1->${head}`);
    expect(snapshot.cont).toContain(`נ:1:1->${head}`);
    expect(snapshot.cont).toContain(`${head}->${leg}`);
    expect(snapshot.supp).toContain(`${head}->נ:1:1`);
    expect(snapshot.supp).toContain(`${leg}->${head}`);
    expect(snapshot.sub).toContain(`${head}->${leg}`);
    expect(snapshot.vm?.F).toBe(head);
    expect(state.handles.get(leg)?.meta?.handle_label).toBe("detached_adjunct_leg");
    expect(headEvent?.data).toMatchObject({
      source: "נ:1:1",
      head,
      focus: head,
      adjunct: leg,
      adjunct_label: "detached_adjunct_leg"
    });
  });

  it("keeps the exported leg selectable without introducing any carry edge", () => {
    const state = executeHeOnOrdinaryFocus();
    const head = state.vm.F;
    const [leg = ""] = state.adjuncts[head] ?? [];
    const focusSelect = selectCurrentFocus(state);
    const adjunctSelect = selectExportedAdjunctsOfCurrentFocus(state);

    expect(leg.length).toBeGreaterThan(0);
    expect(Array.from(state.carry)).toEqual([]);
    expect(focusSelect.ops.args).toEqual([head]);
    expect(focusSelect.ops.prefs.exported_adjuncts).toEqual([leg]);
    expect(focusSelect.ops.prefs.selection_targets).toContain(leg);
    expect(adjunctSelect.ops.args).toEqual([leg]);
    expect(adjunctSelect.ops.prefs.exported_adjuncts).toEqual([leg]);
    expect(adjunctSelect.ops.prefs.selection_targets).toContain(leg);
  });

  it("never allocates declaration handles, even word-final", () => {
    const state = runProgram("אה", createInitialState());
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(state.rules).toEqual([]);
  });
});
