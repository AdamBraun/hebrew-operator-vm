import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace, runProgramWithTrace } from "@ref/vm/vm";

function collectWordStartEvents(
  input: string
): Array<{ tau: number; data: Record<string, unknown> }> {
  const { trace } = runProgramWithTrace(input, createInitialState());
  return trace.flatMap((entry) =>
    entry.events
      .filter((event) => event.type === "WORD_START")
      .map((event) => ({
        tau: event.tau,
        data: event.data as Record<string, unknown>
      }))
  );
}

describe("vm baseline construct allocation", () => {
  it("allocates a word-local baseline construct and sets focus(F) to it at word start", () => {
    const { deepTrace } = runProgramWithDeepTrace("א", createInitialState(), {
      includeStateSnapshots: true
    });
    const firstLetter = deepTrace.find((entry) => entry.token === "א");
    expect(firstLetter).toBeDefined();

    const contextPhase = firstLetter?.phases.find((phase) => phase.phase === "word_entry_context");
    const detail = (contextPhase?.detail ?? {}) as {
      active_construct?: string | null;
      focus?: string | null;
    };
    const activeConstruct = detail.active_construct ?? null;
    expect(typeof activeConstruct).toBe("string");
    expect(detail.focus).toBe(activeConstruct);

    const snapshot = contextPhase?.snapshot as
      | {
          handles?: Array<{
            id?: string;
            kind?: string;
            meta?: Record<string, unknown>;
          }>;
        }
      | undefined;
    const constructHandle = snapshot?.handles?.find((handle) => handle.id === activeConstruct);
    expect(constructHandle?.kind).toBe("scope");
    expect(constructHandle?.meta?.owner).toBe("word");
    expect(constructHandle?.meta?.construct_role).toBe("baseline");
    expect(constructHandle?.meta?.payload).toEqual({});
  });

  it("allocates a fresh baseline construct per word boundary", () => {
    const starts = collectWordStartEvents("א ב ג");
    expect(starts).toHaveLength(3);
    const ids = starts.map((event) => String(event.data.activeConstruct ?? ""));
    expect(new Set(ids).size).toBe(3);
    expect(starts.every((event) => event.data.focus === event.data.activeConstruct)).toBe(true);
  });
});
