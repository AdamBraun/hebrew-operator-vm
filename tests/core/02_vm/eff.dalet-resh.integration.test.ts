import { describe, expect, it } from "vitest";
import { eff, isCarryUnresolved } from "@ref/state/eff";
import { finalNunOp } from "@ref/letters/finalNun";
import { nunOp } from "@ref/letters/nun";
import type { LetterOp } from "@ref/letters/types";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type HeSnapshot = {
  head_of?: string[];
  carry?: string[];
  supp?: string[];
};

function executeUnary(state: ReturnType<typeof createInitialState>, op: LetterOp) {
  const origin = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? origin : sealed.h;
  state.vm.R = sealed.r;

  return { origin, child: sealed.h };
}

function inspectHeadQuery(
  word: "דבה" | "רבה",
  letter: "ד" | "ר"
): {
  state: ReturnType<typeof runProgramWithDeepTrace>["state"];
  head: string;
  whole: string;
  snapshot: HeSnapshot;
} {
  const state = createInitialState();
  const omega = state.handles.get("Ω");
  omega!.meta = { ...omega!.meta, witness: { ambient: 1 } };

  const result = runProgramWithDeepTrace(word, state, {
    includeStateSnapshots: true
  });
  const entry = result.deepTrace.find((traceEntry) => traceEntry.token === letter);
  const snapshot = (entry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as HeSnapshot;
  const headEdge = snapshot.head_of?.find((edge) => edge.startsWith(`${letter}:`)) ?? "->";
  const [head = "", whole = ""] = headEdge.split("->");

  return {
    state: result.state,
    head,
    whole,
    snapshot
  };
}

describe("eff integration: dalet vs resh head exposure", () => {
  it("drops the ambient carry witness on ד while only resh uses carry resolution in {ד|ר}בה", () => {
    const dalet = inspectHeadQuery("דבה", "ד");
    const resh = inspectHeadQuery("רבה", "ר");

    expect(dalet.whole).toBe("Ω");
    expect(resh.whole).toBe("Ω");
    expect(dalet.snapshot.carry).toEqual([]);
    expect(resh.snapshot.carry).toEqual([`Ω->${resh.head}`]);
    expect(dalet.snapshot.supp).toEqual([`${dalet.head}->Ω`]);
    expect(resh.snapshot.supp).toEqual([]);

    expect(eff(dalet.state, dalet.head, { focusNodeId: dalet.head })).toEqual({});
    expect(eff(resh.state, resh.head, { focusNodeId: resh.head })).toEqual({ ambient: 1 });

    expect(isCarryUnresolved(resh.state, "Ω", resh.head, { focusNodeId: resh.head })).toBe(true);
  });

  it("treats נ as live carry while ן stays direct-supported and off the carry ledger", () => {
    const nunState = createInitialState();
    nunState.handles.get("Ω")!.meta = { witness: { ambient: 1 } };
    const nun = executeUnary(nunState, nunOp);

    const finalNunState = createInitialState();
    finalNunState.handles.get("Ω")!.meta = { witness: { ambient: 1 } };
    const finalNun = executeUnary(finalNunState, finalNunOp);

    expect(nunState.carry.has(`${nun.origin}->${nun.child}`)).toBe(true);
    expect(eff(nunState, nun.child, { focusNodeId: nun.child })).toEqual({ ambient: 1 });
    expect(isCarryUnresolved(nunState, nun.origin, nun.child, { focusNodeId: nun.child })).toBe(
      true
    );

    expect(Array.from(finalNunState.carry)).toEqual([]);
    expect(finalNunState.supp.has(`${finalNun.child}->${finalNun.origin}`)).toBe(true);
    expect(eff(finalNunState, finalNun.child, { focusNodeId: finalNun.child })).toEqual({});
  });
});
