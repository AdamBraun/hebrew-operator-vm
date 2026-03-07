import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { createInitialState, serializeState } from "@ref/state/state";
import { selectCurrentFocus } from "@ref/vm/select";
import { executeLetterForTest, runProgram } from "@ref/vm/vm";

function executeHeadWithAdjuncts(letter: "ד" | "ר", exportedAdjuncts: unknown) {
  const state = createInitialState();
  const [token] = tokenize(letter);
  if (!token) {
    throw new Error(`Missing token for ${letter}`);
  }
  token.meta = {
    ...(token.meta ?? {}),
    exported_adjuncts: exportedAdjuncts
  };
  executeLetterForTest(state, token, {
    wordText: letter,
    isWordFinal: true,
    prevBoundaryMode: "hard"
  });
  return state;
}

describe("head adjunct export", () => {
  it("exports a detached resh adjunct without moving focus off the head", () => {
    const state = executeHeadWithAdjuncts("ר", true);
    const head = state.vm.F;
    const adjuncts = state.adjuncts[head] ?? [];
    const [adjunct] = adjuncts;
    const select = selectCurrentFocus(state);
    const headEvent = state.vm.H.find((event) => event.type === "head_expose");
    const json = serializeState(state) as {
      adjuncts?: Record<string, string[]>;
    };

    expect(adjuncts).toEqual([adjunct]);
    expect(adjunct).not.toBe(head);
    expect(state.handles.has(adjunct)).toBe(true);
    expect(state.sub.has(`${head}->${adjunct}`)).toBe(true);
    expect(state.vm.K[state.vm.K.length - 1]).toBe(head);
    expect(state.vm.K.includes(adjunct)).toBe(false);
    expect(state.vm.F).toBe(head);
    expect(select.ops.prefs.exported_adjuncts).toEqual([adjunct]);
    expect(select.ops.prefs.selection_targets).toContain(adjunct);
    expect(headEvent?.data).toMatchObject({
      id: head,
      whole: "Ω",
      adjuncts: [adjunct]
    });
    expect(json.adjuncts).toEqual({ [head]: [adjunct] });
  });

  it("allows dalet to export multiple adjunct legs while keeping backed-head behavior", () => {
    const state = executeHeadWithAdjuncts("ד", 2);
    const head = state.vm.F;
    const adjuncts = state.adjuncts[head] ?? [];
    const select = selectCurrentFocus(state);
    const headEvent = state.vm.H.find((event) => event.type === "head_backed");

    expect(adjuncts).toHaveLength(2);
    expect(new Set(adjuncts).size).toBe(2);
    expect(state.vm.F).toBe(head);
    expect(state.supp.has(`${head}->Ω`)).toBe(true);
    expect(select.ops.prefs.exported_adjuncts).toEqual(adjuncts);
    expect(select.ops.prefs.selection_targets).toEqual(adjuncts);
    expect(headEvent?.data).toMatchObject({
      id: head,
      whole: "Ω",
      adjuncts
    });
    for (const adjunct of adjuncts) {
      expect(state.handles.has(adjunct)).toBe(true);
      expect(state.sub.has(`${head}->${adjunct}`)).toBe(true);
    }
  });

  it("leaves adjunct state empty when no export is requested", () => {
    const state = runProgram("ר", createInitialState());
    const json = serializeState(state) as {
      adjuncts?: Record<string, string[]>;
    };

    expect(state.adjuncts).toEqual({});
    expect(json.adjuncts).toBeUndefined();
  });
});
