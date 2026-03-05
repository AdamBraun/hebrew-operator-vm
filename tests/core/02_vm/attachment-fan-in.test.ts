import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { addBoundary, addCarry, addCont, addSub, addSupp } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";

describe("attachment fan-in", () => {
  it("fans cont edges into direct sub-children of the target only", () => {
    const state = createInitialState();
    state.handles.set("src", createHandle("src", "scope"));
    state.handles.set("F", createHandle("F", "scope"));
    state.handles.set("c1", createHandle("c1", "compartment"));
    state.handles.set("c2", createHandle("c2", "compartment"));

    addSub(state, "F", "c1");
    addSub(state, "c1", "c2");

    addCont(state, "src", "F");

    expect(state.cont.has("src->F")).toBe(true);
    expect(state.cont.has("src->c1")).toBe(true);
    expect(state.cont.has("src->c2")).toBe(false);
  });

  it("fans carry edges into direct sub-children of the target", () => {
    const state = createInitialState();
    state.handles.set("src", createHandle("src", "scope"));
    state.handles.set("F", createHandle("F", "scope"));
    state.handles.set("c1", createHandle("c1", "compartment"));
    state.handles.set("c2", createHandle("c2", "compartment"));

    addSub(state, "F", "c1");
    addSub(state, "F", "c2");

    addCarry(state, "src", "F");

    expect(state.carry.has("src->F")).toBe(true);
    expect(state.carry.has("src->c1")).toBe(true);
    expect(state.carry.has("src->c2")).toBe(true);
    expect(state.cont.has("src->F")).toBe(true);
    expect(state.cont.has("src->c1")).toBe(true);
    expect(state.cont.has("src->c2")).toBe(true);
  });

  it("does not fan supp or sub edges", () => {
    const state = createInitialState();
    state.handles.set("closer", createHandle("closer", "scope"));
    state.handles.set("parent", createHandle("parent", "scope"));
    state.handles.set("F", createHandle("F", "scope"));
    state.handles.set("c1", createHandle("c1", "compartment"));

    addSub(state, "F", "c1");
    addSupp(state, "closer", "F");
    addSub(state, "parent", "F");

    expect(state.supp.has("closer->F")).toBe(true);
    expect(state.supp.has("closer->c1")).toBe(false);
    expect(state.sub.has("parent->F")).toBe(true);
    expect(state.sub.has("parent->c1")).toBe(false);
  });

  it("expands boundary members to include direct sub-children of inside", () => {
    const state = createInitialState();
    state.handles.set("F", createHandle("F", "scope"));
    state.handles.set("c1", createHandle("c1", "compartment"));
    state.handles.set("c2", createHandle("c2", "compartment"));

    addSub(state, "F", "c1");
    addSub(state, "c1", "c2");
    addBoundary(state, "b1", "F", "Ω", 1);

    const boundary = state.boundaries[0];
    expect(boundary?.inside).toBe("F");
    expect(boundary?.members).toEqual(["F", "c1"]);
  });
});
