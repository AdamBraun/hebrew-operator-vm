import { describe, expect, it } from "vitest";
import { BOT_ID, OMEGA_ID } from "@ref/state/handles";
import { eff, resolveCarry } from "@ref/state/eff";
import { finalMemOp } from "@ref/letters/finalMem";
import { memOp } from "@ref/letters/mem";
import type { LetterOp } from "@ref/letters/types";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

function executeLetterOp(state: ReturnType<typeof createInitialState>, op: LetterOp) {
  const beforeFocus = state.vm.F;
  const selectResult = op.select(state);
  const boundResult = op.bound(selectResult.S, selectResult.ops);
  const sealResult = op.seal(boundResult.S, boundResult.cons);
  state.vm.K.push(sealResult.h);
  state.vm.F = sealResult.advance_focus === false ? beforeFocus : sealResult.h;
  state.vm.R = sealResult.r;
  return {
    cons: boundResult.cons,
    h: sealResult.h,
    r: sealResult.r
  };
}

type TokenExitSnapshot = {
  vm?: {
    F?: string;
  };
  cont?: string[];
  carry?: string[];
  supp?: string[];
  boundaries?: Array<{
    id: string;
    inside: string;
    outside: string;
    kind?: string;
    open?: boolean;
    closed?: boolean;
  }>;
};

function tokenExitSnapshot(word: string): TokenExitSnapshot {
  const { deepTrace } = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });
  const token = deepTrace.find((entry) => entry.token_raw === word);
  const snapshot = token?.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
  if (!snapshot) {
    throw new Error(`Missing token_exit snapshot for '${word}'`);
  }
  return snapshot as TokenExitSnapshot;
}

function normalizeEdges(edges: string[] | undefined, names: Record<string, string>): string[] {
  return (edges ?? []).map((edge) => {
    const [from = "", to = ""] = edge.split("->");
    return `${names[from] ?? from}->${names[to] ?? to}`;
  });
}

describe("mem behavior", () => {
  it("מ resolves a hold, steps into the interior, and leaves focus on the interior node", () => {
    const state = createInitialState();
    const { cons, h, r } = executeLetterOp(state, memOp);
    const { source, holdId, interiorId, boundaryId } = cons.meta as {
      source: string;
      holdId: string;
      interiorId: string;
      boundaryId: string;
    };
    const boundary = state.boundaries.find((entry) => entry.id === boundaryId);

    expect(source).toBe(OMEGA_ID);
    expect(h).toBe(interiorId);
    expect(r).toBe(BOT_ID);
    expect(state.vm.F).toBe(interiorId);
    expect(state.vm.F).not.toBe(holdId);
    expect(state.cont).toEqual(new Set([`${source}->${holdId}`, `${holdId}->${interiorId}`]));
    expect(state.carry).toEqual(new Set());
    expect(state.supp).toEqual(new Set([`${holdId}->${source}`]));
    expect(boundary).toMatchObject({
      id: boundaryId,
      inside: interiorId,
      outside: holdId,
      kind: "mem_enclosure",
      open: true,
      closed: false
    });
    expect(state.vm.OStack_word).toHaveLength(0);
  });

  it("eff at the interior does not inherit source witness without a carry edge", () => {
    const state = createInitialState();
    const omega = state.handles.get(OMEGA_ID);
    omega!.meta = { ...(omega?.meta ?? {}), witness: { ambient: 1 } };

    const { cons } = executeLetterOp(state, memOp);
    const { source, holdId, interiorId } = cons.meta as {
      source: string;
      holdId: string;
      interiorId: string;
    };
    const hold = state.handles.get(holdId);
    hold!.meta = { ...(hold?.meta ?? {}), witness: { holdSelf: 1 } };

    expect(resolveCarry(state, source, holdId, { focusNodeId: interiorId })).toEqual({
      status: "unresolved",
      closer: null
    });
    expect(eff(state, interiorId, { focusNodeId: interiorId })).toEqual({});
  });

  it("ם closes the current enclosure and lands on a sealed resolved successor", () => {
    const state = createInitialState();
    const open = executeLetterOp(state, memOp);
    const { source, holdId, interiorId, boundaryId } = open.cons.meta as {
      source: string;
      holdId: string;
      interiorId: string;
      boundaryId: string;
    };

    const closed = executeLetterOp(state, finalMemOp);
    const sealedId = closed.h;
    const boundary = state.boundaries.find((entry) => entry.id === boundaryId);

    expect(state.vm.F).toBe(sealedId);
    expect(state.cont).toEqual(
      new Set([`${source}->${holdId}`, `${holdId}->${interiorId}`, `${interiorId}->${sealedId}`])
    );
    expect(state.carry).toEqual(new Set());
    expect(state.supp).toEqual(new Set([`${holdId}->${source}`, `${sealedId}->${interiorId}`]));
    expect(boundary?.open).toBe(false);
    expect(boundary?.closed).toBe(true);
    expect(boundary?.close_mode).toBe("explicit");
    expect(boundary?.closed_by).toBe("ם");
  });

  it("ם synthesizes a minimal מ+ם when no open enclosure exists", () => {
    const state = createInitialState();
    const handlesBefore = new Set(state.handles.keys());

    const { h } = executeLetterOp(state, finalMemOp);
    const newHandles = [...state.handles.keys()].filter((id) => !handlesBefore.has(id)).sort();
    const boundary = state.boundaries[0];
    const [holdId = ""] =
      Array.from(state.handles.entries()).find(
        ([, handle]) => handle.meta?.heldFrom === OMEGA_ID
      ) ?? [];
    const [interiorId = ""] =
      Array.from(state.handles.entries()).find(
        ([, handle]) => handle.meta?.interiorOf === holdId
      ) ?? [];

    expect(newHandles).toHaveLength(3);
    expect(state.vm.F).toBe(h);
    expect(holdId).not.toBe("");
    expect(interiorId).not.toBe("");
    expect(state.cont).toEqual(
      new Set([`${OMEGA_ID}->${holdId}`, `${holdId}->${interiorId}`, `${interiorId}->${h}`])
    );
    expect(state.carry).toEqual(new Set());
    expect(state.supp).toEqual(new Set([`${holdId}->${OMEGA_ID}`, `${h}->${interiorId}`]));
    expect(boundary).toMatchObject({
      kind: "mem_enclosure",
      open: false,
      closed: true,
      close_mode: "synthetic",
      closed_by: "ם"
    });
    expect(state.vm.H.some((event) => event.type === "mem_open")).toBe(true);
    expect(state.vm.H.some((event) => event.type === "mem_close")).toBe(true);
  });

  it("word boundaries close any open mem enclosure silently", () => {
    const state = runProgramWithDeepTrace("מ", createInitialState(), {
      includeStateSnapshots: false
    }).state;
    const boundary = state.boundaries[0];

    expect(boundary).toMatchObject({
      kind: "mem_enclosure",
      open: false,
      closed: true,
      close_mode: "word_boundary",
      closed_by: "hard"
    });
    expect(state.vm.H).toContainEqual({
      type: "mem_auto_close",
      tau: 2,
      data: {
        id: boundary.id,
        inside: boundary.inside,
        outside: boundary.outside,
        reason: "hard"
      }
    });
  });

  it("מ keeps the same forward path as ל, but differs only by boundary state and focus landing", () => {
    const memSnapshot = tokenExitSnapshot("מ");
    const lamedSnapshot = tokenExitSnapshot("ל");
    const memBoundary = memSnapshot.boundaries?.[0];
    const memStart = memSnapshot.cont?.[0]?.split("->")[0] ?? "";
    const memHold = memSnapshot.cont?.[0]?.split("->")[1] ?? "";
    const memInterior = memSnapshot.cont?.[1]?.split("->")[1] ?? "";
    const lamedStart = lamedSnapshot.cont?.[0]?.split("->")[0] ?? "";
    const lamedHold = lamedSnapshot.cont?.[0]?.split("->")[1] ?? "";
    const lamedExterior = lamedSnapshot.cont?.[1]?.split("->")[1] ?? "";

    expect(
      normalizeEdges(memSnapshot.cont, {
        [memStart]: "F0",
        [memHold]: "H",
        [memInterior]: "N"
      })
    ).toEqual(["F0->H", "H->N"]);
    expect(
      normalizeEdges(lamedSnapshot.cont, {
        [lamedStart]: "F0",
        [lamedHold]: "H",
        [lamedExterior]: "N"
      })
    ).toEqual(["F0->H", "H->N"]);
    expect(
      normalizeEdges(memSnapshot.carry, {
        [memStart]: "F0",
        [memHold]: "H"
      })
    ).toEqual([]);
    expect(
      normalizeEdges(lamedSnapshot.carry, {
        [lamedStart]: "F0",
        [lamedHold]: "H"
      })
    ).toEqual([]);
    expect(
      normalizeEdges(memSnapshot.supp, {
        [memHold]: "H",
        [memStart]: "F0"
      })
    ).toEqual(["H->F0"]);
    expect(
      normalizeEdges(lamedSnapshot.supp, {
        [lamedHold]: "H",
        [lamedStart]: "F0"
      })
    ).toEqual(["H->F0"]);
    expect(memSnapshot.vm?.F).not.toBe(lamedSnapshot.vm?.F);
    expect(memBoundary).toMatchObject({
      inside: memSnapshot.vm?.F,
      outside: memHold,
      kind: "mem_enclosure",
      open: true
    });
    expect(lamedSnapshot.boundaries ?? []).toEqual([]);
  });
});
