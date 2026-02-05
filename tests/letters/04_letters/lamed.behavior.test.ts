import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { lamedOp } from "@ref/letters/lamed";

describe("lamed behavior", () => {
  it("creates an endpoint handle with an anchored boundary", () => {
    const state = createInitialState();
    const endpoint = "endpoint";
    const domain = "domain";
    state.handles.set(endpoint, createHandle(endpoint, "scope"));
    state.handles.set(domain, createHandle(domain, "scope"));

    const { cons } = lamedOp.bound(state, { args: [endpoint, domain], prefs: {} });
    const { h } = lamedOp.seal(state, cons);

    const endpointHandle = state.handles.get(h);
    expect(endpointHandle?.kind).toBe("endpoint");
    const boundary = state.handles.get(endpointHandle?.meta.boundaryId as string);
    expect(boundary?.kind).toBe("boundary");
    expect(boundary?.anchor).toBe(1);
    expect(boundary?.meta.closedBy).toBe("ל");
    expect(state.vm.H.some((event) => event.type === "endpoint")).toBe(true);
  });
});
