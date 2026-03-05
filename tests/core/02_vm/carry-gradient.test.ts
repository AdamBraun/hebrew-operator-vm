import { describe, expect, it } from "vitest";
import { finalNunOp } from "@ref/letters/finalNun";
import { nunOp } from "@ref/letters/nun";
import { samekhOp } from "@ref/letters/samekh";
import type { LetterOp } from "@ref/letters/types";
import { zayinOp } from "@ref/letters/zayin";
import { BOT_ID } from "@ref/state/handles";
import { isCarryResolved, isCarryUnresolved } from "@ref/state/eff";
import { createInitialState } from "@ref/state/state";
import { applySpace } from "@ref/vm/space";

type UnaryStep = {
  parent: string;
  child: string;
};

function applyUnary(state: ReturnType<typeof createInitialState>, op: LetterOp): UnaryStep {
  const parent = state.vm.F;
  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? parent : sealed.h;
  state.vm.R = sealed.r;

  return { parent, child: sealed.h };
}

describe("carry gradient matrix", () => {
  it("נ alone creates unresolved carry and advances focus", () => {
    const state = createInitialState();
    const step = applyUnary(state, nunOp);

    expect(state.vm.F).toBe(step.child);
    expect(state.cont.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.carry.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.supp.has(`${step.child}->${step.parent}`)).toBe(false);
    expect(isCarryUnresolved(state, step.parent, step.child, { focusNodeId: step.child })).toBe(
      true
    );
  });

  it("ן alone creates resolved carry with immediate supp and advances focus", () => {
    const state = createInitialState();
    const step = applyUnary(state, finalNunOp);

    expect(state.vm.F).toBe(step.child);
    expect(state.cont.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.carry.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.supp.has(`${step.child}->${step.parent}`)).toBe(true);
    expect(isCarryResolved(state, step.parent, step.child, { focusNodeId: step.child })).toBe(true);
    expect(state.handles.get(step.child)?.policy).toBe("framed_lock");
  });

  it("ז alone creates resolved carry, exports port, and keeps focus", () => {
    const state = createInitialState();
    const focusBefore = state.vm.F;
    const step = applyUnary(state, zayinOp);

    expect(state.vm.F).toBe(focusBefore);
    expect(state.vm.K.includes(step.child)).toBe(true);
    expect(state.cont.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.carry.has(`${step.parent}->${step.child}`)).toBe(true);
    expect(state.supp.has(`${step.child}->${step.parent}`)).toBe(true);
    expect(isCarryResolved(state, step.parent, step.child, { focusNodeId: step.child })).toBe(true);
    expect(state.handles.get(step.child)?.policy).toBe("framed_lock");
  });

  it("נ then ס resolves nun carry at current focus", () => {
    const state = createInitialState();
    const nunStep = applyUnary(state, nunOp);
    const samekhStep = applyUnary(state, samekhOp);

    expect(samekhStep.child).toBe(nunStep.child);
    expect(state.supp.has(`${samekhStep.child}->${nunStep.parent}`)).toBe(true);
    expect(
      isCarryResolved(state, nunStep.parent, nunStep.child, { focusNodeId: samekhStep.child })
    ).toBe(true);
    expect(state.vm.R).toBe(BOT_ID);
  });

  it("נ then □hard resolves nun carry via boundary-added supp", () => {
    const state = createInitialState();
    const nunStep = applyUnary(state, nunOp);
    state.vm.wordHasContent = true;

    applySpace(state, { mode: "hard" });

    expect(state.supp.has(`${nunStep.child}->${nunStep.parent}`)).toBe(true);
    expect(
      isCarryResolved(state, nunStep.parent, nunStep.child, { focusNodeId: nunStep.child })
    ).toBe(true);
  });

  it("נ then □glue then ס resolves word-1 carry across glue", () => {
    const state = createInitialState();
    const nunStep = applyUnary(state, nunOp);
    state.vm.wordHasContent = true;

    applySpace(state, { mode: "glue" });
    expect(
      isCarryUnresolved(state, nunStep.parent, nunStep.child, { focusNodeId: nunStep.child })
    ).toBe(true);

    const samekhStep = applyUnary(state, samekhOp);
    expect(samekhStep.child).toBe(nunStep.child);
    expect(state.supp.has(`${samekhStep.child}->${nunStep.parent}`)).toBe(true);
    expect(
      isCarryResolved(state, nunStep.parent, nunStep.child, { focusNodeId: samekhStep.child })
    ).toBe(true);
  });

  it("two נ then one ס closes only nearest unresolved carry", () => {
    const state = createInitialState();
    const n1 = applyUnary(state, nunOp);
    const n2 = applyUnary(state, nunOp);
    const s1 = applyUnary(state, samekhOp);

    expect(s1.child).toBe(n2.child);
    expect(state.supp.has(`${n2.child}->${n2.parent}`)).toBe(true);
    expect(isCarryResolved(state, n2.parent, n2.child, { focusNodeId: n2.child })).toBe(true);
    expect(isCarryUnresolved(state, n1.parent, n1.child, { focusNodeId: n2.child })).toBe(true);
  });

  it("two נ then two ס closes carries nearest-first, then earlier", () => {
    const state = createInitialState();
    const n1 = applyUnary(state, nunOp);
    const n2 = applyUnary(state, nunOp);

    const s1 = applyUnary(state, samekhOp);
    expect(s1.child).toBe(n2.child);
    expect(state.supp.has(`${n2.child}->${n2.parent}`)).toBe(true);
    expect(isCarryUnresolved(state, n1.parent, n1.child, { focusNodeId: n2.child })).toBe(true);

    const s2 = applyUnary(state, samekhOp);
    expect(s2.child).toBe(n2.child);
    expect(state.supp.has(`${n2.child}->${n1.parent}`)).toBe(true);
    expect(isCarryResolved(state, n1.parent, n1.child, { focusNodeId: n2.child })).toBe(true);
    expect(isCarryResolved(state, n2.parent, n2.child, { focusNodeId: n2.child })).toBe(true);
  });
});
