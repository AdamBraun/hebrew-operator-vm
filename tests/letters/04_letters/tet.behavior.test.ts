import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { tetOp } from "@ref/letters/tet";

describe("tet behavior", () => {
  it("restricts the target behind a single sanctioned port", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = tetOp.bound(state, { args: [target], prefs: {} });
    const { h } = tetOp.seal(state, cons);

    const port = state.handles.get(h);
    const restrictedTarget = state.handles.get(target);
    const covertEvent = state.vm.H.find((event) => event.type === "covert");

    expect(port?.kind).toBe("gate");
    expect(port?.meta.target).toBe(target);
    expect(port?.meta.sanctioned).toBe(1);
    expect(port?.meta.inward).toBe(1);
    expect(restrictedTarget?.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(restrictedTarget?.envelope.ports.has(h)).toBe(true);
    expect(restrictedTarget?.meta.sanctioned_port).toBe(h);
    expect(covertEvent?.data).toEqual({ target, port: h });
  });
});
