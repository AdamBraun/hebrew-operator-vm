import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/state";
import { runProgram } from "../vm/vm";

describe("core demo letters", () => {
  it("bet + dalet closes boundary", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);
    expect(boundaryHandle?.kind).toBe("boundary");
    expect(boundary.inside).not.toBe(boundary.outside);
  });

  it("gimel records a link", () => {
    const state = runProgram("ג", createInitialState());
    expect(state.links.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
  });

  it("he seals a final artifact", () => {
    const state = runProgram("ה", createInitialState());
    const artifacts = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "artifact"
    );
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].policy).toBe("final");
    expect(state.vm.F).toBe(artifacts[0].id);
  });
});
