import { describe, expect, it } from "vitest";
import { addCarry, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";

describe("edge types", () => {
  it("addCarry inserts carry(source,target) and matching cont(source,target)", () => {
    const state = createInitialState();
    addCarry(state, "a", "b");

    expect(state.cont.has("a->b")).toBe(true);
    expect(state.carry.has("a->b")).toBe(true);
    expect(state.supp.size).toBe(0);
  });

  it("addSupp inserts a back-edge supp(closer,origin)", () => {
    const state = createInitialState();
    addSupp(state, "closer", "origin");

    expect(state.supp.has("closer->origin")).toBe(true);
    expect(state.cont.size).toBe(0);
    expect(state.carry.size).toBe(0);
  });
});
