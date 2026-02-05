import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { RuntimeError } from "@ref/vm/errors";
import { finalPeOp } from "@ref/letters/finalPe";
import { peOp } from "@ref/letters/pe";

describe("final pe behavior", () => {
  it("closes an open utterance", () => {
    const state = createInitialState();
    const source = "source";
    const payload = "payload";
    state.handles.set(source, createHandle(source, "scope"));
    state.handles.set(payload, createHandle(payload, "scope"));

    const { cons } = peOp.bound(state, { args: [source, payload], prefs: {} });
    const { h } = peOp.seal(state, cons);

    const { cons: finalCons } = finalPeOp.bound(state, { args: [h], prefs: {} });
    finalPeOp.seal(state, finalCons);

    const rule = state.handles.get(h);
    expect(rule?.policy).toBe("final");
    expect(rule?.meta.closed).toBe(1);
    expect(state.vm.H.some((event) => event.type === "utter_close")).toBe(true);
  });

  it("throws when no open utterance is present", () => {
    const state = createInitialState();
    const notRule = "notRule";
    state.handles.set(notRule, createHandle(notRule, "scope"));
    expect(() => finalPeOp.bound(state, { args: [notRule], prefs: {} })).toThrow(RuntimeError);
  });
});
