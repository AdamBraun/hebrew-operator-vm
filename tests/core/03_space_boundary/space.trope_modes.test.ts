import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgram, runProgramWithDeepTrace, runProgramWithTrace } from "@ref/vm/vm";

describe("trope-driven space modes", () => {
  it("glue creates/consumes pending join without hard-default resolution", () => {
    const { state, trace } = runProgramWithTrace("נ֣ ס", createInitialState());
    const glueBoundary = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "glue"
    );
    expect(glueBoundary).toBeDefined();
    expect(glueBoundary?.continuation).toBe(true);
    expect(glueBoundary?.pending_join_created).toBeDefined();

    const secondWord = trace.find((entry) => entry.token === "ס");
    expect(secondWord?.events.some((event) => event.type === "join_consume")).toBe(true);

    const fallsAtGlueTau = state.vm.H.filter(
      (event) => event.type === "fall" && event.tau === glueBoundary?.tauAfter
    );
    expect(fallsAtGlueTau.length).toBe(0);
    expect(state.vm.H_committed.some((chunk) => chunk.boundary_mode === "glue")).toBe(true);
  });

  it("emits join_blocked when pending join meets a left-context barrier", () => {
    const { trace } = runProgramWithTrace("א֑ ב֣ ג", createInitialState());
    const blockedWord = trace.find((entry) => entry.token === "ג");
    expect(blockedWord).toBeDefined();
    expect(blockedWord?.events.some((event) => event.type === "join_blocked")).toBe(true);
    expect(blockedWord?.events.some((event) => event.type === "join_consume")).toBe(false);
  });

  it("cut(rank=1) resolves obligations strictly (no silent fall/close)", () => {
    const { state, trace } = runProgramWithTrace("מנ֖ ס", createInitialState());
    const cutBoundary = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 1
    );
    expect(cutBoundary).toBeDefined();
    const tau = cutBoundary?.tauAfter ?? -1;

    expect(state.vm.H.some((event) => event.type === "mem_spill" && event.tau === tau)).toBe(true);
    expect(state.vm.H.some((event) => event.type === "support_debt" && event.tau === tau)).toBe(
      true
    );
    expect(state.vm.H.some((event) => event.type === "fall" && event.tau === tau)).toBe(false);
  });

  it("same-rank disjunctive cuts emit sibling nodes", () => {
    const state = runProgram("א֖ א֖ א", createInitialState());
    const rankOneNodes = Object.values(state.vm.CNodes).filter((node) => node.rank === 1);
    expect(rankOneNodes.length).toBe(2);
    expect(rankOneNodes[0].id).not.toBe(rankOneNodes[1].id);
    expect(rankOneNodes[0].parent_id).toBe(rankOneNodes[1].parent_id);
  });

  it("higher rank cut resets stack harder than rank 1 and closes same/lower containers", () => {
    const { state, trace } = runProgramWithTrace("א֖ א֑ א", createInitialState());
    const cutRank1 = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 1
    );
    const cutRank2 = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 2
    );
    expect(cutRank1).toBeDefined();
    expect(cutRank2).toBeDefined();
    expect((cutRank2?.KLength ?? 0) <= (cutRank1?.KLength ?? 0)).toBe(true);
    expect(cutRank2?.KLength).toBe(2);

    const rankOneNodes = Object.values(state.vm.CNodes).filter((node) => node.rank === 1);
    const rankTwoNodes = Object.values(state.vm.CNodes).filter((node) => node.rank === 2);
    expect(rankOneNodes.length).toBe(1);
    expect(rankTwoNodes.length).toBe(1);
    expect(rankOneNodes[0].parent_id).toBe("ROOT");
    expect(rankTwoNodes[0].parent_id).toBe("ROOT");
  });

  it("explicit terminal marker behaves like rank-3 cut and flushes phrase buffers", () => {
    const state = runProgram("א׃", createInitialState());
    expect(state.vm.H_phrase.length).toBe(0);
    expect(state.vm.CStack.length).toBe(1);
    expect(
      state.vm.H_committed.some((chunk) => chunk.boundary_mode === "cut" && chunk.rank === 3)
    ).toBe(true);
  });

  it("sof pasuq flushes mem-zone spill state from earlier cuts", () => {
    const { state, trace } = runProgramWithTrace("מ֖ א׃", createInitialState());
    const rankOneCut = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 1
    );
    const sofPasuqCut = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 3
    );

    expect(rankOneCut).toBeDefined();
    expect(sofPasuqCut).toBeDefined();

    const rankOneTau = rankOneCut?.tauAfter ?? -1;
    const sofTau = sofPasuqCut?.tauAfter ?? -1;

    expect(state.vm.H.some((event) => event.type === "mem_spill" && event.tau === rankOneTau)).toBe(
      true
    );
    expect(state.vm.H.some((event) => event.type === "mem_spill" && event.tau === sofTau)).toBe(
      false
    );

    const flushEvents = state.vm.H.filter(
      (event) => event.type === "mem_zone_flush" && event.tau === sofTau
    );
    expect(flushEvents.length).toBeGreaterThan(0);
    expect(flushEvents[0].data.reason).toBe("sof_pasuk");
    expect(typeof flushEvents[0].data.zoneId).toBe("string");

    expect(state.vm.OStack_word.some((obligation) => obligation.kind === "MEM_ZONE")).toBe(false);

    const liveMemZoneHandles = Array.from(state.handles.values()).filter(
      (handle) => handle.kind === "memZone" || handle.meta?.obligation === "MEM_ZONE"
    );
    expect(liveMemZoneHandles.length).toBe(0);
  });

  it("state snapshots after sof pasuq do not keep mem-zone handles active", () => {
    const { deepTrace } = runProgramWithDeepTrace("מ֖ א׃", createInitialState(), {
      includeStateSnapshots: true
    });
    const sofPasuqBoundary = deepTrace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "cut" && entry.rank === 3
    );
    expect(sofPasuqBoundary).toBeDefined();

    const exitSnapshot = sofPasuqBoundary?.phases.find(
      (phase) => phase.phase === "token_exit"
    )?.snapshot;
    expect(exitSnapshot).toBeDefined();

    const stack = exitSnapshot?.vm?.OStack_word as Array<{ kind?: string }>;
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.some((obligation) => obligation.kind === "MEM_ZONE")).toBe(false);

    const handles = exitSnapshot?.handles as Array<{ kind?: string; meta?: Record<string, any> }>;
    expect(
      handles.some((handle) => handle.kind === "memZone" || handle.meta?.obligation === "MEM_ZONE")
    ).toBe(false);
  });

  it("maqqef boundary forces glue semantics even without left trope", () => {
    const { state, trace } = runProgramWithTrace("מ־נ֖", createInitialState());
    const maqqefBoundary = trace.find(
      (entry) => entry.token === "□" && entry.boundary_mode === "glue_maqqef"
    );
    expect(maqqefBoundary).toBeDefined();
    const seamTau = maqqefBoundary?.tauAfter ?? -1;
    const resolvedAtSeam = state.vm.H.filter(
      (event) =>
        event.tau === seamTau &&
        (event.type === "fall" || event.type === "mem_spill" || event.type === "support_debt")
    );
    expect(resolvedAtSeam.length).toBe(0);
  });
});
