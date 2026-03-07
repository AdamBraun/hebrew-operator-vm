import { describe, expect, it } from "vitest";
import { eff } from "@ref/state/eff";
import { createHandle } from "@ref/state/handles";
import { addCarry, addCont, addHeadOf, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";

function seedNodes(state: ReturnType<typeof createInitialState>, ids: string[]): void {
  for (const id of ids) {
    if (!state.handles.has(id)) {
      state.handles.set(id, createHandle(id, "scope"));
    }
  }
}

describe("eff bundle resolution", () => {
  it("resolved carries shadow unresolved carries at the same node", () => {
    const state = createInitialState();
    seedNodes(state, ["q", "n", "su", "sr"]);
    addCont(state, "n", "q");

    state.handles.set(
      "su",
      createHandle("su", "scope", { meta: { witness: { k: "u", uOnly: 1 } } })
    );
    state.handles.set(
      "sr",
      createHandle("sr", "scope", { meta: { witness: { k: "r", rOnly: 1 } } })
    );

    addCarry(state, "su", "n");
    addCarry(state, "sr", "n");
    addSupp(state, "q", "sr");

    expect(eff(state, "q")).toEqual({
      k: "r",
      uOnly: 1,
      rOnly: 1
    });
  });

  it("among same-resolution carries, closer to query wins", () => {
    const state = createInitialState();
    seedNodes(state, ["root", "mid", "q", "sFar", "sNear"]);
    addCont(state, "root", "mid");
    addCont(state, "mid", "q");

    state.handles.set(
      "sFar",
      createHandle("sFar", "scope", { meta: { witness: { x: "far", farOnly: 1 } } })
    );
    state.handles.set(
      "sNear",
      createHandle("sNear", "scope", { meta: { witness: { x: "near", nearOnly: 1 } } })
    );

    addCarry(state, "sFar", "root");
    addCarry(state, "sNear", "mid");

    expect(eff(state, "q")).toEqual({
      x: "near",
      farOnly: 1,
      nearOnly: 1
    });
  });

  it("among same node and same resolution carries, later creation order wins", () => {
    const state = createInitialState();
    seedNodes(state, ["n", "q", "s1", "s2"]);
    addCont(state, "n", "q");

    state.handles.set("s1", createHandle("s1", "scope", { meta: { witness: { tie: "first" } } }));
    state.handles.set("s2", createHandle("s2", "scope", { meta: { witness: { tie: "second" } } }));

    addCarry(state, "s1", "n");
    addCarry(state, "s2", "n");

    expect(eff(state, "q")).toEqual({ tie: "second" });
  });

  it("does not traverse past chunk-commit boundaries", () => {
    const state = createInitialState();
    seedNodes(state, ["root", "boundary", "q", "sRoot", "sBoundary"]);
    addCont(state, "root", "boundary");
    addCont(state, "boundary", "q");

    state.handles.set("sRoot", createHandle("sRoot", "scope", { meta: { witness: { deep: 1 } } }));
    state.handles.set(
      "sBoundary",
      createHandle("sBoundary", "scope", { meta: { witness: { atBoundary: 1 } } })
    );

    const boundaryHandle = state.handles.get("boundary");
    boundaryHandle!.meta = { ...(boundaryHandle?.meta ?? {}), chunk_commit_boundary: 1 };

    addCarry(state, "sRoot", "root");
    addCarry(state, "sBoundary", "boundary");

    expect(eff(state, "q")).toEqual({ atBoundary: 1 });
  });

  it("uses a visited set to guard malformed cont cycles", () => {
    const state = createInitialState();
    seedNodes(state, ["a", "b", "s"]);
    addCont(state, "a", "b");
    addCont(state, "b", "a");
    state.handles.set("s", createHandle("s", "scope", { meta: { witness: { cyc: 1 } } }));
    addCarry(state, "s", "a");

    expect(eff(state, "b")).toEqual({ cyc: 1 });
  });

  it("ignores head_of edges entirely", () => {
    const state = createInitialState();
    seedNodes(state, ["q", "head", "s"]);
    state.handles.set("s", createHandle("s", "scope", { meta: { witness: { ghost: 1 } } }));

    addHeadOf(state, "head", "q");
    addCarry(state, "s", "head");

    expect(eff(state, "q")).toEqual({});
  });
});
