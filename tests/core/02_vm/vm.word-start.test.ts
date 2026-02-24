import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithTrace } from "@ref/vm/vm";

function collectWordStartEntries(input: string): Array<{
  token: string;
  event: { type: string; tau: number; data: Record<string, unknown> };
}> {
  const { trace } = runProgramWithTrace(input, createInitialState());
  return trace.flatMap((entry) =>
    entry.events
      .filter((event) => event.type === "WORD_START")
      .map((event) => ({
        token: entry.token,
        event
      }))
  );
}

describe("vm WORD_START hook", () => {
  it("fires exactly once per word", () => {
    const starts = collectWordStartEntries("א ב ג");
    expect(starts).toHaveLength(3);
    expect(starts.map((entry) => entry.token)).toEqual(["א", "ב", "ג"]);
  });

  it("does not fire on non-initial letters within a word", () => {
    const { trace } = runProgramWithTrace("נָס", createInitialState());
    const starts = trace.flatMap((entry) =>
      entry.events.filter((event) => event.type === "WORD_START")
    );
    expect(starts).toHaveLength(1);
    const secondLetter = trace.find((entry) => entry.token === "ס");
    expect(secondLetter?.events.some((event) => event.type === "WORD_START")).toBe(false);
    expect(starts[0]?.data.wordText).toBe("נָס".normalize("NFD"));
  });

  it("fires across punctuation boundaries", () => {
    const starts = collectWordStartEntries("א׃ ב");
    expect(starts).toHaveLength(2);
  });
});
