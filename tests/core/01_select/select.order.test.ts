import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { selectOperands } from "@ref/vm/select";
import { LetterMeta } from "@ref/letters/types";

describe("select order", () => {
  it("consumes required operands in order K, W, F, R, Ω", () => {
    const state = createInitialState();
    state.vm = {
      ...state.vm,
      K: ["k1", "k2"],
      W: ["w1", "w2"],
      F: "f1",
      R: "r1",
      D: "omega"
    };

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 5,
      arity_opt: 0,
      distinct_required: false,
      distinct_optional: false,
      reflexive_ok: true
    };

    const { ops } = selectOperands(state, meta);
    expect(ops.args).toEqual(["k2", "k1", "w1", "w2", "f1"]);
  });
});
