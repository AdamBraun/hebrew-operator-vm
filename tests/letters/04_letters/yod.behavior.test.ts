import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("yod behavior", () => {
  it("creates a pinned entity handle seeded from focus", () => {
    const state = runProgram("י", createInitialState());
    const seedHandle = Array.from(state.handles.values()).find(
      (handle) =>
        handle.kind === "entity" &&
        handle.meta?.port === "interface" &&
        typeof handle.meta?.seedOf === "string"
    );
    expect(seedHandle).toBeDefined();
    expect(seedHandle?.anchor).toBe(1);
    expect(seedHandle?.pinned).toBe(true);
    expect(seedHandle?.meta?.pinned).toBe(true);
    expect(typeof seedHandle?.meta?.seedOf).toBe("string");
  });
});
