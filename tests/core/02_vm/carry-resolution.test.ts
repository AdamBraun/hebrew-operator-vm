import { describe, expect, it } from "vitest";
import { isCarryResolved, isCarryUnresolved, resolveCarry } from "@ref/state/eff";
import { createHandle } from "@ref/state/handles";
import { addCarry, addCont, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";

function seedNodes(state: ReturnType<typeof createInitialState>, ids: string[]): void {
  for (const id of ids) {
    if (!state.handles.has(id)) {
      state.handles.set(id, createHandle(id, "scope"));
    }
  }
}

describe("carry resolution (derived)", () => {
  it("resolves when a supp(c, source) exists on the forward cont chain from target", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "c"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "c");
    addSupp(state, "c", "s");

    expect(resolveCarry(state, "s", "t")).toEqual({
      status: "resolved",
      closer: "c"
    });
  });

  it("stays unresolved when supp exists only off-chain", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "c", "x", "y"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "c");
    addCont(state, "x", "y");
    addSupp(state, "y", "s");

    expect(isCarryUnresolved(state, "s", "t")).toBe(true);
  });

  it("stops at focus when no supp has been found yet", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "mid", "after"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "mid");
    addCont(state, "mid", "after");
    addSupp(state, "after", "s");

    expect(
      resolveCarry(state, "s", "t", {
        focusNodeId: "mid"
      })
    ).toEqual({ status: "unresolved", closer: null });
  });

  it("still resolves when focus node itself has supp(c, source)", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "mid"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "mid");
    addSupp(state, "mid", "s");

    expect(
      resolveCarry(state, "s", "t", {
        focusNodeId: "mid"
      })
    ).toEqual({ status: "resolved", closer: "mid" });
  });

  it("stops at chunk boundaries unless that boundary node itself has supp(c, source)", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "b", "after"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "b");
    addCont(state, "b", "after");
    addSupp(state, "after", "s");

    expect(
      isCarryResolved(state, "s", "t", {
        chunkBoundaryNodes: new Set(["b"]),
        focusNodeId: null
      })
    ).toBe(false);

    addSupp(state, "b", "s");
    expect(
      resolveCarry(state, "s", "t", {
        chunkBoundaryNodes: new Set(["b"]),
        focusNodeId: null
      })
    ).toEqual({ status: "resolved", closer: "b" });
  });

  it("uses current focus as the default stop node", () => {
    const state = createInitialState();
    seedNodes(state, ["s", "t", "mid", "after"]);
    addCarry(state, "s", "t");
    addCont(state, "t", "mid");
    addCont(state, "mid", "after");
    addSupp(state, "after", "s");
    state.vm.F = "mid";

    expect(isCarryUnresolved(state, "s", "t")).toBe(true);
  });
});
