import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { OMEGA_ID, createHandle } from "@ref/state/handles";
import {
  applyCarryState,
  cleanupAtVerseBoundary,
  extractCarryState,
  finalizeVerseScope,
  onVerseEnd,
  onVerseStart,
  type CarryState
} from "@ref/runtime/carryState";

describe("runtime carry state", () => {
  it("extracts an empty carry state for reset mode", () => {
    const state = createInitialState();
    const carry = extractCarryState(state, "reset");
    expect(carry).toEqual({});
  });

  it("extracts only omega for carry_omega mode", () => {
    const state = createInitialState();
    state.vm.F = "focus:1";
    state.vm.D = "domain:1";

    const carry = extractCarryState(state, "carry_omega");
    expect(carry).toEqual({
      omegaHandleId: OMEGA_ID
    });
  });

  it("extracts omega + focus for carry_omega_focus mode", () => {
    const state = createInitialState();
    state.vm.F = "focus:2";
    state.vm.D = "domain:2";
    (state as { Omega?: string }).Omega = "Ωv:Genesis_1_1";

    const carry = extractCarryState(state, "carry_omega_focus");
    expect(carry).toEqual({
      omegaHandleId: "Ωv:Genesis_1_1",
      focusHandleId: "focus:2"
    });
  });

  it("extracts omega + focus + domain for carry_omega_focus_domain mode", () => {
    const state = createInitialState();
    state.vm.F = "focus:3";
    state.vm.D = "domain:3";
    (state as { Omega?: string }).Omega = "Ωv:Genesis_1_2";

    const carry = extractCarryState(state, "carry_omega_focus_domain");
    expect(carry).toEqual({
      omegaHandleId: "Ωv:Genesis_1_2",
      focusHandleId: "focus:3",
      domainHandleId: "domain:3"
    });
  });

  it("extracts pinned handle ids in carry modes", () => {
    const state = createInitialState();
    state.handles.set(
      "pin:z",
      createHandle("pin:z", "entity", { pinned: true, meta: { pinned: true } })
    );
    state.handles.set(
      "pin:a",
      createHandle("pin:a", "entity", { pinned: true, meta: { pinned: true } })
    );

    const carry = extractCarryState(state, "carry_omega");
    expect(carry.omegaHandleId).toBe(OMEGA_ID);
    expect(carry.pinnedHandleIds).toEqual(["pin:a", "pin:z"]);
  });

  it("applyCarryState is a no-op for an empty carry", () => {
    const state = createInitialState();
    state.vm.F = "focus:base";
    state.vm.D = "domain:base";
    state.vm.wordEntryFocus = "word-entry:base";

    applyCarryState(state, {});

    expect(state.vm.F).toBe("focus:base");
    expect(state.vm.D).toBe("domain:base");
    expect(state.vm.wordEntryFocus).toBe("word-entry:base");
  });

  it("applyCarryState updates only fields that are provided", () => {
    const state = createInitialState();
    state.vm.F = "focus:base";
    state.vm.D = "domain:base";
    state.vm.wordEntryFocus = "word-entry:base";

    const carry: CarryState = {
      focusHandleId: "focus:new"
    };
    applyCarryState(state, carry);

    expect(state.vm.F).toBe("focus:new");
    expect(state.vm.D).toBe("domain:base");
    expect(state.vm.wordEntryFocus).toBe("word-entry:base");
  });

  it("applyCarryState updates omega pointer without overriding focus/domain when omitted", () => {
    const state = createInitialState();
    state.vm.F = "focus:old";
    state.vm.D = "domain:old";
    state.vm.wordEntryFocus = "word-entry:old";

    applyCarryState(state, {
      omegaHandleId: "omega:custom"
    });

    expect(state.vm.F).toBe("focus:old");
    expect(state.vm.D).toBe("domain:old");
    expect(state.vm.wordEntryFocus).toBe("omega:custom");
    expect((state as { Omega?: string }).Omega).toBe("omega:custom");
  });

  it("reset-mode extract + apply leaves state unchanged", () => {
    const state = createInitialState();
    state.vm.F = "focus:unchanged";
    state.vm.D = "domain:unchanged";
    state.vm.wordEntryFocus = "entry:unchanged";

    const carry = extractCarryState(state, "reset");
    applyCarryState(state, carry);

    expect(state.vm.F).toBe("focus:unchanged");
    expect(state.vm.D).toBe("domain:unchanged");
    expect(state.vm.wordEntryFocus).toBe("entry:unchanged");
  });

  it("finalizeVerseScope creates/reuses verse-boundary omega and links produced handles", () => {
    const state = createInitialState();
    state.handles.set("h:1", createHandle("h:1", "entity"));
    state.handles.set("h:2", createHandle("h:2", "entity"));

    const first = finalizeVerseScope(state, "Genesis/1/1");
    const second = finalizeVerseScope(state, "Genesis/1/1");

    expect(first.omegaHandleId).toBe("Ωv:Genesis_1_1");
    expect(second.omegaHandleId).toBe("Ωv:Genesis_1_1");
    expect((state as { Omega?: string }).Omega).toBe("Ωv:Genesis_1_1");
    expect(state.vm.wordEntryFocus).toBe("Ωv:Genesis_1_1");
    expect(state.handles.get("Ωv:Genesis_1_1")?.kind).toBe("boundary");
    expect(state.handles.get("Ωv:Genesis_1_1")?.meta?.verse_scope).toBe(1);
    expect(
      state.links.filter((link) => link.from === "h:1" && link.to === "Ωv:Genesis_1_1")
    ).toHaveLength(1);
    expect(
      state.links.filter((link) => link.from === "h:2" && link.to === "Ωv:Genesis_1_1")
    ).toHaveLength(1);
  });

  it("onVerseEnd delegates to mode-specific carry extraction with finalized omega", () => {
    const state = createInitialState();
    state.vm.F = "focus:end";
    state.vm.D = "domain:end";

    const carry = onVerseEnd("Genesis/1/1", state, "carry_omega_focus_domain");
    expect(carry).toEqual({
      omegaHandleId: "Ωv:Genesis_1_1",
      focusHandleId: "focus:end",
      domainHandleId: "domain:end"
    });
    expect((state as { Omega?: string }).Omega).toBe("Ωv:Genesis_1_1");
  });

  it("onVerseStart applies incoming carry in non-reset modes", () => {
    const state = createInitialState();
    state.vm.F = "focus:old";
    state.vm.D = "domain:old";

    onVerseStart("Genesis/1/2", state, "carry_omega_focus_domain", {
      omegaHandleId: "omega:new",
      focusHandleId: "focus:new",
      domainHandleId: "domain:new"
    });

    expect(state.vm.F).toBe("focus:new");
    expect(state.vm.D).toBe("domain:new");
    expect(state.vm.wordEntryFocus).toBe("omega:new");
    expect((state as { Omega?: string }).Omega).toBe("omega:new");
    expect(state.handles.has("omega:new")).toBe(true);
  });

  it("onVerseStart restores pinned handles from incoming carry", () => {
    const state = createInitialState();
    onVerseStart("Genesis/1/2", state, "carry_omega", {
      omegaHandleId: "omega:new",
      pinnedHandleIds: ["pin:1", "pin:2"]
    });

    expect(state.handles.has("pin:1")).toBe(true);
    expect(state.handles.has("pin:2")).toBe(true);
    expect(state.handles.get("pin:1")?.pinned).toBe(true);
    expect(state.handles.get("pin:2")?.pinned).toBe(true);
  });

  it("cleanupAtVerseBoundary keeps root-reachable handles and drops mem-zones/unreachable", () => {
    const state = createInitialState();
    state.handles.set("omega:root", createHandle("omega:root", "boundary"));
    state.handles.set("focus:root", createHandle("focus:root", "scope"));
    state.handles.set("keep:linked", createHandle("keep:linked", "entity"));
    state.handles.set("drop:free", createHandle("drop:free", "entity"));
    state.handles.set("drop:mem", createHandle("drop:mem", "memZone"));
    state.links.push({ from: "focus:root", to: "keep:linked", label: "member_of" });
    state.links.push({ from: "focus:root", to: "drop:mem", label: "member_of" });

    const result = cleanupAtVerseBoundary(state, {
      omegaHandleId: "omega:root",
      focusHandleId: "focus:root"
    });

    expect(result.droppedCount).toBe(2);
    expect(state.handles.has("omega:root")).toBe(true);
    expect(state.handles.has("focus:root")).toBe(true);
    expect(state.handles.has("keep:linked")).toBe(true);
    expect(state.handles.has("drop:free")).toBe(false);
    expect(state.handles.has("drop:mem")).toBe(false);
    expect(state.links.some((link) => link.from === "focus:root" && link.to === "drop:mem")).toBe(
      false
    );
  });

  it("continual mode cleanup drops stale pre-verse handles while keeping current roots", () => {
    const state = createInitialState();
    state.handles.set("stale:1", createHandle("stale:1", "entity"));

    onVerseStart("Genesis/1/2", state, "carry_omega", {});
    state.handles.set("new:1", createHandle("new:1", "entity"));

    const carry = onVerseEnd("Genesis/1/2", state, "carry_omega");
    expect(carry.omegaHandleId).toBe("Ωv:Genesis_1_2");
    expect(state.handles.has("stale:1")).toBe(false);
    expect(state.handles.has("new:1")).toBe(true);
    expect(state.handles.has("Ωv:Genesis_1_2")).toBe(true);
  });

  it("onVerseStart is a no-op in reset mode", () => {
    const state = createInitialState();
    state.vm.F = "focus:kept";
    state.vm.D = "domain:kept";
    state.vm.wordEntryFocus = "entry:kept";

    onVerseStart("Genesis/1/3", state, "reset", {
      omegaHandleId: "omega:ignored",
      focusHandleId: "focus:ignored",
      domainHandleId: "domain:ignored"
    });

    expect(state.vm.F).toBe("focus:kept");
    expect(state.vm.D).toBe("domain:kept");
    expect(state.vm.wordEntryFocus).toBe("entry:kept");
  });

  it("reset mode does not carry verse boundary omega into the next verse", () => {
    const endedState = createInitialState();
    endedState.handles.set("h:end", createHandle("h:end", "entity"));
    const carry = onVerseEnd("Genesis/1/1", endedState, "reset");

    const startState = createInitialState();
    onVerseStart("Genesis/1/2", startState, "reset", carry);

    expect(carry).toEqual({});
    expect(startState.vm.wordEntryFocus).toBe(OMEGA_ID);
    expect((startState as { Omega?: string }).Omega).toBeUndefined();
    expect(startState.handles.has("Ωv:Genesis_1_1")).toBe(false);
  });
});
