import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { runProgramWithTrace } from "../../vm/vm";

describe("vm implicit boundaries", () => {
  it("program prepends and appends □", () => {
    const { trace } = runProgramWithTrace("נ", createInitialState());
    expect(trace[0].token).toBe("□");
    expect(trace[trace.length - 1].token).toBe("□");
  });

  it("empty input still executes leading and trailing boundaries", () => {
    const { trace } = runProgramWithTrace("", createInitialState());
    expect(trace.length).toBe(2);
    expect(trace[0].token).toBe("□");
    expect(trace[1].token).toBe("□");
  });
});
