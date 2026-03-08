import { describe, expect, it } from "vitest";
import { ayinOp } from "@ref/letters/ayin";
import { samekhOp } from "@ref/letters/samekh";
import type { LetterOp } from "@ref/letters/types";
import { eff, resolveCarry } from "@ref/state/eff";
import { OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { applySpace } from "@ref/vm/space";

type TestState = ReturnType<typeof createInitialState>;

type UnaryStep = {
  origin: string;
  child: string;
  exportHandleId: string | null;
  cons: ReturnType<LetterOp["bound"]>["cons"];
};

type ExportedOriginHandle = {
  id: string;
  meta?: Record<string, any>;
};

function executeUnary(state: TestState, op: LetterOp): UnaryStep {
  const origin = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? origin : sealed.h;
  state.vm.R = sealed.r;

  return {
    origin,
    child: sealed.h,
    exportHandleId: sealed.export_handle ?? null,
    cons: bound.cons
  };
}

function seedWitness(state: TestState, nodeId: string, witness: Record<string, any>): void {
  const handle = state.handles.get(nodeId);
  if (!handle) {
    throw new Error(`Missing handle '${nodeId}'`);
  }
  handle.meta = { ...(handle.meta ?? {}), witness };
}

function exportedOriginHandlesOnK(state: TestState): ExportedOriginHandle[] {
  return state.vm.K.map((id) => state.handles.get(id)).filter(
    (handle): handle is ExportedOriginHandle =>
      Boolean(handle) && handle?.meta?.export_origin === true
  );
}

describe("ayin behavior", () => {
  it("eff sees origin witness through the unresolved carry before samekh", () => {
    const state = createInitialState();
    seedWitness(state, OMEGA_ID, { originFact: "provisional" });

    const step = executeUnary(state, ayinOp);

    expect(resolveCarry(state, step.origin, step.child, { focusNodeId: step.child })).toEqual({
      status: "unresolved",
      closer: null
    });
    expect(eff(state, step.child, { focusNodeId: step.child })).toEqual({
      originFact: "provisional"
    });
  });

  it("eff sees the same witness through a resolved carry after samekh", () => {
    const state = createInitialState();
    seedWitness(state, OMEGA_ID, { originFact: "committed" });

    const ayinStep = executeUnary(state, ayinOp);
    const samekhStep = executeUnary(state, samekhOp);

    expect(samekhStep.child).toBe(ayinStep.child);
    expect(
      resolveCarry(state, ayinStep.origin, ayinStep.child, { focusNodeId: ayinStep.child })
    ).toEqual({
      status: "resolved",
      closer: ayinStep.child
    });
    expect(eff(state, ayinStep.child, { focusNodeId: ayinStep.child })).toEqual({
      originFact: "committed"
    });
  });

  it("keeps the exported origin handle valid after samekh resolves the carry", () => {
    const state = createInitialState();

    const ayinStep = executeUnary(state, ayinOp);
    const exportHandleId = String(ayinStep.exportHandleId ?? "");

    executeUnary(state, samekhOp);

    const exportHandle = state.handles.get(exportHandleId);
    expect(exportHandleId.length).toBeGreaterThan(0);
    expect(state.vm.K).toContain(exportHandleId);
    expect(exportHandle?.meta?.target).toBe(ayinStep.origin);
    expect(exportHandle?.meta?.handle_label).toBe("alias_handle");
    expect(state.handles.has(ayinStep.origin)).toBe(true);
  });

  it("hard word boundary silently closes an unresolved ayin carry at the terminal node", () => {
    const state = createInitialState();

    const step = executeUnary(state, ayinOp);
    state.vm.wordHasContent = true;

    applySpace(state, { mode: "hard" });

    expect(state.supp.has(`${step.child}->${step.origin}`)).toBe(true);
    expect(resolveCarry(state, step.origin, step.child, { focusNodeId: step.child })).toEqual({
      status: "resolved",
      closer: step.child
    });
    expect(state.vm.H.filter((event) => event.type === "fall")).toEqual([]);
  });

  it("two ayins export two origin handles and leave two unresolved carries", () => {
    const state = createInitialState();

    const first = executeUnary(state, ayinOp);
    const second = executeUnary(state, ayinOp);
    const exportedHandles = exportedOriginHandlesOnK(state);

    expect(exportedHandles.map((handle) => handle.id)).toEqual([
      String(first.exportHandleId),
      String(second.exportHandleId)
    ]);
    expect(exportedHandles.map((handle) => handle.meta?.target)).toEqual([
      first.origin,
      second.origin
    ]);
    expect(exportedHandles.map((handle) => handle.meta?.handle_label)).toEqual([
      "alias_handle",
      "alias_handle"
    ]);
    expect(state.carry.has(`${first.origin}->${first.child}`)).toBe(true);
    expect(state.carry.has(`${second.origin}->${second.child}`)).toBe(true);
    expect(resolveCarry(state, first.origin, first.child, { focusNodeId: second.child })).toEqual({
      status: "unresolved",
      closer: null
    });
    expect(resolveCarry(state, second.origin, second.child, { focusNodeId: second.child })).toEqual(
      {
        status: "unresolved",
        closer: null
      }
    );
  });
});
