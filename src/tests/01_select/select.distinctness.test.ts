import { describe, expect, it } from "vitest";
import { createInitialState } from "../../state/state";
import { selectOperands } from "../../vm/select";
import { LetterMeta } from "../../letters/types";
import { RuntimeError } from "../../vm/errors";

describe("select distinctness", () => {
  it("distinct_required enforces unique ids when possible", () => {
    const state = createInitialState();
    state.vm.K = ["k1", "k2"];
    state.vm.W = [];
    state.vm.F = "f1";
    state.vm.R = "r1";
    state.vm.Omega = "omega";

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 2,
      arity_opt: 0,
      distinct_required: true,
      distinct_optional: false,
      reflexive_ok: true
    };

    const { ops } = selectOperands(state, meta);
    expect(new Set(ops.args).size).toBe(ops.args.length);
  });

  it("throws when distinctness cannot be met", () => {
    const state = createInitialState();
    state.vm.K = ["k1", "k1"];
    state.vm.W = [];
    state.vm.F = "k1";
    state.vm.R = "k1";
    state.vm.Omega = "k1";

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 2,
      arity_opt: 0,
      distinct_required: true,
      distinct_optional: false,
      reflexive_ok: true
    };

    expect(() => selectOperands(state, meta)).toThrow(RuntimeError);
  });
});
