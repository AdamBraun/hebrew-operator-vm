import { describe, expect, it } from "vitest";
import { tokenize } from "@ref/compile/tokenizer";
import { RuntimeError } from "@ref/vm/errors";
import { contReachable } from "@ref/state/relations";
import { createInitialState } from "@ref/state/state";
import { executeLetterForTest, runProgram } from "@ref/vm/vm";

describe("runtime errors", () => {
  it("final mem with non-mem obligation does not throw", () => {
    expect(() => runProgram("נם", createInitialState())).not.toThrow(RuntimeError);
  });

  it("dalet does not depend on boundary obligations", () => {
    const state = runProgram("נד", createInitialState());
    const [head, whole] = String(Array.from(state.head_of)[0] ?? "->").split("->");
    expect(state.boundaries).toEqual([]);
    expect(state.head_of.size).toBe(1);
    expect(state.supp.has(`${head}->${whole}`)).toBe(true);
  });

  it("cont reachability on missing nodes returns false", () => {
    const state = createInitialState();
    expect(contReachable(state, "missing", "also-missing")).toBe(false);
  });

  it("fails early when WordStart baseline construct is missing", () => {
    const state = createInitialState();
    state.vm.wordHasContent = true;
    state.vm.activeConstruct = undefined;
    const [token] = tokenize("א");
    expect(token?.letter).toBe("א");
    expect(() => executeLetterForTest(state, token!)).toThrow(
      "WordStart must allocate C0 before letters run"
    );
  });
});
