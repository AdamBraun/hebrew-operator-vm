import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("gimel behavior", () => {
  it("records a link and creates a structured handle", () => {
    const state = runProgram("ג", createInitialState());
    expect(state.links.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "gimel"
    );
    expect(linkHandle?.kind).toBe("structured");
  });
});
