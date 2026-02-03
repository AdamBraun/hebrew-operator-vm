import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { selectOperands } from "@ref/vm/select";
import { LetterMeta } from "@ref/letters/types";

describe("select order", () => {
  it("consumes required operands in order K, W, F, R, Ω", () => {
    const state = createInitialState();
    state.vm.K = ["k1", "k2"];
    state.vm.W = ["w1", "w2"];
    state.vm.F = "f1";
    state.vm.R = "r1";
    state.vm.Omega = "omega";

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
