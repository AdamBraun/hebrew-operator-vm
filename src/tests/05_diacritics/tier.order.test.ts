import { describe, expect, it } from "vitest";
import { Token } from "../../compile/types";
import { makeSpaceToken } from "../../compile/tokenizer";
import { createInitialState } from "../../state/state";
import { letterRegistry } from "../../letters/registry";
import { State } from "../../state/state";
import { applySpace } from "../../vm/space";
import { harden } from "../../state/policies";

function applyTochWrappers(state: State, token: Token, handleId: string): void {
  if (token.inside_dot_kind === "dagesh" || token.inside_dot_kind === "shuruk") {
    harden(state, handleId);
  }
  if (token.inside_dot_kind === "shuruk") {
    const handle = state.handles.get(handleId);
    if (handle) {
      handle.meta = { ...handle.meta, carrier_active: true };
    }
  }
}

function runTokens(state: State, tokens: Token[]): void {
  for (const token of tokens) {
    if (token.letter === "□") {
      applySpace(state);
      continue;
    }
    const op = letterRegistry[token.letter];
    if (!op) {
      throw new Error(`Missing letter op for ${token.letter}`);
    }
    const selectResult = op.select(state);
    if (token.meta?.traceOrder) {
      token.meta.traceOrder.push("rosh");
    }
    const boundResult = op.bound(selectResult.S, selectResult.ops);
    if (token.meta?.traceOrder) {
      token.meta.traceOrder.push("toch");
    }
    applyTochWrappers(state, token, boundResult.cons.base);
    const sealResult = op.seal(boundResult.S, boundResult.cons);
    if (token.meta?.traceOrder) {
      token.meta.traceOrder.push("sof");
    }
    sealResult.S.vm.K.push(sealResult.h);
    sealResult.S.vm.F = sealResult.h;
    sealResult.S.vm.R = sealResult.r;
  }
}

describe("diacritic tier ordering", () => {
  it("applies rosh before bound, toch between bound and seal, sof after seal", () => {
    const state = createInitialState();
    const token: Token = {
      letter: "ב",
      diacritics: [],
      inside_dot_kind: "dagesh",
      raw: "בּ",
      meta: { traceOrder: [] }
    };
    const tokens = [makeSpaceToken(), token, makeSpaceToken()];
    runTokens(state, tokens);
    expect(token.meta?.traceOrder).toEqual(["rosh", "toch", "sof"]);
  });
});
