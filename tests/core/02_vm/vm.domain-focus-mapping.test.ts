import { describe, expect, it } from "vitest";
import { createTokenDispatcher } from "@ref/dispatch/dispatcher";
import { letterRegistry } from "@ref/letters/registry";
import { BOT_ID, createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithTrace } from "@ref/vm/vm";

function createStateWithDomain(domainId: string) {
  const state = createInitialState();
  state.handles.set(domainId, createHandle(domainId, "scope"));
  state.vm = {
    ...state.vm,
    D: domainId,
    F: domainId,
    R: BOT_ID,
    K: [domainId, BOT_ID],
    wordEntryFocus: domainId
  };
  return state;
}

const OPERATOR_INPUTS = Array.from(new Set(Object.keys(letterRegistry))).sort();

function createSingleAlephDispatcher() {
  return createTokenDispatcher({
    schema_version: 1,
    source: { registry_path: "test", registry_sha256: null },
    semantics: {
      definitions_path: "test",
      schema_version: null,
      semver: "0.0.0-test",
      definitions_sha256: "test"
    },
    compile_policy: {
      illegal_combinations: "error",
      unknown_marks: "error",
      orthographic_noise: "strip"
    },
    stats: {
      tokens_total: 1,
      warning_count: 0,
      warning_by_code: {}
    },
    tokens: {
      "1": {
        token_id: 1,
        signature: "BASE=א|MARKS=NONE",
        base: "א",
        count: 1,
        op_family: "א",
        modifiers: [],
        raw_marks: [],
        derived: {
          rosh: [],
          toch: [],
          sof: [],
          dot_kind: "none",
          inside_dot_kind: "none",
          modes: [],
          ignored_marks: []
        },
        execution_plan: [],
        event_contract: [],
        warnings: [],
        runtime: {
          token_letter: "א",
          read_letter: "א",
          shape_letter: null,
          shape_effect_scope: null,
          rosh_branch: null,
          letter_mode_forced: null,
          has_shuruk: false,
          should_harden: false,
          sof_modifiers: []
        }
      }
    }
  });
}

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
        result.S.vm = { ...result.S.vm, D: "D:illegal" };
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

  it("throws in test builds if a dispatched operator mutates D", () => {
    const dispatcher = createSingleAlephDispatcher();
    const originalAleph = letterRegistry.א;
    letterRegistry.א = {
      ...originalAleph,
      seal: (S, cons) => {
        const result = originalAleph.seal(S, cons);
        result.S.vm = { ...result.S.vm, D: "D:illegal" };
        return result;
      }
    };

    try {
      expect(() => dispatcher.apply(1, createInitialState(), { isWordFinal: true })).toThrow(
        /Only boundary\/cantillation transitions may update vm\.D/
      );
    } finally {
      letterRegistry.א = originalAleph;
    }
  });
});
