import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { tavOp } from "@ref/letters/tav";

describe("tav behavior", () => {
  it("finalizes an artifact and returns a residue handle", () => {
    const state = createInitialState();
    const { cons } = tavOp.bound(state, { args: [state.vm.F], prefs: {} });
    const { h, r } = tavOp.seal(state, cons);

    const residue = state.handles.get(h);
    const artifact = state.handles.get(r);
    expect(artifact?.kind).toBe("artifact");
    expect(artifact?.policy).toBe("final");
    expect(residue?.meta.artifact).toBe(r);
    expect(state.vm.H.some((event) => event.type === "finalize")).toBe(true);
  });
});
