import { describe, expect, it } from "vitest";
import { BOT_ID } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { selectOperands } from "@ref/vm/select";
import { LetterMeta } from "@ref/letters/types";

describe("select underflow", () => {
  it("reflexive_ok duplicates last operand when required missing", () => {
    const state = createInitialState();
    state.vm.K = [];
    state.vm.W = [];
    state.vm.F = "f1";
    state.vm.R = "r1";
    state.vm.Omega = "omega";

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 4,
      arity_opt: 0,
      distinct_required: false,
      distinct_optional: false,
      reflexive_ok: true
    };

    const { ops } = selectOperands(state, meta);
    expect(ops.args).toEqual(["f1", "r1", "omega", "omega"]);
  });

  it("fills ⊥ when missing and reflexive is false", () => {
    const state = createInitialState();
    state.vm.K = [];
    state.vm.W = [];
    state.vm.F = "f1";
    state.vm.R = "r1";
    state.vm.Omega = "omega";

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 4,
      arity_opt: 0,
      distinct_required: false,
      distinct_optional: false,
      reflexive_ok: false
    };

    const { ops } = selectOperands(state, meta);
    expect(ops.args).toEqual(["f1", "r1", "omega", BOT_ID]);
  });
});
