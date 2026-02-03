import { describe, expect, it } from "vitest";
import { BOT_ID, createHandle } from "../../state/handles";
import { samekhOp } from "../../letters/samekh";
import { addCont } from "../../state/relations";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("samekh behavior", () => {
  it("stabilizes focus (framed_lock)", () => {
    const state = runProgram("נס", createInitialState());
    const focus = state.handles.get(state.vm.F);
    expect(focus?.policy).toBe("framed_lock");
  });

  it("discharges SUPPORT only when child <=cont* F", () => {
    const state = createInitialState();
    const parent = state.vm.F;
    const child = "child";
    const other = "other";

    state.handles.set(child, createHandle(child, "scope"));
    state.handles.set(other, createHandle(other, "scope"));
    addCont(state, parent, other);

    state.vm.OStack_word.push({
      kind: "SUPPORT",
      parent,
      child,
      payload: {},
      tau_created: state.vm.tau
    });

    const select1 = samekhOp.select(state);
    const bound1 = samekhOp.bound(select1.S, select1.ops);
    samekhOp.seal(bound1.S, bound1.cons);
    expect(state.vm.OStack_word.length).toBe(1);
    expect(state.vm.H.find((event) => event.type === "support")).toBeUndefined();

    addCont(state, parent, child);
    state.vm.F = child;
    state.vm.OStack_word.push({
      kind: "SUPPORT",
      parent,
      child,
      payload: {},
      tau_created: state.vm.tau
    });
    const select2 = samekhOp.select(state);
    const bound2 = samekhOp.bound(select2.S, select2.ops);
    samekhOp.seal(bound2.S, bound2.cons);
    expect(state.vm.H.find((event) => event.type === "support")).toBeDefined();
    expect(state.vm.R).toBe(BOT_ID);
  });
});
