import { tokenize, makeSpaceToken } from "../compile/tokenizer";
import { validateTokens } from "../compile/validate";
import { Token } from "../compile/types";
import { letterRegistry } from "../letters/registry";
import { Construction, SelectOperands } from "../letters/types";
import { harden } from "../state/policies";
import { State, createInitialState } from "../state/state";
import { applySpace } from "./space";

export type TraceEntry = {
  index: number;
  token: string;
  tauBefore: number;
  tauAfter: number;
  F: string;
  R: string;
  KLength: number;
  OStackLength: number;
  events: Array<{ type: string; tau: number; data: any }>;
};

function applyRoshWrappers(_token: Token, ops: SelectOperands): SelectOperands {
  return ops;
}

function applyTochWrappers(state: State, token: Token, cons: Construction): Construction {
  if (token.inside_dot_kind === "dagesh" || token.inside_dot_kind === "shuruk") {
    harden(state, cons.base);
  }
  return cons;
}

function applySofWrappers(_token: Token, handleId: string): string {
  return handleId;
}

function executeLetter(state: State, token: Token): void {
  const op = letterRegistry[token.letter];
  if (!op) {
    throw new Error(`Missing letter op for ${token.letter}`);
  }

  const selectResult = op.select(state);
  const ops = applyRoshWrappers(token, selectResult.ops);

  const boundResult = op.bound(selectResult.S, ops);
  const cons = applyTochWrappers(boundResult.S, token, boundResult.cons);

  const sealResult = op.seal(boundResult.S, cons);
  const sealed = applySofWrappers(token, sealResult.h);

  sealResult.S.vm.K.push(sealed);
  sealResult.S.vm.F = sealed;
  sealResult.S.vm.R = sealResult.r;
}

function prepareTokens(input: string): Token[] {
  const tokens = tokenize(input);
  validateTokens(tokens, letterRegistry);

  const withLeading = [makeSpaceToken(), ...tokens];
  if (tokens.length === 0 || tokens[tokens.length - 1].letter !== "□") {
    withLeading.push(makeSpaceToken());
  }
  return withLeading;
}

export function runProgram(input: string, state: State = createInitialState()): State {
  const tokens = prepareTokens(input);
  for (const token of tokens) {
    if (token.letter === "□") {
      applySpace(state);
    } else {
      executeLetter(state, token);
    }
  }
  return state;
}

export function runProgramWithTrace(
  input: string,
  state: State = createInitialState()
): { state: State; trace: TraceEntry[] } {
  const tokens = prepareTokens(input);
  const trace: TraceEntry[] = [];

  tokens.forEach((token, index) => {
    const tauBefore = state.vm.tau;
    const eventStart = state.vm.H.length;
    if (token.letter === "□") {
      applySpace(state);
    } else {
      executeLetter(state, token);
    }
    const eventEnd = state.vm.H.length;
    trace.push({
      index,
      token: token.letter,
      tauBefore,
      tauAfter: state.vm.tau,
      F: state.vm.F,
      R: state.vm.R,
      KLength: state.vm.K.length,
      OStackLength: state.vm.OStack_word.length,
      events: state.vm.H.slice(eventStart, eventEnd)
    });
  });

  return { state, trace };
}
