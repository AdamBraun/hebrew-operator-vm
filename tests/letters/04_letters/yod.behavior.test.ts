import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("yod behavior", () => {
  it("creates an entity handle seeded from focus", () => {
    const state = runProgram("י", createInitialState());
    const wordStart = state.vm.H.find((event) => event.type === "WORD_START");
    const seedSource = String(wordStart?.data?.focus ?? "");

    expect(seedSource).not.toBe("");
    const seedHandle = Array.from(state.handles.values()).find(
      (handle) => handle.kind === "entity" && handle.meta?.seedOf === seedSource
    );
    expect(seedHandle).toBeDefined();
    expect(seedHandle?.anchor).toBe(1);
  });
});
