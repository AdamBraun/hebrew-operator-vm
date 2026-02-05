import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("core demo letters", () => {
  it("bet can be first", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(2);
    const opened = state.handles.get(state.boundaries[0].id);
    const closed = state.handles.get(state.boundaries[1].id);
    expect(opened?.meta.openedBy).toBe("ב");
    expect(closed?.meta.closedBy).toBe("ד");
  });

  it("bet can be last", () => {
    const state = runProgram("אב", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);
    expect(boundaryHandle?.meta.openedBy).toBe("ב");
  });

  it("dalet can be first", () => {
    const state = runProgram("דא", createInitialState());
    expect(state.boundaries.length).toBe(1);
    const boundaryHandle = state.handles.get(state.boundaries[0].id);
    expect(boundaryHandle?.meta.closedBy).toBe("ד");
  });

  it("dalet can be last", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    const boundaryHandle = state.handles.get(state.boundaries[1].id);
    expect(boundaryHandle?.meta.closedBy).toBe("ד");
  });

  it("gimel can be first", () => {
    const state = runProgram("גא", createInitialState());
    const bestowLinks = state.links.filter((link) => link.label === "bestow");
    expect(bestowLinks.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
    const bestow = state.vm.H.find((event) => event.type === "bestow");
    expect(bestow).toBeDefined();
  });

  it("gimel can be last", () => {
    const state = runProgram("אג", createInitialState());
    const bestowLinks = state.links.filter((link) => link.label === "bestow");
    expect(bestowLinks.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
    const bestow = state.vm.H.find((event) => event.type === "bestow");
    expect(bestow).toBeDefined();
  });

  it("he can be first", () => {
    const state = runProgram("הא", createInitialState());
    const rules = Array.from(state.handles.values()).filter((handle) => handle.kind === "rule");
    expect(rules.length).toBe(1);
    expect(rules[0].meta.public).toBe(1);
  });

  it("he can be last", () => {
    const state = runProgram("אה", createInitialState());
    const rules = Array.from(state.handles.values()).filter((handle) => handle.kind === "rule");
    expect(rules.length).toBe(1);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(rules[0].id);
  });
});
