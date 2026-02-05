import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("yod behavior", () => {
  it("creates an entity handle seeded from focus", () => {
    const state = runProgram("י", createInitialState());
    const seedHandle = Array.from(state.handles.values()).find(
      (handle) => handle.kind === "entity" && handle.meta?.seedOf === state.vm.Omega
    );
    expect(seedHandle).toBeDefined();
    expect(seedHandle?.anchor).toBe(1);
  });
});
