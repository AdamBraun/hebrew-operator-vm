import { describe, expect, it } from "vitest";
import { createInitialState, serializeState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

const MAPIQ_CASES = ["יָהּ", "לָהּ", "שְׁמָהּ", "בְּיָדָהּ", "אָרְכָּהּ"];

function normalizeWordText<T extends Record<string, any>>(value: T): T {
  const serialized = structuredClone(value);
  const events = serialized.vm?.H;
  if (!Array.isArray(events)) {
    return serialized;
  }
  for (const event of events) {
    if (event?.type !== "WORD_START" || !event.data || typeof event.data !== "object") {
      continue;
    }
    delete event.data.wordText;
  }
  return serialized;
}

describe("mappiq vs final he behavior", () => {
  it.each(MAPIQ_CASES)("final he with mappiq stays in the head-family topology (%s)", (word) => {
    const state = runProgram(word, createInitialState());
    expect(Array.from(state.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
    expect(state.rules).toEqual([]);
    expect(state.head_of.size).toBeGreaterThan(0);
    expect(Object.keys(state.adjuncts).length).toBeGreaterThan(0);
  });

  it("final he without mappiq has the same runtime topology as mappiq final he", () => {
    const dotted = runProgram("לָהּ", createInitialState());
    const plain = runProgram("לָה", createInitialState());

    expect(normalizeWordText(serializeState(dotted))).toEqual(
      normalizeWordText(serializeState(plain))
    );
    expect(Array.from(dotted.handles.values()).some((handle) => handle.kind === "rule")).toBe(
      false
    );
    expect(Array.from(plain.handles.values()).some((handle) => handle.kind === "rule")).toBe(false);
  });
});
