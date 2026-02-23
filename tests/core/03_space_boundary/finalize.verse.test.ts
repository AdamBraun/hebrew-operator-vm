import { describe, expect, it } from "vitest";
import { createHandle, BOT_ID, OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { finalizeVerse } from "@ref/runtime/finalizeVerse";
import { validateBaseline } from "@ref/runtime/validateBaseline";
import { runProgramWithTrace } from "@ref/vm/vm";

describe("finalizeVerse", () => {
  it("captures an immutable pre-reset snapshot and then restores baseline runtime state", () => {
    const state = createInitialState();
    runProgramWithTrace("מ֖ א׃", state);

    const tauBefore = state.vm.tau;
    const eventsBefore = state.vm.H.length;
    const handlesBefore = state.handles.size;
    const linksBefore = state.links.length;
    const boundariesBefore = state.boundaries.length;
    const rulesBefore = state.rules.length;

    const snapshot = finalizeVerse(state, {
      ref: "Genesis/1/1",
      cleaned: "מ֖ א׃"
    });

    expect(snapshot.ref).toBe("Genesis/1/1");
    expect(snapshot.cleaned).toBe("מ֖ א׃");
    expect(snapshot.tau_end).toBe(tauBefore);
    expect(snapshot.metrics).toEqual({
      handles: handlesBefore,
      links: linksBefore,
      boundaries: boundariesBefore,
      rules: rulesBefore,
      events: eventsBefore
    });
    expect(snapshot.state_dump.vm.tau).toBe(tauBefore);
    expect(Array.isArray(snapshot.state_dump.vm.H)).toBe(true);
    expect(snapshot.state_dump.vm.H.length).toBe(eventsBefore);
    expect(
      snapshot.state_dump.vm.H.some((event: { type?: string }) => event.type === "mem_zone_flush")
    ).toBe(true);
    expect(Array.isArray(snapshot.state_dump.handles)).toBe(true);
    expect(snapshot.state_dump.handles.length).toBe(handlesBefore);

    expect(state.vm.tau).toBe(0);
    expect(state.vm.Omega).toBe(OMEGA_ID);
    expect(state.vm.F).toBe(OMEGA_ID);
    expect(state.vm.R).toBe(BOT_ID);
    expect(state.vm.K).toEqual([OMEGA_ID, BOT_ID]);
    expect(state.vm.W).toEqual([]);
    expect(state.vm.A).toEqual([]);
    expect(state.vm.E).toEqual([]);
    expect(state.vm.OStack_word).toEqual([]);
    expect(state.vm.H).toEqual([]);
    expect(state.vm.H_phrase).toEqual([]);
    expect(state.vm.H_committed).toEqual([]);
    expect(state.vm.phraseWordValues).toEqual([]);
    expect(state.vm.PendingJoin).toBeUndefined();
    expect(state.vm.wordLastSealedArtifact).toBeUndefined();
    expect(state.vm.wordEntryFocus).toBe(OMEGA_ID);
    expect(state.vm.wordHasContent).toBe(false);
    expect(state.vm.CStack).toEqual([{ rank: Number.MAX_SAFE_INTEGER, node_id: "ROOT" }]);
    expect(Object.keys(state.vm.CNodes)).toEqual(["ROOT"]);
    expect(state.links).toEqual([]);
    expect(state.boundaries).toEqual([]);
    expect(state.rules).toEqual([]);
    expect(Array.from(state.cont)).toEqual([]);
    expect(Array.from(state.handles.keys())).toEqual([OMEGA_ID, BOT_ID]);

    state.vm.F = BOT_ID;
    expect(snapshot.state_dump.vm.F).not.toBe(BOT_ID);
  });

  it("throws a clear invariant report for invalid baseline state", () => {
    const state = createInitialState();
    (state.vm as any).leaky = ["leftover"];
    state.vm.F = BOT_ID;

    expect(() => validateBaseline(state, { context: "unit-test" })).toThrow(
      /Post-reset baseline invariant failed \(unit-test\)/u
    );
    expect(() => validateBaseline(state, { context: "unit-test" })).toThrow(
      /vm\.F expected Ω but got ⊥/u
    );
    expect(() => validateBaseline(state, { context: "unit-test" })).toThrow(
      /Unexpected vm baseline fields detected: leaky/u
    );
  });

  it("validates post-reset baseline and fails on leaked VM fields", () => {
    const state = createInitialState();
    runProgramWithTrace("א׃", state);
    (state.vm as any).leaky = ["leftover"];

    expect(() => finalizeVerse(state, { ref: "Genesis/1/1" })).toThrow(
      /Unexpected vm baseline fields detected: leaky/u
    );
  });

  it("allows skipping baseline validation when explicitly disabled", () => {
    const state = createInitialState();
    runProgramWithTrace("א׃", state);
    (state.vm as any).leaky = ["leftover"];

    expect(() => finalizeVerse(state, { validateBaseline: false })).not.toThrow();
  });

  it("preserves explicit system handles and meta counters when requested", () => {
    const state = createInitialState();
    state.handles.set("SYS", createHandle("SYS", "watch", { meta: { role: "system" } }));
    state.handles.set("TMP", createHandle("TMP", "entity"));
    state.vm.metaCounter = { omega: 3, tau: 9 };

    const snapshot = finalizeVerse(state, {
      keepSystemHandles: new Set(["SYS"]),
      preserveCounters: true
    });

    expect(snapshot.state_dump.handles.some((handle: { id?: string }) => handle.id === "TMP")).toBe(
      true
    );
    expect(Array.from(state.handles.keys())).toEqual([OMEGA_ID, BOT_ID, "SYS"]);
    expect(state.handles.has("TMP")).toBe(false);
    expect(state.vm.metaCounter).toEqual({ omega: 3, tau: 9 });
  });

  it("returns canonical ordering for graph arrays in the snapshot", () => {
    const state = createInitialState();
    state.links = [
      { from: "b", to: "a", label: "x" },
      { from: "a", to: "a", label: "z" },
      { from: "a", to: "a", label: "a" }
    ];
    state.boundaries = [
      { id: "b2", inside: "i1", outside: "o2", anchor: 1 },
      { id: "b1", inside: "i2", outside: "o1", anchor: 0 }
    ];
    state.rules = [
      { priority: 2, id: "r2", target: "t2", patch: { z: 1, a: 2 } },
      { priority: 1, id: "r1", target: "t1", patch: { b: 1, a: 2 } }
    ];
    state.cont = new Set(["z->a", "a->b"]);

    const snapshot = finalizeVerse(state);
    const links = snapshot.state_dump.links as Array<{ from: string; to: string; label: string }>;
    const boundaries = snapshot.state_dump.boundaries as Array<{
      id: string;
      inside: string;
      outside: string;
      anchor: number;
    }>;
    const rules = snapshot.state_dump.rules as Array<{
      priority: number;
      id: string;
      target: string;
    }>;
    const cont = snapshot.state_dump.cont as string[];

    expect(links).toEqual([
      { from: "a", to: "a", label: "a" },
      { from: "a", to: "a", label: "z" },
      { from: "b", to: "a", label: "x" }
    ]);
    expect(boundaries).toEqual([
      { id: "b1", inside: "i2", outside: "o1", anchor: 0 },
      { id: "b2", inside: "i1", outside: "o2", anchor: 1 }
    ]);
    expect(rules).toEqual([
      { priority: 1, id: "r1", target: "t1", patch: { a: 2, b: 1 } },
      { priority: 2, id: "r2", target: "t2", patch: { a: 2, z: 1 } }
    ]);
    expect(cont).toEqual(["a->b", "z->a"]);
  });

  it("wires sof pasuq boundaries to finalizeVerse for multi-verse runs", () => {
    const state = createInitialState();
    const callbackSnapshots: number[] = [];
    const { trace, verseSnapshots } = runProgramWithTrace("מ֖ א׃ ב׃", state, {
      finalizeAtVerseEnd: true,
      onVerseSnapshot: (snapshot) => {
        callbackSnapshots.push(snapshot.tau_end);
      }
    });

    const sofPasuqBoundaries = trace.filter(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 3
    );
    expect(sofPasuqBoundaries.length).toBe(2);
    expect(verseSnapshots.length).toBe(2);
    expect(callbackSnapshots).toEqual(verseSnapshots.map((snapshot) => snapshot.tau_end));

    expect(
      verseSnapshots[0].state_dump.vm.H.some(
        (event: { type?: string }) => event.type === "mem_zone_flush"
      )
    ).toBe(true);
    expect((verseSnapshots[0].state_dump.handles as Array<{ id: string }>).length).toBeGreaterThan(
      2
    );
    expect(verseSnapshots[1].tau_end).toBeLessThanOrEqual(4);

    expect(state.vm.tau).toBe(0);
    expect(state.vm.Omega).toBe(OMEGA_ID);
    expect(state.vm.F).toBe(OMEGA_ID);
    expect(state.vm.R).toBe(BOT_ID);
    expect(state.vm.K).toEqual([OMEGA_ID, BOT_ID]);
    expect(state.vm.H).toEqual([]);
    expect(state.links).toEqual([]);
    expect(state.boundaries).toEqual([]);
    expect(state.rules).toEqual([]);
    expect(Array.from(state.cont)).toEqual([]);
    expect(Array.from(state.handles.keys())).toEqual([OMEGA_ID, BOT_ID]);
  });
});
