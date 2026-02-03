import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("metamorphic properties", () => {
  it("adding whitespace introduces boundary effects", () => {
    const noSpace = runProgram("נס", createInitialState());
    const withSpace = runProgram("נ ס", createInitialState());
    expect(noSpace.vm.H.find((event) => event.type === "fall")).toBeUndefined();
    expect(withSpace.vm.H.find((event) => event.type === "fall")).toBeDefined();
  });

  it("multiple spaces collapse to one", () => {
    const one = runProgram("נ ס", createInitialState());
    const many = runProgram("נ   ס", createInitialState());
    expect(serializeState(one)).toEqual(serializeState(many));
  });

  it("prefix/suffix whitespace behaves like extra boundaries", () => {
    const plain = runProgram("נ", createInitialState());
    const spaced = runProgram("  נ  ", createInitialState());
    const plainFalls = plain.vm.H.filter((event) => event.type === "fall");
    const spacedFalls = spaced.vm.H.filter((event) => event.type === "fall");
    expect(plainFalls.length).toBe(1);
    expect(spacedFalls.length).toBe(1);
    expect(plainFalls[0].data.parent).toBe("Ω");
    expect(spacedFalls[0].data.parent).toBe("Ω");
  });
});
