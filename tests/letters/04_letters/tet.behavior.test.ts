import { describe, expect, it } from "vitest";
import { BOT_ID, createHandle, OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { tetOp } from "@ref/letters/tet";
import {
  resolveSelectableFocus,
  resolveSelectableHandle,
  selectCurrentFocus
} from "@ref/vm/select";

function createRestrictedTarget() {
  const state = createInitialState();
  const target = "target";
  state.handles.set(target, createHandle(target, "scope"));
  state.vm.F = target;

  const { cons } = tetOp.bound(state, { args: [target], prefs: {} });
  const { h: portId } = tetOp.seal(state, cons);

  state.vm.K = [];
  state.vm.W = [];
  state.vm.R = BOT_ID;
  state.vm.D = OMEGA_ID;

  return { state, target, portId };
}

describe("tet behavior", () => {
  it("restricts one target in place and exports exactly one sanctioned port", () => {
    const state = createInitialState();
    const target = "target";
    state.handles.set(target, createHandle(target, "scope"));
    state.vm.F = target;

    const selection = tetOp.select(state).ops.args;
    const handlesBefore = state.handles.size;
    const { cons } = tetOp.bound(state, { args: selection, prefs: {} });
    const { h } = tetOp.seal(state, cons);

    const port = state.handles.get(h);
    const restrictedTarget = state.handles.get(target);
    const covertEvent = state.vm.H.find((event) => event.type === "covert");
    const gateHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "gate"
    );

    expect(selection).toEqual([target]);
    expect(selection).toHaveLength(1);
    expect(state.handles.size).toBe(handlesBefore + 1);
    expect(gateHandles).toHaveLength(1);
    expect(gateHandles[0]?.id).toBe(h);
    expect(port?.kind).toBe("gate");
    expect(port?.meta.target).toBe(target);
    expect(port?.meta.sanctioned).toBe(1);
    expect(port?.meta.inward).toBe(1);
    expect(restrictedTarget?.envelope.x_flow).toBe("EXPLICIT_ONLY");
    expect(restrictedTarget?.envelope.ports.has(h)).toBe(true);
    expect(restrictedTarget?.meta.sanctioned_port).toBe(h);
    expect(state.rules).toHaveLength(0);
    expect(covertEvent?.data).toEqual({ target, port: h });
  });

  it("denies direct selection of the restricted target and allows access through the emitted port", () => {
    const { state, target, portId } = createRestrictedTarget();

    state.vm.F = target;
    expect(resolveSelectableHandle(state, target)).toBe(BOT_ID);
    expect(resolveSelectableFocus(state)).toBe(BOT_ID);
    expect(selectCurrentFocus(state).ops.args).toEqual([BOT_ID]);

    state.vm.F = portId;
    expect(resolveSelectableHandle(state, portId)).toBe(target);
    expect(resolveSelectableFocus(state)).toBe(target);
    expect(selectCurrentFocus(state).ops.args).toEqual([target]);
  });
});
