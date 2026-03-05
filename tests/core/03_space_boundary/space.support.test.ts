import { describe, expect, it } from "vitest";
import { isCarryResolved, isCarryUnresolved } from "@ref/state/eff";
import { OMEGA_ID, createHandle } from "@ref/state/handles";
import { samekhOp } from "@ref/letters/samekh";
import { addCarry } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { applySpace } from "@ref/vm/space";
import { runProgram } from "@ref/vm/vm";

describe("space boundary carry resolution", () => {
  it("nun followed by boundary does not emit fall", () => {
    const state = runProgram("נ", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
  });

  it("nun + samekh in same word does not fall", () => {
    const state = runProgram("נס", createInitialState());
    const falls = state.vm.H.filter((event) => event.type === "fall");
    expect(falls.length).toBe(0);
  });

  it("hard boundary closes all unresolved carries in the current chunk and marks terminal boundary", () => {
    const state = createInitialState();
    const root = OMEGA_ID;
    const mid = "mid";
    const terminal = "terminal";
    state.handles.set(mid, createHandle(mid, "scope", { meta: { succOf: root } }));
    state.handles.set(terminal, createHandle(terminal, "scope", { meta: { succOf: mid } }));
    addCarry(state, root, mid);
    addCarry(state, mid, terminal);
    state.vm.F = terminal;
    state.vm.wordHasContent = true;

    expect(state.carry.has(`${root}->${mid}`)).toBe(true);
    expect(state.carry.has(`${mid}->${terminal}`)).toBe(true);
    expect(state.supp.size).toBe(0);

    applySpace(state, { mode: "hard" });

    expect(state.supp.has(`${terminal}->${mid}`)).toBe(true);
    expect(state.supp.has(`${terminal}->${root}`)).toBe(true);
    expect(isCarryResolved(state, root, mid, { focusNodeId: terminal })).toBe(true);
    expect(isCarryResolved(state, mid, terminal, { focusNodeId: terminal })).toBe(true);
    expect(state.handles.get(terminal)?.meta?.chunk_commit_boundary).toBe(1);
  });

  it.each([
    ["glue", "conj"],
    ["glue_maqqef", "maqqef"]
  ] as const)(
    "boundary mode %s keeps open carries unresolved and unmarked",
    (mode, joinStrength) => {
      const state = createInitialState();
      const root = OMEGA_ID;
      const terminal = "terminal";
      state.handles.set(terminal, createHandle(terminal, "scope", { meta: { succOf: root } }));
      addCarry(state, root, terminal);
      state.vm.F = terminal;
      state.vm.wordHasContent = true;

      applySpace(state, { mode });

      expect(state.supp.size).toBe(0);
      expect(isCarryUnresolved(state, root, terminal, { focusNodeId: terminal })).toBe(true);
      expect(state.handles.get(terminal)?.meta?.chunk_commit_boundary).not.toBe(1);
      expect(state.vm.PendingJoin?.left_span_handle).toBe(terminal);
      expect(state.vm.PendingJoin?.join_strength).toBe(joinStrength);
    }
  );

  it("samekh in word 2 can close an unresolved carry across glue", () => {
    const state = createInitialState();
    const root = OMEGA_ID;
    const terminal = "terminal";
    state.handles.set(terminal, createHandle(terminal, "scope", { meta: { succOf: root } }));
    addCarry(state, root, terminal);
    state.vm.F = terminal;
    state.vm.wordHasContent = true;

    expect(state.carry.has(`${root}->${terminal}`)).toBe(true);
    expect(isCarryUnresolved(state, root, terminal, { focusNodeId: terminal })).toBe(true);

    applySpace(state, { mode: "glue" });
    expect(state.supp.size).toBe(0);

    const { S, ops } = samekhOp.select(state);
    const { cons } = samekhOp.bound(S, ops);
    samekhOp.seal(state, cons);

    expect(state.supp.has(`${terminal}->${root}`)).toBe(true);
    expect(isCarryResolved(state, root, terminal, { focusNodeId: terminal })).toBe(true);
  });
});
