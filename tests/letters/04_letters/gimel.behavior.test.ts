import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("gimel behavior", () => {
  it("records a bestow event and creates a structured handle", () => {
    const state = runProgram("ג", createInitialState());
    expect(state.links.length).toBe(1);
    expect(state.links[0].label).toBe("bestow");
    const bestow = state.vm.H.find((event) => event.type === "bestow");
    expect(bestow).toBeDefined();
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
  });
});
