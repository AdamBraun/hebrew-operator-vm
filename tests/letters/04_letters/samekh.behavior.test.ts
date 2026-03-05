import { describe, expect, it } from "vitest";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { samekhOp } from "@ref/letters/samekh";
import { addCarry, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("samekh behavior", () => {
  it("adds supp(F, s) for nearest unresolved carry and does not lock focus", () => {
    const state = runProgram("נס", createInitialState());
    const child = String(state.vm.A[state.vm.A.length - 1] ?? "");
    const parent = String(state.handles.get(child)?.meta?.succOf ?? "");
    const focus = state.handles.get(child);

    expect(parent.length).toBeGreaterThan(0);
    expect(state.supp.has(`${child}->${parent}`)).toBe(true);
    expect(focus?.policy).toBe("soft");
    expect(focus?.meta?.samekh_lock).toBeUndefined();
    expect(state.vm.H.find((event) => event.type === "support")).toBeUndefined();
  });

  it("closes the nearest unresolved carry and leaves already-resolved chains unchanged", () => {
    const state = createInitialState();
    seedNodes(state, ["s0", "s1", "t0", "t1"]);

    addCarry(state, "s0", "t0");
    addCarry(state, "t0", "t1");
    state.vm.F = "t1";

    const { S, ops } = samekhOp.select(state);
    const { cons } = samekhOp.bound(S, ops);
    samekhOp.seal(state, cons);

    expect(state.supp.has("t1->t0")).toBe(true);
    expect(state.supp.has("t1->s0")).toBe(false);

    const beforeSuppSize = state.supp.size;
    addSupp(state, "t0", "s0");
    state.vm.F = "t0";
    const select2 = samekhOp.select(state);
    const bound2 = samekhOp.bound(select2.S, select2.ops);
    samekhOp.seal(bound2.S, bound2.cons);

    expect(state.supp.size).toBe(beforeSuppSize + 1);
    expect(state.vm.R).toBe(BOT_ID);
  });
});

function seedNodes(state: ReturnType<typeof createInitialState>, ids: string[]): void {
  for (const id of ids) {
    if (!state.handles.has(id)) {
      state.handles.set(id, createHandle(id, "scope"));
    }
  }
}
