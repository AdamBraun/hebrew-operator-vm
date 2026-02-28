import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { OMEGA_ID } from "@ref/state/handles";
import {
  applyCarryState,
  extractCarryState,
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

    const carry = extractCarryState(state, "carry_omega_focus");
    expect(carry).toEqual({
      omegaHandleId: OMEGA_ID,
      focusHandleId: "focus:2"
    });
  });

  it("extracts omega + focus + domain for carry_omega_focus_domain mode", () => {
    const state = createInitialState();
    state.vm.F = "focus:3";
    state.vm.D = "domain:3";

    const carry = extractCarryState(state, "carry_omega_focus_domain");
    expect(carry).toEqual({
      omegaHandleId: OMEGA_ID,
      focusHandleId: "focus:3",
      domainHandleId: "domain:3"
    });
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

  it("applyCarryState uses omega as fallback for focus/domain when they are omitted", () => {
    const state = createInitialState();
    state.vm.F = "focus:old";
    state.vm.D = "domain:old";
    state.vm.wordEntryFocus = "word-entry:old";

    applyCarryState(state, {
      omegaHandleId: "omega:custom"
    });

    expect(state.vm.F).toBe("omega:custom");
    expect(state.vm.D).toBe("omega:custom");
    expect(state.vm.wordEntryFocus).toBe("omega:custom");
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

  it("onVerseEnd delegates to mode-specific carry extraction", () => {
    const state = createInitialState();
    state.vm.F = "focus:end";
    state.vm.D = "domain:end";

    const carry = onVerseEnd("Genesis/1/1", state, "carry_omega_focus_domain");
    expect(carry).toEqual({
      omegaHandleId: OMEGA_ID,
      focusHandleId: "focus:end",
      domainHandleId: "domain:end"
    });
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
});
