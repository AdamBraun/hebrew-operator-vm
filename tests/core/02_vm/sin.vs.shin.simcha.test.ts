import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithTrace, TraceEntry } from "@ref/vm/vm";

function firstLetter(trace: TraceEntry[]): TraceEntry {
  const entry = trace.find((step) => step.token !== "□");
  if (!entry) {
    throw new Error("Expected at least one non-space token");
  }
  return entry;
}

describe("sin vs shin in simcha", () => {
  it("uses shin fork in both forms, with direction controlled by dot side", () => {
    const firstSin = firstLetter(runProgramWithTrace("שִׂמְחָה", createInitialState()).trace);
    const firstShin = firstLetter(runProgramWithTrace("שִׁמְחָה", createInitialState()).trace);
    const sinEvent = firstSin.events.find((event) => event.type === "shin");
    const shinEvent = firstShin.events.find((event) => event.type === "shin");

    expect(firstSin.read_op).toBe("ש");
    expect(firstShin.read_op).toBe("ש");
    expect(firstSin.shape_op).toBeNull();
    expect(firstShin.shape_op).toBeNull();
    expect(sinEvent?.data?.direction).toBe("internal");
    expect(shinEvent?.data?.direction).toBe("external");
  });
});
