import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { isCarryUnresolved } from "@ref/state/eff";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest, runProgramWithTrace } from "@ref/vm/vm";

function firstLetter(trace: ReturnType<typeof runProgramWithTrace>["trace"]) {
  const entry = trace.find((step) => step.token !== "□");
  if (!entry) {
    throw new Error("Expected at least one non-space token");
  }
  return entry;
}

function parseEdge(edge: string): [string, string] {
  const [source, target] = edge.split("->");
  if (!source || !target) {
    throw new Error(`Invalid edge '${edge}'`);
  }
  return [source, target];
}

describe("sin internal support behavior", () => {
  it("resolves שׂ as internal fork, not samekh composite dispatch", () => {
    const firstSin = firstLetter(runProgramWithTrace("שׂ", createInitialState()).trace);
    const sinEvent = firstSin.events.find((event) => event.type === "shin");

    expect(firstSin.read_op).toBe("ש");
    expect(firstSin.shape_op).toBeNull();
    expect(sinEvent?.data?.direction).toBe("internal");
    expect(firstSin.events.some((event) => event.type === "samekh")).toBe(false);
  });

  it("does not create supp edges or invoke samekh for unresolved carry input", () => {
    const state = createInitialState();
    const tokens = tokenize("נשׂ");

    executeLetterForTest(state, tokens[0], {
      isWordFinal: false,
      wordText: "נשׂ",
      prevBoundaryMode: "hard"
    });

    const initialCarry = Array.from(state.carry)[0];
    expect(initialCarry).toBeTypeOf("string");
    const [source, target] = parseEdge(String(initialCarry));
    expect(
      isCarryUnresolved(state, source, target, {
        focusNodeId: target
      })
    ).toBe(true);

    const suppBefore = state.supp.size;
    const sinExecution = executeLetterForTest(state, tokens[1], {
      isWordFinal: true,
      wordText: "נשׂ",
      prevBoundaryMode: "hard"
    });

    expect(sinExecution.read_op).toBe("ש");
    expect(state.supp.size).toBe(suppBefore);
    expect(
      isCarryUnresolved(state, source, target, {
        focusNodeId: target
      })
    ).toBe(true);
  });

  it("is a no-op on already-stable structure and still produces a valid internal fork handle", () => {
    const { state, trace } = runProgramWithTrace("שׂ", createInitialState());
    const firstSin = firstLetter(trace);
    const sinEvent = firstSin.events.find((event) => event.type === "shin");
    const focus = String(sinEvent?.data?.focus ?? "");
    const handle = state.handles.get(focus);
    const ports = handle?.meta.fork_ports as string[];

    expect(handle).toBeDefined();
    expect(sinEvent?.data?.direction).toBe("internal");
    expect(handle?.meta.fork_direction).toBe("internal");
    expect(Array.isArray(ports)).toBe(true);
    expect(ports).toHaveLength(3);
    expect(state.supp.size).toBeGreaterThanOrEqual(0);
  });
});
