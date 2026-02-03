import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgram } from "../../vm/vm";

describe("vav behavior", () => {
  it("records a vav link handle", () => {
    const state = runProgram("ו", createInitialState());
    expect(state.links.length).toBe(1);
    const linkHandle = Array.from(state.handles.values()).find(
      (handle) => handle.meta?.label === "vav"
    );
    expect(linkHandle?.kind).toBe("structured");
  });
});
