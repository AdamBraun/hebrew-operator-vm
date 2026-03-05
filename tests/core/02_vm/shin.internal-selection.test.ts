import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest } from "@ref/vm/vm";

describe("shin internal fork selection", () => {
  it("keeps direct carry on the selected focus while preserving internal sub ports", () => {
    const state = createInitialState();
    const tokens = tokenize("שׂנ");
    executeLetterForTest(state, tokens[0], {
      isWordFinal: false,
      wordText: "שׂנ",
      prevBoundaryMode: "hard"
    });
    const shinEvent = state.vm.H.find((event) => event.type === "shin");
    const parent = shinEvent?.data?.focus as string;
    const ports = [shinEvent?.data?.spine, shinEvent?.data?.left, shinEvent?.data?.right].map(
      (id) => String(id)
    );
    executeLetterForTest(state, tokens[1], {
      isWordFinal: true,
      wordText: "שׂנ",
      prevBoundaryMode: "hard"
    });
    const childId = state.vm.F;
    const child = state.handles.get(childId);

    expect(shinEvent?.data?.direction).toBe("internal");
    for (const port of ports) {
      expect(state.sub.has(`${parent}->${port}`)).toBe(true);
      expect(state.carry.has(`${port}->${childId}`)).toBe(false);
    }
    expect(state.carry.has(`${parent}->${childId}`)).toBe(true);
    expect(child?.meta.succOf).toBe(parent);
  });
});
