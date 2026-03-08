import { describe, expect, it } from "vitest";
import { ayinOp } from "@ref/letters/ayin";
import { nunOp } from "@ref/letters/nun";
import { samekhOp } from "@ref/letters/samekh";
import type { LetterOp } from "@ref/letters/types";
import { BOT_ID, OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";

type ExplicitExportStep = {
  origin: string;
  focusAfter: string;
  exportHandleId: string | null;
  cons: ReturnType<LetterOp["bound"]>["cons"];
};

function executeUnaryWithExplicitExports(
  state: ReturnType<typeof createInitialState>,
  op: LetterOp
): ExplicitExportStep {
  const origin = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.F = sealed.advance_focus === false ? origin : sealed.h;
  state.vm.R = sealed.r;
  if (sealed.export_handle) {
    state.vm.K.push(sealed.export_handle);
  }

  return {
    origin,
    focusAfter: state.vm.F,
    exportHandleId: sealed.export_handle ?? null,
    cons: bound.cons
  };
}

describe("ayin contract", () => {
  it("matches nun's cont/carry step with no supp edge", () => {
    const ayinState = createInitialState();
    ayinState.vm.K = [];
    const ayinStep = executeUnaryWithExplicitExports(ayinState, ayinOp);
    const { child: ayinChild } = ayinStep.cons.meta as { child: string };

    const nunState = createInitialState();
    nunState.vm.K = [];
    const nunStep = executeUnaryWithExplicitExports(nunState, nunOp);
    const { child: nunChild } = nunStep.cons.meta as { child: string };

    expect(ayinChild).toBe(ayinStep.focusAfter);
    expect(ayinState.cont).toEqual(new Set([`${ayinStep.origin}->${ayinChild}`]));
    expect(ayinState.carry).toEqual(new Set([`${ayinStep.origin}->${ayinChild}`]));
    expect(ayinState.supp).toEqual(new Set());

    expect(nunState.cont).toEqual(new Set([`${nunStep.origin}->${nunChild}`]));
    expect(nunState.carry).toEqual(new Set([`${nunStep.origin}->${nunChild}`]));
    expect(nunState.supp).toEqual(new Set());
  });

  it("advances focus to the successor rather than keeping the origin focused", () => {
    const state = createInitialState();
    state.vm.K = [];
    const step = executeUnaryWithExplicitExports(state, ayinOp);
    const { child } = step.cons.meta as { child: string };

    expect(step.origin).toBe(OMEGA_ID);
    expect(step.focusAfter).toBe(child);
    expect(step.focusAfter).not.toBe(step.origin);
    expect(state.vm.R).toBe(BOT_ID);
  });

  it("exports a handle on K that targets the origin", () => {
    const state = createInitialState();
    state.vm.K = [];
    const step = executeUnaryWithExplicitExports(state, ayinOp);
    const exportHandle = state.handles.get(String(step.exportHandleId ?? ""));

    expect(state.vm.K).toEqual([step.exportHandleId]);
    expect(exportHandle?.kind).toBe("alias");
    expect(exportHandle?.meta?.target).toBe(step.origin);
    expect(exportHandle?.meta?.export_origin).toBe(true);
    expect(exportHandle?.meta?.handle_label).toBe("alias_handle");
  });

  it("samekh resolves ayin's carry without removing the exported origin handle", () => {
    const state = createInitialState();
    state.vm.K = [];
    const ayinStep = executeUnaryWithExplicitExports(state, ayinOp);
    const exportHandleId = String(ayinStep.exportHandleId ?? "");
    const { child } = ayinStep.cons.meta as { child: string };

    const samekhStep = executeUnaryWithExplicitExports(state, samekhOp);

    expect(samekhStep.focusAfter).toBe(child);
    expect(state.supp.has(`${child}->${ayinStep.origin}`)).toBe(true);
    expect(state.vm.K).toEqual([exportHandleId]);
    expect(state.handles.get(exportHandleId)?.meta?.target).toBe(ayinStep.origin);
  });

  it("opens an explicit export for ayin but not for nun", () => {
    const nunState = createInitialState();
    nunState.vm.K = [];
    executeUnaryWithExplicitExports(nunState, nunOp);

    const ayinState = createInitialState();
    ayinState.vm.K = [];
    executeUnaryWithExplicitExports(ayinState, ayinOp);

    expect(nunState.vm.K).toEqual([]);
    expect(ayinState.vm.K).toHaveLength(1);
  });
});
