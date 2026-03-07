import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("core demo letters", () => {
  it("bet can be first", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    const opened = state.handles.get(state.boundaries[0].id);
    const [head, whole] = String(Array.from(state.head_of)[0] ?? "->").split("->");
    const exposed = state.handles.get(head);
    expect(opened?.meta.openedBy).toBe("ב");
    expect(whole).toBe(state.boundaries[0].id);
    expect(exposed?.meta.exposedBy).toBe("ד");
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
    const [head, whole] = String(Array.from(state.head_of)[0] ?? "->").split("->");
    const exposed = state.handles.get(head);
    expect(state.boundaries.length).toBe(0);
    expect(whole).toBe("Ω");
    expect(exposed?.meta.exposedBy).toBe("ד");
    expect(state.supp.has(`${head}->Ω`)).toBe(true);
  });

  it("dalet can be last", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    expect(state.head_of.size).toBe(1);
    expect(state.supp.size).toBe(1);
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
    const [head] = String(Array.from(state.head_of)[0] ?? "->").split("->");
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(state.head_of.size).toBe(1);
    expect(state.adjuncts[head]).toHaveLength(1);
  });

  it("he can be last", () => {
    const state = runProgram("אה", createInitialState());
    const [head] = String(Array.from(state.head_of)[0] ?? "->").split("->");
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(state.head_of.size).toBe(1);
    expect(state.adjuncts[head]).toHaveLength(1);
    expect(wordOut).toBe(head);
  });
});
