import { describe, expect, it } from "vitest";
import { createInitialState } from "../state/state";
import { runProgram } from "../vm/vm";

describe("core demo letters", () => {
  it("bet can be first", () => {
    const state = runProgram("בד", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);
    expect(boundaryHandle?.meta.closedBy).toBe("ד");
  });

  it("bet can be last", () => {
    const state = runProgram("אב", createInitialState());
    expect(state.vm.OStack_word.length).toBe(0);
    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);
    expect(boundaryHandle?.meta.closedBy).toBe("space");
    const autoCloseEvents = state.vm.H.filter((event) => event.type === "boundary_auto_close");
    expect(autoCloseEvents.length).toBe(1);
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
    const boundaryHandle = state.handles.get(state.boundaries[0].id);
    expect(boundaryHandle?.meta.closedBy).toBe("ד");
  });

  it("gimel can be first", () => {
    const state = runProgram("גא", createInitialState());
    expect(state.links.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
  });

  it("gimel can be last", () => {
    const state = runProgram("אג", createInitialState());
    expect(state.links.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
  });

  it("he can be first", () => {
    const state = runProgram("הא", createInitialState());
    const artifacts = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "artifact"
    );
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].policy).toBe("final");
  });

  it("he can be last", () => {
    const state = runProgram("אה", createInitialState());
    const artifacts = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "artifact"
    );
    expect(artifacts.length).toBe(1);
    expect(state.vm.F).toBe(artifacts[0].id);
  });
});
