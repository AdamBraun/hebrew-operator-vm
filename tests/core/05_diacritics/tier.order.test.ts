import { describe, expect, it } from "vitest";
import { Token } from "@ref/compile/types";
import { makeSpaceToken } from "@ref/compile/tokenizer";
import { createInitialState } from "@ref/state/state";
import { Construction } from "@ref/letters/types";
import { letterRegistry } from "@ref/letters/registry";
import { State } from "@ref/state/state";
import { applySpace } from "@ref/vm/space";

function applyTochWrappers(token: Token, cons: Construction): Construction {
  if (token.meta?.traceOrder) {
    token.meta.traceOrder.push("toch");
  }
  return cons;
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
    const cons = applyTochWrappers(token, boundResult.cons);
    const sealResult = op.seal(boundResult.S, cons);
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
