import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest } from "@ref/vm/vm";

describe("shin internal fork selection", () => {
  it("reroutes subsequent Select-from-F to active_child", () => {
    const state = createInitialState();
    const tokens = tokenize("שׂי");
    executeLetterForTest(state, tokens[0], {
      isWordFinal: false,
      wordText: "שׂי",
      prevBoundaryMode: "hard"
    });
    const shinEvent = state.vm.H.find((event) => event.type === "shin");
    const parent = shinEvent?.data?.id as string;
    const activeChild = shinEvent?.data?.active as string;
    executeLetterForTest(state, tokens[1], {
      isWordFinal: true,
      wordText: "שׂי",
      prevBoundaryMode: "hard"
    });
    const outputId = state.vm.F;
    const output = state.handles.get(outputId);

    expect(shinEvent?.data?.direction).toBe("internal");
    expect(state.sub.has(`${parent}->${activeChild}`)).toBe(true);
    expect(output?.meta.seedOf).toBe(activeChild);
    expect(output?.meta.seedOf).not.toBe(parent);
  });
});
