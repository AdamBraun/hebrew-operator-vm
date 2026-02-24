import { describe, expect, it } from "vitest";
import { letterRegistry } from "@ref/letters/registry";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithTrace } from "@ref/vm/vm";

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

const OPERATOR_INPUTS = Array.from(new Set(Object.keys(letterRegistry))).sort();

describe("vm domain/focus mapping", () => {
  it.each(OPERATOR_INPUTS)("keeps D stable for operator %s", (letter) => {
    const initialDomain = "D:test";
    const { trace } = runProgramWithTrace(letter, createStateWithDomain(initialDomain));
    const letterEntry = trace.find((entry) => entry.token === letter);

    expect(letterEntry).toBeDefined();
    expect(letterEntry?.D).toBe(initialDomain);
  });

  it("keeps D stable for bet while preserving domain-carrier metadata", () => {
    const initialDomain = "D:test";
    const state = runProgram("ב", createStateWithDomain(initialDomain));
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);

    expect(state.vm.D).toBe(initialDomain);
    expect(boundaryHandle?.meta.domainCarrier).toBe(1);
  });

  it("letter tokens never change D between adjacent trace entries", () => {
    const { trace } = runProgramWithTrace("ב֣ ל֑ מ־נ", createStateWithDomain("D:test"));
    for (let index = 1; index < trace.length; index += 1) {
      const current = trace[index];
      if (current.token === "□") {
        continue;
      }
      const previous = trace[index - 1];
      expect(current.D).toBe(previous.D);
    }
  });

  it("throws in test builds if an operator mutates D", () => {
    const originalAleph = letterRegistry.א;
    letterRegistry.א = {
      ...originalAleph,
      seal: (S, cons) => {
        const result = originalAleph.seal(S, cons);
        result.S.vm.D = "D:illegal";
        return result;
      }
    };

    try {
      expect(() => runProgram("א", createInitialState())).toThrow(
        /Only boundary\/cantillation transitions may update vm\.D/
      );
    } finally {
      letterRegistry.א = originalAleph;
    }
  });
});
