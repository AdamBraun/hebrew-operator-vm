import { tokenize, makeSpaceToken } from "../compile/tokenizer";
import { validateTokens } from "../compile/validate";
import { HehMode, LetterMode, Token } from "../compile/types";
import { compositeRegistry, letterRegistry } from "../letters/registry";
import { Construction, LetterOp, SelectOperands } from "../letters/types";
import { hardenHandle } from "../state/policies";
import { State, createInitialState } from "../state/state";
import { applySpace } from "./space";

export type TraceEntry = {
  index: number;
  token: string;
  read_op: string | null;
  shape_op: string | null;
  tauBefore: number;
  tauAfter: number;
  F: string;
  R: string;
  route_mode?: "fork";
  route_arity?: number;
  KLength: number;
  OStackLength: number;
  events: Array<{ type: string; tau: number; data: any }>;
};

function isHehMode(mode: LetterMode | undefined): mode is HehMode {
  return mode === "public" || mode === "breath" || mode === "pinned" || mode === "alias";
}

function isVavMode(mode: LetterMode | undefined): mode is "plain" | "seeded" | "transport" {
  return mode === "plain" || mode === "seeded" || mode === "transport";
}

function resolveLetterMode(token: Token, isWordFinal: boolean): LetterMode | undefined {
  if (token.letter === "ה") {
    if (isHehMode(token.letter_mode)) {
      return token.letter_mode;
    }
    if (token.dot_kind === "mappiq") {
      return "pinned";
    }
    if (isWordFinal) {
      return "breath";
    }
    return "public";
  }
  if (token.letter === "ו") {
    if (isVavMode(token.letter_mode)) {
      return token.letter_mode;
    }
    if (token.dot_kind === "shuruk") {
      return "seeded";
    }
    return "plain";
  }
  return token.letter_mode;
}

function applyRoshWrappers(token: Token, ops: SelectOperands): SelectOperands {
  if (token.meta?.traceOrder) {
    token.meta.traceOrder.push("rosh");
  }
  if (token.inside_dot_kind === "shin_dot_right") {
    return { ...ops, prefs: { ...ops.prefs, shin_branch: "right" } };
  }
  if (token.inside_dot_kind === "shin_dot_left") {
    return { ...ops, prefs: { ...ops.prefs, shin_branch: "left" } };
  }
  return ops;
}

function applyTochWrappers(token: Token, cons: Construction, letterMode?: LetterMode): Construction {
  if (token.meta?.traceOrder) {
    token.meta.traceOrder.push("toch");
  }
  const meta = { ...cons.meta };
  if (token.letter === "ה" && isHehMode(letterMode)) {
    meta.heh_mode = letterMode;
  }
  if (token.letter === "ו" && isVavMode(letterMode)) {
    meta.vav_mode = letterMode;
  }
  if (token.dot_kind === "shuruk") {
    meta.carrier_mode = "seeded";
    meta.rep_flag = 1;
  }
  return { ...cons, meta };
}

function applySofWrappers(state: State, token: Token, handleId: string): string {
  if (token.meta?.traceOrder) {
    token.meta.traceOrder.push("sof");
  }
  const handle = state.handles.get(handleId);
  if (!handle) {
    return handleId;
  }
  const sofDiacritics = token.diacritics.filter((diacritic) => diacritic.tier === "sof");
  if (sofDiacritics.length === 0) {
    return handleId;
  }
  const meta = { ...(handle.meta ?? {}) };
  const sofModifiers = Array.isArray(meta.sof_modifiers) ? [...meta.sof_modifiers] : [];
  const hatafMarks = new Set(["\u05B1", "\u05B2", "\u05B3"]);

  for (const diacritic of sofDiacritics) {
    sofModifiers.push({ kind: diacritic.kind, mark: diacritic.mark });
    switch (diacritic.kind) {
      case "patach":
        handle.edge_mode = "gated";
        meta.gated = 1;
        break;
      case "tzere":
        handle.edge_mode = "stabilized";
        meta.stabilized = 1;
        meta.support_pins = ["L", "R"];
        break;
      case "hiriq":
        handle.edge_mode = "committed";
        meta.rep_token = 1;
        break;
      case "segol":
        handle.edge_mode = "convergent";
        meta.convergent = 1;
        meta.endpoint_bias = 1;
        break;
      case "kamatz":
        handle.edge_mode = "committed";
        meta.atomic = 1;
        break;
      case "shva":
        handle.edge_mode = "collapsed";
        meta.collapsed = 1;
        break;
      case "kubutz":
        handle.edge_mode = "bundled";
        meta.bundled = 1;
        break;
      default:
        break;
    }
    if (hatafMarks.has(diacritic.mark)) {
      meta.hataf = 1;
      meta.reduced = 1;
      meta.bind_next = 1;
    }
  }

  meta.sof_modifiers = sofModifiers;
  handle.meta = meta;
  return handleId;
}

function executeReadRail(
  state: State,
  token: Token,
  op: LetterOp,
  context: { isWordFinal: boolean }
): void {
  const selectResult = op.select(state);
  const ops = applyRoshWrappers(token, selectResult.ops);
  const letterMode = resolveLetterMode(token, context.isWordFinal);

  const boundResult = op.bound(selectResult.S, ops);
  const hasShuruk = token.dot_kind === "shuruk";
  const shouldHarden = token.dot_kind === "dagesh";
  const cons = applyTochWrappers(token, boundResult.cons, letterMode);

  const sealResult = op.seal(boundResult.S, cons);
  const sealed = applySofWrappers(sealResult.S, token, sealResult.h);

  if (shouldHarden) {
    hardenHandle(sealResult.S, sealed);
  }
  if (hasShuruk && cons.meta?.carrier_mode === "seeded") {
    const handle = sealResult.S.handles.get(sealed);
    if (handle) {
      handle.meta = { ...handle.meta, carrier_mode: "seeded", rep_flag: 1 };
    }
  }
  if (token.dot_kind === "dagesh") {
    const handle = sealResult.S.handles.get(sealed);
    if (handle) {
      handle.meta = { ...handle.meta, hard: 1 };
    }
  }

  const sealedHandle = sealResult.S.handles.get(sealed);
  if (sealedHandle?.kind === "artifact") {
    sealResult.S.vm.wordLastSealedArtifact = sealed;
  }

  sealResult.S.vm.K.push(sealed);
  sealResult.S.vm.F = sealed;
  sealResult.S.vm.R = sealResult.r;
}

function applyShapeModifier(state: State, shapeOp: string): void {
  if (shapeOp === "ש") {
    state.vm.route_mode = "fork";
    state.vm.route_arity = 3;
  }
}

function executeLetter(
  state: State,
  token: Token,
  context: { isWordFinal: boolean }
): { read_op: string; shape_op: string | null } {
  state.vm.wordHasContent = true;

  const composite = compositeRegistry[token.letter];
  if (composite) {
    if (composite.composite_policy.precedence !== "read_first") {
      throw new Error(
        `Unsupported composite precedence '${composite.composite_policy.precedence}'`
      );
    }
    const readOp = letterRegistry[composite.read];
    if (!readOp) {
      throw new Error(`Missing read op '${composite.read}' for composite '${token.letter}'`);
    }
    executeReadRail(state, token, readOp, context);

    if (composite.composite_policy.shape_effect_scope === "routing") {
      applyShapeModifier(state, composite.shape);
    }
    return { read_op: readOp.meta.letter, shape_op: composite.shape };
  }

  const op = letterRegistry[token.letter];
  if (!op) {
    throw new Error(`Missing letter op for ${token.letter}`);
  }
  executeReadRail(state, token, op, context);
  return { read_op: op.meta.letter, shape_op: null };
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
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.letter === "□") {
      applySpace(state);
    } else {
      const isWordFinal = index === tokens.length - 1 || tokens[index + 1].letter === "□";
      executeLetter(state, token, { isWordFinal });
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
    let readOp: string | null = null;
    let shapeOp: string | null = null;
    if (token.letter === "□") {
      applySpace(state);
    } else {
      const isWordFinal = index === tokens.length - 1 || tokens[index + 1].letter === "□";
      const execution = executeLetter(state, token, { isWordFinal });
      readOp = execution.read_op;
      shapeOp = execution.shape_op;
    }
    const eventEnd = state.vm.H.length;
    trace.push({
      index,
      token: token.letter,
      read_op: readOp,
      shape_op: shapeOp,
      tauBefore,
      tauAfter: state.vm.tau,
      F: state.vm.F,
      R: state.vm.R,
      route_mode: state.vm.route_mode,
      route_arity: state.vm.route_arity,
      KLength: state.vm.K.length,
      OStackLength: state.vm.OStack_word.length,
      events: state.vm.H.slice(eventStart, eventEnd)
    });
  });

  return { state, trace };
}
