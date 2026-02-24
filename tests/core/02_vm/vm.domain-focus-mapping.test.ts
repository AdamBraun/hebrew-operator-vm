import { describe, expect, it } from "vitest";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

const NON_REFRAMING_LETTERS = ["ל", "מ", "ם", "י", "כ", "ד", "ר"] as const;

function createStateWithDomain(domainId: string) {
  const state = createInitialState();
  state.handles.set(domainId, createHandle(domainId, "scope"));
  state.vm.D = domainId;
  state.vm.F = domainId;
  state.vm.R = BOT_ID;
  state.vm.K = [domainId, BOT_ID];
  state.vm.wordEntryFocus = domainId;
  return state;
}

describe("vm domain/focus mapping", () => {
  it.each(NON_REFRAMING_LETTERS)("keeps D stable for non-reframing letter %s", (letter) => {
    const initialDomain = "D:test";
    const state = runProgram(letter, createStateWithDomain(initialDomain));
    expect(state.vm.D).toBe(initialDomain);
  });

  it("reframes D for bet at word-entry baseline", () => {
    const initialDomain = "D:test";
    const state = runProgram("ב", createStateWithDomain(initialDomain));
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);

    expect(state.vm.D).toBe(boundary.id);
    expect(state.vm.D).not.toBe(initialDomain);
    expect(boundaryHandle?.meta.domainCarrier).toBe(1);
  });

  it("does not reframe D on repeated bet deepening within the same word", () => {
    const state = runProgram("בב", createInitialState());
    expect(state.boundaries.length).toBe(2);

    const [first, second] = state.boundaries;
    const secondHandle = state.handles.get(second.id);
    expect(state.vm.D).toBe(first.id);
    expect(state.vm.D).not.toBe(second.id);
    expect(secondHandle?.meta.domainCarrier).toBe(0);
  });
});
