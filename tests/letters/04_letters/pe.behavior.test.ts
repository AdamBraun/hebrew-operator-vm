import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { peOp } from "@ref/letters/pe";

describe("pe behavior", () => {
  it("creates an open utterance rule handle", () => {
    const state = createInitialState();
    const source = "source";
    const payload = "payload";
    const target = "target";
    state.handles.set(source, createHandle(source, "scope"));
    state.handles.set(payload, createHandle(payload, "scope"));
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = peOp.bound(state, { args: [source, payload, target], prefs: {} });
    const { h } = peOp.seal(state, cons);

    const rule = state.handles.get(h);
    expect(rule?.kind).toBe("rule");
    expect(rule?.meta.open_utterance).toBe(1);
    expect(state.rules.some((entry) => entry.id === h)).toBe(true);
    expect(state.vm.H.some((event) => event.type === "utter")).toBe(true);
  });
});
