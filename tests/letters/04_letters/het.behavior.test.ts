import { describe, expect, it } from "vitest";
import { createHandle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { hetOp } from "@ref/letters/het";

describe("het behavior", () => {
  it("creates a bridged interface with two committed resolved ports and no local carry", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));

    const { cons } = hetOp.bound(state, { args: [target], prefs: {} });
    const { h, r, advance_focus } = hetOp.seal(state, cons);
    const beforeFocus = state.vm.F;
    state.vm.K.push(h);
    state.vm.F = advance_focus === false ? beforeFocus : h;
    state.vm.R = r;

    const iface = state.handles.get(h);
    expect(iface?.kind).toBe("gate");
    expect(iface?.meta.formedBy).toBe("ז+ז");

    const pIn = String(iface?.meta.p_in ?? "");
    const pOut = String(iface?.meta.p_out ?? "");
    const inside = String(iface?.meta.inside ?? "");
    const outside = String(iface?.meta.outside ?? "");
    const pInHandle = state.handles.get(pIn);
    const pOutHandle = state.handles.get(pOut);

    expect(pIn.length).toBeGreaterThan(0);
    expect(pOut.length).toBeGreaterThan(0);
    expect(inside).toBe(target);
    expect(outside.length).toBeGreaterThan(0);
    expect(pInHandle?.meta.portOf).toBe(inside);
    expect(pOutHandle?.meta.portOf).toBe(outside);
    expect(pInHandle?.meta.handle_label).toBe("resolved_port");
    expect(pOutHandle?.meta.handle_label).toBe("resolved_port");

    expect(pInHandle?.edge_mode).toBe("committed");
    expect(pOutHandle?.edge_mode).toBe("committed");
    expect(pInHandle?.envelope.data_flow).toBe("SNAPSHOT");
    expect(pOutHandle?.envelope.data_flow).toBe("SNAPSHOT");
    expect(state.cont).toEqual(new Set([`${inside}->${pIn}`, `${outside}->${pOut}`]));
    expect(state.carry).toEqual(new Set());
    expect(state.supp).toEqual(new Set([`${pIn}->${inside}`, `${pOut}->${outside}`]));
    expect(state.carry.has(`${inside}->${pIn}`)).toBe(false);
    expect(state.supp.has(`${pIn}->${inside}`)).toBe(true);
    expect(state.carry.has(`${outside}->${pOut}`)).toBe(false);
    expect(state.supp.has(`${pOut}->${outside}`)).toBe(true);

    expect(state.links).toContainEqual({ from: pIn, to: h, label: "bridge" });
    expect(state.links).toContainEqual({ from: pOut, to: h, label: "bridge" });
    expect(state.vm.H.some((event) => event.type === "interface" && event.data?.id === h)).toBe(
      true
    );
    expect(state.vm.F).toBe(h);

    expect(state.boundaries).toHaveLength(0);
    expect(Array.from(state.handles.values()).every((handle) => handle.kind !== "boundary")).toBe(
      true
    );
    expect(
      Array.from(state.handles.values()).every((handle) => handle.kind !== "compartment")
    ).toBe(true);
  });
});
