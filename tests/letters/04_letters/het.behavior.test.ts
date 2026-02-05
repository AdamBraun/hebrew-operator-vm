import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { hetOp } from "@ref/letters/het";

describe("het behavior", () => {
  it("creates a compartment with an anchored boundary", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = hetOp.bound(state, { args: [target], prefs: {} });
    const { h } = hetOp.seal(state, cons);

    const compartment = state.handles.get(h);
    expect(compartment?.kind).toBe("compartment");
    const boundaryId = compartment?.meta.boundaryId as string;
    const boundary = state.handles.get(boundaryId);
    expect(boundary?.kind).toBe("boundary");
    expect(boundary?.anchor).toBe(1);
    expect(boundary?.meta.closedBy).toBe("ח");
    expect(state.vm.H.some((event) => event.type === "compartment")).toBe(true);
  });
});
