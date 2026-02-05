import { describe, expect, it } from "vitest";
import { runProgram } from "@ref/vm/vm";

const base = "י";

function sealedHandle(state: ReturnType<typeof runProgram>) {
  const handleId = state.vm.A[state.vm.A.length - 1];
  return state.handles.get(handleId);
}

describe("sof modifiers", () => {
  const cases = [
    { name: "patach", mark: "\u05B7", edge: "gated" },
    { name: "tzere", mark: "\u05B5", edge: "stabilized" },
    { name: "segol", mark: "\u05B6", edge: "convergent" },
    { name: "kamatz", mark: "\u05B8", edge: "committed", metaKey: "atomic" },
    { name: "hiriq", mark: "\u05B4", edge: "committed", metaKey: "rep_token" },
    { name: "shva", mark: "\u05B0", edge: "collapsed" },
    { name: "kubutz", mark: "\u05BB", edge: "bundled" }
  ];

  for (const entry of cases) {
    it(`${entry.name} sets edge_mode`, () => {
      const state = runProgram(`${base}${entry.mark}`);
      const handle = sealedHandle(state);
      expect(handle?.edge_mode).toBe(entry.edge);
      if (entry.metaKey) {
        expect(handle?.meta?.[entry.metaKey]).toBe(1);
      }
    });
  }

  it("hataf marks are reduced shva + base", () => {
    const state = runProgram(`${base}\u05B1`);
    const handle = sealedHandle(state);
    expect(handle?.edge_mode).toBe("convergent");
    expect(handle?.meta?.hataf).toBe(1);
    expect(handle?.meta?.reduced).toBe(1);
  });
});
