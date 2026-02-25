import { describe, expect, it } from "vitest";
import { OMEGA_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

describe("bet behavior", () => {
  it("bootstraps a seed referent at word entry and houses it", () => {
    const state = runProgram("ב", createInitialState());

    expect(state.boundaries.length).toBe(1);
    const boundary = state.boundaries[0];
    const boundaryHandle = state.handles.get(boundary.id);

    expect(boundaryHandle?.meta.openedBy).toBe("ב");

    const seeded = state.handles.get(boundary.inside);
    expect(seeded?.kind).toBe("entity");

    const boundaryEvent = state.vm.H.find(
      (event) => event.type === "boundary_open" && event.data?.id === boundary.id
    );
    expect(boundaryEvent).toBeDefined();
    expect(boundaryEvent?.data.inside).toBe(boundary.inside);
    expect(boundaryEvent?.data.outside).toBe(boundary.outside);
    expect(state.links).toContainEqual({
      from: boundary.inside,
      to: boundary.id,
      label: "boundary"
    });
    expect(state.links).toContainEqual({
      from: boundary.id,
      to: boundary.outside,
      label: "boundary"
    });

    expect(state.vm.D).toBe(OMEGA_ID);
    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(boundary.id);
  });

  it("deepens non-idempotently on repeated bet", () => {
    const state = runProgram("בב", createInitialState());
    expect(state.boundaries.length).toBe(2);

    const first = state.boundaries[0];
    const second = state.boundaries[1];
    expect(second.inside).toBe(first.id);
    expect(second.outside).toBe(first.id);
    expect(second.id).not.toBe(first.id);

    const wordOut = state.vm.A[state.vm.A.length - 1];
    expect(wordOut).toBe(second.id);

    const openedBoundaryIds = new Set(
      state.vm.H.filter((event) => event.type === "boundary_open")
        .map((event) => event.data?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    );
    expect(openedBoundaryIds.has(first.id)).toBe(true);
    expect(openedBoundaryIds.has(second.id)).toBe(true);
  });
});
