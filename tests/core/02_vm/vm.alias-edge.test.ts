import { describe, expect, it } from "vitest";
import { aliasReachable, hasAliasEdge } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { runProgram } from "@ref/vm/vm";

type WordStartPayload = {
  inboundFocus?: string;
  activeConstruct?: string;
  hasAliasForward?: boolean;
  hasAliasReverse?: boolean;
  aliasReachableForward?: boolean;
  aliasReachableReverse?: boolean;
};

function wordStartPairs(state: ReturnType<typeof runProgram>): Array<{
  inboundFocus: string;
  activeConstruct: string;
}> {
  const pairs: Array<{ inboundFocus: string; activeConstruct: string }> = [];
  for (const event of state.vm.H) {
    if (event.type !== "WORD_START") {
      continue;
    }
    const data = (event.data ?? {}) as WordStartPayload;
    const inboundFocus = String(data.inboundFocus ?? "");
    const activeConstruct = String(data.activeConstruct ?? "");
    if (!inboundFocus || !activeConstruct) {
      continue;
    }
    pairs.push({ inboundFocus, activeConstruct });
  }
  return pairs;
}

describe("vm alias edges", () => {
  it("adds symmetric alias edges between inbound focus and C0", () => {
    const state = runProgram("א", createInitialState());
    const start = state.vm.H.find((event) => event.type === "WORD_START");
    const data = (start?.data ?? {}) as WordStartPayload;
    const inboundFocus = String(data.inboundFocus ?? "");
    const activeConstruct = String(data.activeConstruct ?? "");

    expect(inboundFocus).not.toBe("");
    expect(activeConstruct).not.toBe("");
    expect(hasAliasEdge(state, inboundFocus, activeConstruct)).toBe(true);
    expect(hasAliasEdge(state, activeConstruct, inboundFocus)).toBe(true);
  });

  it("supports bidirectional alias traversal between F0 and C0", () => {
    const state = runProgram("א", createInitialState());
    const start = state.vm.H.find((event) => event.type === "WORD_START");
    const data = (start?.data ?? {}) as WordStartPayload;
    const inboundFocus = String(data.inboundFocus ?? "");
    const activeConstruct = String(data.activeConstruct ?? "");

    expect(aliasReachable(state, inboundFocus, activeConstruct)).toBe(true);
    expect(aliasReachable(state, activeConstruct, inboundFocus)).toBe(true);
  });

  it("records alias edges for each word boundary", () => {
    const state = runProgram("א ב ג", createInitialState());
    const pairs = wordStartPairs(state);
    expect(pairs).toHaveLength(3);
    const starts = state.vm.H.filter((event) => event.type === "WORD_START").map(
      (event) => (event.data ?? {}) as WordStartPayload
    );
    for (const start of starts) {
      expect(start.hasAliasForward).toBe(true);
      expect(start.hasAliasReverse).toBe(true);
      expect(start.aliasReachableForward).toBe(true);
      expect(start.aliasReachableReverse).toBe(true);
    }
  });
});
