import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

const MAPIQ_CASES = ["יָהּ", "לָהּ", "שְׁמָהּ", "בְּיָדָהּ", "אָרְכָּהּ"];

describe("mappiq vs final he behavior", () => {
  it.each(MAPIQ_CASES)("final he with mappiq exports a pinned handle (%s)", (word) => {
    const state = runProgram(word, createInitialState());
    const wordOut = state.vm.A[state.vm.A.length - 1];
    const out = state.handles.get(wordOut);
    expect(out?.meta.he_mode).toBe("pinned");
    expect(out?.meta.seedOf).toBeTypeOf("string");
    const declaration = state.handles.get(out?.meta.seedOf as string);
    expect(declaration?.kind).toBe("rule");
  });

  it("final he without mappiq applies breath tail and allocates no declaration handle", () => {
    const dotted = runProgram("לָהּ", createInitialState());
    const plain = runProgram("לָה", createInitialState());

    const dottedRules = Array.from(dotted.handles.values()).filter(
      (handle) => handle.kind === "rule"
    );
    const plainRules = Array.from(plain.handles.values()).filter(
      (handle) => handle.kind === "rule"
    );
    expect(dottedRules.length).toBeGreaterThan(0);
    expect(plainRules.length).toBe(0);

    const plainOut = plain.vm.A[plain.vm.A.length - 1];
    const plainHandle = plain.handles.get(plainOut);
    expect(plainHandle?.meta.he_mode).toBe("breath");
    expect(plainHandle?.meta.final_tail).toBe("breath");
  });
});
