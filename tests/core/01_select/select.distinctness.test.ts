import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { selectOperands } from "@ref/vm/select";
import { LetterMeta } from "@ref/letters/types";
import { RuntimeError } from "@ref/vm/errors";

describe("select distinctness", () => {
  it("distinct_required enforces unique ids when possible", () => {
    const state = createInitialState();
    state.vm = {
      ...state.vm,
      K: ["k1", "k2"],
      W: ["k2"],
      F: "f1",
      R: "r1",
      D: "omega"
    };

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
    expect(ops.args).toEqual(["k2", "k1"]);
  });

  it("allows duplicates across buckets", () => {
    const state = createInitialState();
    state.vm = {
      ...state.vm,
      K: ["k1"],
      W: ["k1"],
      F: "f1",
      R: "r1",
      D: "omega"
    };

    const meta: LetterMeta = {
      letter: "X",
      arity_req: 2,
      arity_opt: 0,
      distinct_required: true,
      distinct_optional: false,
      reflexive_ok: true
    };

    const { ops } = selectOperands(state, meta);
    expect(ops.args).toEqual(["k1", "k1"]);
  });

  it("throws when distinctness cannot be met within a bucket", () => {
    const state = createInitialState();
    state.vm = {
      ...state.vm,
      K: ["k1", "k1"],
      W: [],
      F: "k1",
      R: "k1",
      D: "k1"
    };

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
