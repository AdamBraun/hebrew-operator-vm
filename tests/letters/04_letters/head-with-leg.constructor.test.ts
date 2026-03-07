import { describe, expect, it } from "vitest";
import { exposeHeadWithLeg } from "@ref/letters/headAdjunct";
import { createHandle, BOT_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

function seedSourceState() {
  const state = createInitialState();
  state.handles.set("X", createHandle("X", "scope"));
  state.vm.F = "X";
  state.vm.K = ["X", BOT_ID];
  state.vm.wordEntryFocus = "X";
  return state;
}

describe("exposeHeadWithLeg", () => {
  it("builds the resolved head-plus-leg topology and exports the leg", () => {
    const state = seedSourceState();
    const focusBefore = state.vm.F;
    const { head, leg } = exposeHeadWithLeg(state, { source: "X", resolved: true });

    expect(head).not.toBe(leg);
    expect(state.handles.has(head)).toBe(true);
    expect(state.handles.has(leg)).toBe(true);
    expect(state.head_of).toEqual(new Set([`${head}->X`]));
    expect(state.carry).toEqual(new Set([`X->${head}`, `${head}->${leg}`]));
    expect(state.cont).toEqual(new Set([`X->${head}`, `${head}->${leg}`]));
    expect(state.supp).toEqual(new Set([`${head}->X`, `${leg}->${head}`]));
    expect(state.sub).toEqual(new Set([`${head}->${leg}`]));
    expect(state.adjuncts).toEqual({ [head]: [leg] });
    expect(state.carry.has(`X->${leg}`)).toBe(false);
    expect(state.cont.has(`X->${leg}`)).toBe(false);
    expect(state.links).toEqual([]);
    expect(state.boundaries).toEqual([]);
    expect(state.rules).toEqual([]);
    expect(state.vm.F).toBe(focusBefore);
    expect(state.vm.F).not.toBe(leg);
  });

  it("builds the unresolved head-plus-leg topology without supp edges", () => {
    const state = seedSourceState();
    const focusBefore = state.vm.F;
    const { head, leg } = exposeHeadWithLeg(state, { source: "X", resolved: false });

    expect(head).not.toBe(leg);
    expect(state.handles.has(head)).toBe(true);
    expect(state.handles.has(leg)).toBe(true);
    expect(state.head_of).toEqual(new Set([`${head}->X`]));
    expect(state.carry).toEqual(new Set([`X->${head}`, `${head}->${leg}`]));
    expect(state.cont).toEqual(new Set([`X->${head}`, `${head}->${leg}`]));
    expect(state.supp).toEqual(new Set());
    expect(state.sub).toEqual(new Set([`${head}->${leg}`]));
    expect(state.adjuncts).toEqual({ [head]: [leg] });
    expect(state.carry.has(`X->${leg}`)).toBe(false);
    expect(state.cont.has(`X->${leg}`)).toBe(false);
    expect(state.links).toEqual([]);
    expect(state.boundaries).toEqual([]);
    expect(state.rules).toEqual([]);
    expect(state.vm.F).toBe(focusBefore);
    expect(state.vm.F).not.toBe(leg);
  });
});
