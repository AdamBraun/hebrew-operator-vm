import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { createInitialState } from "@ref/state/state";
import {
  resolveExportedAdjunctsOfCurrentFocus,
  resolveMostRecentExportedAdjunctOfCurrentFocus,
  selectCurrentFocus,
  selectExportedAdjunctsOfCurrentFocus
} from "@ref/vm/select";
import { executeLetterForTest } from "@ref/vm/vm";

function executeSingleLetter(letter: string, meta?: Record<string, any>) {
  const state = createInitialState();
  const [token] = tokenize(letter);
  if (!token) {
    throw new Error(`Missing token for ${letter}`);
  }
  if (meta) {
    token.meta = { ...(token.meta ?? {}), ...meta };
  }
  executeLetterForTest(state, token, {
    wordText: letter,
    isWordFinal: true,
    prevBoundaryMode: "hard"
  });
  return state;
}

describe("exported adjunct selection", () => {
  it.each(["ה", "ק"] as const)(
    "keeps the head as default focus while exposing the detached leg for later selection (%s)",
    (letter) => {
      const state = executeSingleLetter(letter);
      const head = state.vm.F;
      const [leg = ""] = resolveExportedAdjunctsOfCurrentFocus(state);
      const focusSelect = selectCurrentFocus(state);
      const adjunctSelect = selectExportedAdjunctsOfCurrentFocus(state);

      expect(head.length).toBeGreaterThan(0);
      expect(leg.length).toBeGreaterThan(0);
      expect(state.adjuncts[head]).toEqual([leg]);
      expect(focusSelect.ops.args).toEqual([head]);
      expect(focusSelect.ops.prefs.exported_adjuncts).toEqual([leg]);
      expect(focusSelect.ops.prefs.selection_targets).toContain(leg);
      expect(Object.keys(focusSelect.ops.prefs).sort()).toEqual([
        "exported_adjuncts",
        "selection_targets"
      ]);
      expect(resolveExportedAdjunctsOfCurrentFocus(state)).toEqual([leg]);
      expect(resolveMostRecentExportedAdjunctOfCurrentFocus(state)).toBe(leg);
      expect(adjunctSelect.ops.args).toEqual([leg]);
      expect(adjunctSelect.ops.prefs.exported_adjuncts).toEqual([leg]);
      expect(adjunctSelect.ops.prefs.selection_targets).toContain(leg);
      expect(adjunctSelect.ops.prefs.declared).toBeUndefined();
      expect(adjunctSelect.ops.prefs.public_handles).toBeUndefined();
      expect(state.vm.F).toBe(head);
    }
  );

  it("supports deterministic most-recent adjunct selection when multiple adjuncts are exported", () => {
    const state = executeSingleLetter("ד", { exported_adjuncts: 2 });
    const [first = "", second = ""] = resolveExportedAdjunctsOfCurrentFocus(state);

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(selectExportedAdjunctsOfCurrentFocus(state).ops.args).toEqual([first, second]);
    expect(
      selectExportedAdjunctsOfCurrentFocus(state, { recency: "most_recent" }).ops.args
    ).toEqual([second]);
    expect(resolveMostRecentExportedAdjunctOfCurrentFocus(state)).toBe(second);
  });

  it("leaves non-adjunct words unaffected", () => {
    const state = executeSingleLetter("א");
    const focusSelect = selectCurrentFocus(state);
    const adjunctSelect = selectExportedAdjunctsOfCurrentFocus(state);

    expect(resolveExportedAdjunctsOfCurrentFocus(state)).toEqual([]);
    expect(resolveMostRecentExportedAdjunctOfCurrentFocus(state)).toBeNull();
    expect(adjunctSelect.ops.args).toEqual([]);
    expect(focusSelect.ops.args).toEqual([state.vm.F]);
    expect(focusSelect.ops.prefs.exported_adjuncts).toBeUndefined();
    expect(focusSelect.ops.prefs.selection_targets).toBeUndefined();
  });
});
