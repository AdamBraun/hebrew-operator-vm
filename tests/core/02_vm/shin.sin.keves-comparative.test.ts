import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithTrace } from "@ref/vm/vm";

function nonSpace(trace: ReturnType<typeof runProgramWithTrace>["trace"]) {
  return trace.filter((step) => step.token !== "□");
}

function eventTypes(entry: ReturnType<typeof nonSpace>[number]): string[] {
  return entry.events.map((event) => event.type);
}

describe("כבשׁ vs כבשׂ fork divergence", () => {
  it("keeps capacity->deepen identical and diverges only at fork direction/topology", () => {
    const shinRun = runProgramWithTrace("כבשׁ", createInitialState());
    const sinRun = runProgramWithTrace("כבשׂ", createInitialState());
    const shinTrace = nonSpace(shinRun.trace);
    const sinTrace = nonSpace(sinRun.trace);

    expect(shinTrace.length).toBe(3);
    expect(sinTrace.length).toBe(3);

    for (const index of [0, 1]) {
      expect(shinTrace[index].read_op).toBe(sinTrace[index].read_op);
      expect(shinTrace[index].shape_op).toBe(sinTrace[index].shape_op);
      expect(eventTypes(shinTrace[index])).toEqual(eventTypes(sinTrace[index]));
    }

    const shinFork = shinTrace[2].events.find((event) => event.type === "shin");
    const sinFork = sinTrace[2].events.find((event) => event.type === "shin");
    expect(shinFork?.data?.direction).toBe("external");
    expect(sinFork?.data?.direction).toBe("internal");

    const shinFocus = String(shinFork?.data?.focus ?? "");
    const shinPorts = [shinFork?.data?.spine, shinFork?.data?.left, shinFork?.data?.right].map(
      (id) => String(id)
    );
    for (const port of shinPorts) {
      expect(shinRun.state.cont.has(`${shinFocus}->${port}`)).toBe(true);
      expect(shinRun.state.sub.has(`${shinFocus}->${port}`)).toBe(false);
    }

    const sinFocus = String(sinFork?.data?.focus ?? "");
    const sinPorts = [sinFork?.data?.spine, sinFork?.data?.left, sinFork?.data?.right].map((id) =>
      String(id)
    );
    for (const port of sinPorts) {
      expect(sinRun.state.sub.has(`${sinFocus}->${port}`)).toBe(true);
      expect(sinRun.state.cont.has(`${sinFocus}->${port}`)).toBe(false);
    }
  });
});
