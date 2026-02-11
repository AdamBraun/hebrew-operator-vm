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
  it("uses samekh on the read rail for שׂ and shin for שׁ", () => {
    const firstSin = firstLetter(runProgramWithTrace("שִׂמְחָה", createInitialState()).trace);
    const firstShin = firstLetter(runProgramWithTrace("שִׁמְחָה", createInitialState()).trace);

    expect(firstSin.read_op).toBe("ס");
    expect(firstShin.read_op).toBe("ש");
    expect(firstSin.shape_op).toBe("ש");
    expect(firstSin.route_mode).toBe("fork");
    expect(firstShin.route_mode).not.toBe("fork");
  });
});
