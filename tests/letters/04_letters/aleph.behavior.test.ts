import { describe, expect, it } from "vitest";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { alephOp } from "@ref/letters/aleph";

describe("aleph behavior", () => {
  it("anchors the first aleph in a word to a fresh construct", () => {
    const state = createInitialState();

    const entryFocus = state.vm.wordEntryFocus ?? state.vm.F;
    const { cons } = alephOp.bound(state, { args: [entryFocus], prefs: {} });
    const { h } = alephOp.seal(state, cons);

    const construct = state.handles.get(h);
    expect(construct?.kind).toBe("scope");
    expect(construct?.meta.seededBy).toBe("א");

    const aliasEvent = state.vm.H.find((event) => event.type === "alias");
    expect(aliasEvent).toBeDefined();
    const aliasHandle = state.handles.get(String(aliasEvent?.data?.id));
    expect(aliasHandle?.kind).toBe("alias");
    expect(aliasHandle?.meta.left).toBe(entryFocus);
    expect(aliasHandle?.meta.right).toBe(h);
    expect(
      state.links.some(
        (link) => link.from === entryFocus && link.to === h && link.label === "transport"
      )
    ).toBe(true);
    expect(
      state.links.some(
        (link) => link.from === h && link.to === entryFocus && link.label === "transport"
      )
    ).toBe(true);
  });

  it("keeps the current construct when aleph appears mid-word", () => {
    const state = createInitialState();
    const entryFocus = "entry";
    const current = "current";
    state.handles.set(entryFocus, createHandle(entryFocus, "scope"));
    state.handles.set(current, createHandle(current, "scope"));

    state.vm.wordEntryFocus = entryFocus;
    state.vm.F = current;
    state.vm.R = BOT_ID;
    state.vm.K = [entryFocus, BOT_ID, current];

    const before = state.handles.size;
    const { cons } = alephOp.bound(state, { args: [entryFocus], prefs: {} });
    const { h } = alephOp.seal(state, cons);

    expect(h).toBe(current);
    expect(state.handles.size).toBe(before + 1);
    const aliasEvents = state.vm.H.filter((event) => event.type === "alias");
    const aliasEvent = aliasEvents[aliasEvents.length - 1];
    expect(aliasEvent?.data.left).toBe(entryFocus);
    expect(aliasEvent?.data.right).toBe(current);
  });
});
