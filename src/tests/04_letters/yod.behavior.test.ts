import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("yod behavior", () => {
  it("creates an entity handle seeded from focus", () => {
    const state = runProgram("י", createInitialState());
    const seedHandle = Array.from(state.handles.values()).find(
      (handle) => handle.kind === "entity" && handle.meta?.seedOf === state.vm.Omega
    );
    expect(seedHandle).toBeDefined();
  });
});
