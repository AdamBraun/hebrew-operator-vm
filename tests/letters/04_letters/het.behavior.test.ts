import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { hetOp } from "@ref/letters/het";

describe("het behavior", () => {
  it("creates a bridged interface with two committed resolved ports", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = hetOp.bound(state, { args: [target], prefs: {} });
    const { h } = hetOp.seal(state, cons);

    const iface = state.handles.get(h);
    expect(iface?.kind).toBe("gate");
    expect(iface?.meta.formedBy).toBe("ז+ז");

    const pIn = String(iface?.meta.p_in ?? "");
    const pOut = String(iface?.meta.p_out ?? "");
    const inside = String(iface?.meta.inside ?? "");
    const outside = String(iface?.meta.outside ?? "");

    expect(pIn.length).toBeGreaterThan(0);
    expect(pOut.length).toBeGreaterThan(0);
    expect(inside).toBe(target);
    expect(outside.length).toBeGreaterThan(0);

    expect(state.handles.get(pIn)?.edge_mode).toBe("committed");
    expect(state.handles.get(pOut)?.edge_mode).toBe("committed");
    expect(state.carry.has(`${inside}->${pIn}`)).toBe(true);
    expect(state.supp.has(`${pIn}->${inside}`)).toBe(true);
    expect(state.carry.has(`${outside}->${pOut}`)).toBe(true);
    expect(state.supp.has(`${pOut}->${outside}`)).toBe(true);

    expect(state.links).toContainEqual({ from: pIn, to: h, label: "bridge" });
    expect(state.links).toContainEqual({ from: pOut, to: h, label: "bridge" });
    expect(state.vm.H.some((event) => event.type === "interface" && event.data?.id === h)).toBe(
      true
    );

    expect(Array.from(state.handles.values()).every((handle) => handle.kind !== "boundary")).toBe(
      true
    );
    expect(
      Array.from(state.handles.values()).every((handle) => handle.kind !== "compartment")
    ).toBe(true);
  });
});
