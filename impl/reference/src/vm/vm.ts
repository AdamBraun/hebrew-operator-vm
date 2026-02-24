import { tokenize, makeSpaceToken } from "../compile/tokenizer";
import { validateTokens } from "../compile/validate";
import { HehMode, LetterMode, SpaceBoundaryMode, Token } from "../compile/types";
import { compositeRegistry, letterRegistry } from "../letters/registry";
import { Construction, LetterOp, SelectOperands } from "../letters/types";
import { FinalizeVerseOptions, VerseSnapshot, finalizeVerse } from "../runtime/finalizeVerse";
import { BOT_ID, createHandle } from "../state/handles";
import { hardenHandle } from "../state/policies";
import { applyEventLinks } from "../state/eventLinks";
import { State, createInitialState, serializeState } from "../state/state";
import { assertOperatorDomainStable } from "./domainTransition";
import { nextId } from "./ids";
import { applySpace } from "./space";

export type TraceEntry = {
  index: number;
  token: string;
  read_op: string | null;
  shape_op: string | null;
  tauBefore: number;
  tauAfter: number;
  D: string;
  F: string;
  R: string;
  route_mode?: "fork";
  route_arity?: number;
  KLength: number;
  OStackLength: number;
  boundary_mode?: SpaceBoundaryMode;
  rank?: number | null;
  continuation?: boolean;
  pending_join_created?: string;
  pending_join_consumed?: string;
  barrier?: number | null;
  events: Array<{ type: string; tau: number; data: any }>;
};

export type TracePhaseName =
  | "token_enter"
  | "word_entry_context"
  | "select"
  | "rosh"
  | "bound"
  | "toch"
  | "seal"
  | "sof"
  | "dot_harden"
  | "shuruk_seed"
  | "register_commit"
  | "shape_effect"
  | "space_apply"
  | "token_exit";

export type DeepTracePhase = {
  phase: TracePhaseName;
  tau: number;
  detail?: Record<string, any>;
  snapshot?: Record<string, any>;
};

export type DeepTraceEntry = TraceEntry & {
  token_raw: string;
  dot_kind: Token["dot_kind"];
  inside_dot_kind: Token["inside_dot_kind"];
  is_final: boolean;
  word_index?: number;
  diacritics: Array<{
    mark: string;
    kind: string;
    tier: string;
    composite?: {
      kind: "hataf_segol" | "hataf_patach" | "hataf_kamatz";
      role: "carrier_shva" | "reduced_vowel";
    };
  }>;
  boundary: Record<string, any> | null;
  trope: Record<string, any> | null;
  phases: DeepTracePhase[];
};

export type PreparedTraceToken = {
  index: number;
  token: string;
  raw: string;
  dot_kind: Token["dot_kind"];
  inside_dot_kind: Token["inside_dot_kind"];
  is_final: boolean;
  word_index?: number;
  diacritics: Array<{
    mark: string;
    kind: string;
    tier: string;
    composite?: {
      kind: "hataf_segol" | "hataf_patach" | "hataf_kamatz";
      role: "carrier_shva" | "reduced_vowel";
    };
  }>;
  boundary: Record<string, any> | null;
  trope: Record<string, any> | null;
};

export type DeepTraceOptions = {
  includeStateSnapshots?: boolean;
  finalizeAtVerseEnd?: boolean;
  finalizeVerseOptions?: FinalizeVerseOptions;
  onVerseSnapshot?: (snapshot: VerseSnapshot, context: VerseSnapshotContext) => void;
};

export type ProgramRunOptions = {
  finalizeAtVerseEnd?: boolean;
  finalizeVerseOptions?: FinalizeVerseOptions;
  onVerseSnapshot?: (snapshot: VerseSnapshot, context: VerseSnapshotContext) => void;
};

export type VerseSnapshotContext = {
  token_index: number;
  boundary_mode: SpaceBoundaryMode;
  rank: number;
};

type PhaseRecorder = {
  record: (phase: TracePhaseName, detail?: Record<string, any>) => void;
};

type TraceRunOptions = {
  collectDeep: boolean;
  includeSnapshots: boolean;
  finalizeAtVerseEnd: boolean;
  finalizeVerseOptions?: FinalizeVerseOptions;
  onVerseSnapshot?: (snapshot: VerseSnapshot, context: VerseSnapshotContext) => void;
};

type TraceRunResult = {
  state: State;
  trace: TraceEntry[];
  deepTrace: DeepTraceEntry[];
  preparedTokens: PreparedTraceToken[];
  verseSnapshots: VerseSnapshot[];
};

type LetterExecutionContext = {
  isWordFinal: boolean;
  wordText: string;
};

function shouldFinalizeAtBoundary(
  boundaryMode: SpaceBoundaryMode | undefined,
  boundaryRank: number | null | undefined
): boolean {
  return boundaryMode === "cut" && Number(boundaryRank ?? 1) >= 3;
}

function finalizeAtSofPasuqBoundary(
  state: State,
  options: {
    tokenIndex: number;
    boundaryMode: SpaceBoundaryMode;
    boundaryRank: number | null | undefined;
    finalizeVerseOptions?: FinalizeVerseOptions;
    onVerseSnapshot?: (snapshot: VerseSnapshot, context: VerseSnapshotContext) => void;
  }
): VerseSnapshot {
  const rank = Math.max(1, Math.trunc(Number(options.boundaryRank ?? 1)));
  const context: VerseSnapshotContext = {
    token_index: options.tokenIndex,
    boundary_mode: options.boundaryMode,
    rank
  };
  const snapshot = finalizeVerse(state, options.finalizeVerseOptions ?? {});
  options.onVerseSnapshot?.(snapshot, context);
  return snapshot;
}

function normalizeForJson(value: unknown): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForJson(entry));
  }
  if (value instanceof Set) {
    return Array.from(value).map((entry) => normalizeForJson(entry));
  }
  if (value instanceof Map) {
    const out: Record<string, any> = {};
    for (const [key, entry] of value.entries()) {
      out[String(key)] = normalizeForJson(entry);
    }
    return out;
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "function" || entry === undefined) {
        continue;
      }
      out[key] = normalizeForJson(entry);
    }
    return out;
  }
  return String(value);
}

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

function applyTochWrappers(
  token: Token,
  cons: Construction,
  letterMode?: LetterMode
): Construction {
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
    sofModifiers.push({
      kind: diacritic.kind,
      mark: diacritic.mark,
      composite: diacritic.composite
    });
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
  context: { isWordFinal: boolean },
  recorder?: PhaseRecorder
): void {
  const D_before = state.vm.D;
  const selectResult = op.select(state);
  recorder?.record("select", {
    read_op: op.meta.letter,
    select_operands: normalizeForJson(selectResult.ops)
  });
  const ops = applyRoshWrappers(token, selectResult.ops);
  const roshDiacritics = token.diacritics.filter((diacritic) => diacritic.tier === "rosh");
  recorder?.record("rosh", {
    wrapped_operands: normalizeForJson(ops),
    inside_dot_kind: token.inside_dot_kind,
    shin_branch: ops.prefs?.shin_branch ?? null,
    rosh_diacritics: normalizeForJson(roshDiacritics)
  });
  const letterMode = resolveLetterMode(token, context.isWordFinal);

  const boundResult = op.bound(selectResult.S, ops);
  recorder?.record("bound", {
    construction: normalizeForJson(boundResult.cons)
  });
  const hasShuruk = token.dot_kind === "shuruk";
  const shouldHarden = token.dot_kind === "dagesh";
  const cons = applyTochWrappers(token, boundResult.cons, letterMode);
  const tochDiacritics = token.diacritics.filter((diacritic) => diacritic.tier === "toch");
  recorder?.record("toch", {
    wrapped_construction: normalizeForJson(cons),
    letter_mode: letterMode ?? null,
    dot_kind: token.dot_kind,
    inside_dot_kind: token.inside_dot_kind,
    toch_diacritics: normalizeForJson(tochDiacritics)
  });

  const sealResult = op.seal(boundResult.S, cons);
  recorder?.record("seal", {
    sealed_handle: sealResult.h,
    residue: sealResult.r
  });
  const sofDiacritics = token.diacritics.filter((diacritic) => diacritic.tier === "sof");
  const sealed = applySofWrappers(sealResult.S, token, sealResult.h);
  recorder?.record("sof", {
    sealed_handle: sealed,
    sof_diacritics: normalizeForJson(sofDiacritics)
  });

  if (shouldHarden) {
    hardenHandle(sealResult.S, sealed);
    recorder?.record("dot_harden", {
      sealed_handle: sealed,
      reason: "dagesh"
    });
  }
  if (hasShuruk && cons.meta?.carrier_mode === "seeded") {
    const handle = sealResult.S.handles.get(sealed);
    if (handle) {
      handle.meta = { ...handle.meta, carrier_mode: "seeded", rep_flag: 1 };
    }
    recorder?.record("shuruk_seed", {
      sealed_handle: sealed,
      carrier_mode: "seeded"
    });
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
  recorder?.record("register_commit", {
    F: sealResult.S.vm.F,
    R: sealResult.S.vm.R,
    KLength: sealResult.S.vm.K.length,
    OStackLength: sealResult.S.vm.OStack_word.length
  });
  assertOperatorDomainStable(sealResult.S, {
    before: D_before,
    operator: op.meta.letter
  });
}

function applyShapeModifier(state: State, shapeOp: string): void {
  if (shapeOp === "ש") {
    state.vm.route_mode = "fork";
    state.vm.route_arity = 3;
  }
}

function allocWordBaselineConstruct(state: State, wordText: string): string {
  const constructId = nextId(state, "C");
  state.handles.set(
    constructId,
    createHandle(constructId, "scope", {
      anchor: 1,
      meta: {
        owner: "word",
        construct_role: "baseline",
        payload: {},
        word_text: wordText,
        ephemeral: 1
      }
    })
  );
  return constructId;
}

function wordStart(state: State, inboundFocus: string, wordText: string): void {
  const C0 = allocWordBaselineConstruct(state, wordText);
  state.vm.activeConstruct = C0;
  state.vm.F = C0;
  state.vm.H.push({
    type: "WORD_START",
    tau: state.vm.tau,
    data: {
      inboundFocus,
      wordText,
      activeConstruct: C0,
      focus: state.vm.F
    }
  });
}

function executeLetter(
  state: State,
  token: Token,
  context: LetterExecutionContext,
  recorder?: PhaseRecorder
): { read_op: string; shape_op: string | null } {
  const barrierAtEntry = !state.vm.wordHasContent ? state.vm.LeftContextBarrier : null;
  const pendingJoinAtEntry = state.vm.PendingJoin
    ? {
        id: state.vm.PendingJoin.id,
        left: state.vm.PendingJoin.left_span_handle,
        strength: state.vm.PendingJoin.join_strength
      }
    : null;
  let pendingJoinAction: "none" | "consumed" | "blocked_by_barrier" = "none";

  if (!state.vm.wordHasContent) {
    if (barrierAtEntry !== null) {
      if (pendingJoinAtEntry) {
        pendingJoinAction = "blocked_by_barrier";
        state.vm.H.push({
          type: "join_blocked",
          tau: state.vm.tau,
          data: {
            id: pendingJoinAtEntry.id,
            left: pendingJoinAtEntry.left,
            strength: pendingJoinAtEntry.strength,
            barrier: barrierAtEntry
          }
        });
        state.vm.PendingJoin = undefined;
      }
      state.vm.F = state.vm.D;
      state.vm.R = BOT_ID;
      state.vm.K = [state.vm.F, state.vm.R];
      state.vm.LeftContextBarrier = null;
    } else if (state.vm.PendingJoin) {
      const consumed = state.vm.PendingJoin;
      state.vm.F = consumed.left_span_handle;
      state.vm.wordEntryFocus = consumed.left_span_handle;
      state.vm.lastPendingJoinConsumedId = consumed.id;
      state.vm.H.push({
        type: "join_consume",
        tau: state.vm.tau,
        data: {
          id: consumed.id,
          left: consumed.left_span_handle,
          strength: consumed.join_strength
        }
      });
      state.vm.PendingJoin = undefined;
      pendingJoinAction = "consumed";
    }
  }

  if (!state.vm.wordHasContent) {
    state.vm.wordEntryFocus = state.vm.F;
    const inboundFocus = state.vm.wordEntryFocus ?? state.vm.F;
    wordStart(state, inboundFocus, context.wordText);
  }
  state.vm.wordHasContent = true;
  recorder?.record("word_entry_context", {
    is_word_final: context.isWordFinal,
    left_context_barrier: barrierAtEntry,
    pending_join_at_entry: pendingJoinAtEntry,
    pending_join_action: pendingJoinAction,
    pending_join_consumed: state.vm.lastPendingJoinConsumedId ?? null,
    entry_focus: state.vm.wordEntryFocus ?? null,
    active_construct: state.vm.activeConstruct ?? null,
    focus: state.vm.F
  });

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
    executeReadRail(state, token, readOp, context, recorder);

    if (composite.composite_policy.shape_effect_scope === "routing") {
      applyShapeModifier(state, composite.shape);
      recorder?.record("shape_effect", {
        shape_op: composite.shape,
        scope: composite.composite_policy.shape_effect_scope,
        route_mode: state.vm.route_mode ?? null,
        route_arity: state.vm.route_arity ?? null
      });
    }
    return { read_op: readOp.meta.letter, shape_op: composite.shape };
  }

  const op = letterRegistry[token.letter];
  if (!op) {
    throw new Error(`Missing letter op for ${token.letter}`);
  }
  executeReadRail(state, token, op, context, recorder);
  return { read_op: op.meta.letter, shape_op: null };
}

function prepareTokens(input: string): Token[] {
  const tokens = tokenize(input);
  validateTokens(tokens, letterRegistry);

  const withLeading = [makeSpaceToken({ mode: "hard", source: "implicit_leading" }), ...tokens];

  if (tokens.length === 0 || tokens[tokens.length - 1].letter !== "□") {
    withLeading.push(makeSpaceToken({ mode: "hard", source: "implicit_trailing" }));
  }
  return withLeading;
}

function buildWordTextByIndex(tokens: Token[]): Map<number, string> {
  const wordTextByIndex = new Map<number, string>();
  for (const token of tokens) {
    if (token.letter === "□" || token.word_index === undefined) {
      continue;
    }
    const current = wordTextByIndex.get(token.word_index) ?? "";
    wordTextByIndex.set(token.word_index, `${current}${token.raw}`);
  }
  return wordTextByIndex;
}

function resolveWordText(token: Token, wordTextByIndex: Map<number, string>): string {
  if (token.word_index === undefined) {
    return token.raw;
  }
  return wordTextByIndex.get(token.word_index) ?? token.raw;
}

export function runProgram(
  input: string,
  state: State = createInitialState(),
  options: ProgramRunOptions = {}
): State {
  const tokens = prepareTokens(input);
  const wordTextByIndex = buildWordTextByIndex(tokens);
  for (let index = 0; index < tokens.length; index += 1) {
    const eventStart = state.vm.H.length;
    const token = tokens[index];
    if (token.letter === "□") {
      const boundaryMode = token.boundary?.mode;
      const boundaryRank = token.boundary?.rank;
      applySpace(state, {
        mode: boundaryMode,
        rank: boundaryRank,
        leftTrope: token.boundary?.left_trope ?? null
      });
      if (options.finalizeAtVerseEnd && shouldFinalizeAtBoundary(boundaryMode, boundaryRank)) {
        finalizeAtSofPasuqBoundary(state, {
          tokenIndex: index,
          boundaryMode: boundaryMode ?? "hard",
          boundaryRank,
          finalizeVerseOptions: options.finalizeVerseOptions,
          onVerseSnapshot: options.onVerseSnapshot
        });
      }
    } else {
      const isWordFinal = index === tokens.length - 1 || tokens[index + 1].letter === "□";
      const wordText = resolveWordText(token, wordTextByIndex);
      executeLetter(state, token, { isWordFinal, wordText });
    }
    const eventEnd = state.vm.H.length;
    applyEventLinks(state, state.vm.H.slice(eventStart, eventEnd));
  }
  return state;
}

function runProgramWithTraceInternal(
  input: string,
  state: State,
  options: TraceRunOptions
): TraceRunResult {
  const tokens = prepareTokens(input);
  const wordTextByIndex = buildWordTextByIndex(tokens);
  const trace: TraceEntry[] = [];
  const deepTrace: DeepTraceEntry[] = [];
  const verseSnapshots: VerseSnapshot[] = [];
  const preparedTokens: PreparedTraceToken[] = tokens.map((token, index) => ({
    index,
    token: token.letter,
    raw: token.raw,
    dot_kind: token.dot_kind,
    inside_dot_kind: token.inside_dot_kind,
    is_final: token.is_final,
    word_index: token.word_index,
    diacritics: token.diacritics.map((diacritic) => ({
      mark: diacritic.mark,
      kind: diacritic.kind,
      tier: diacritic.tier,
      composite: diacritic.composite
    })),
    boundary: token.boundary ? normalizeForJson(token.boundary) : null,
    trope: token.trope ? normalizeForJson(token.trope) : null
  }));

  tokens.forEach((token, index) => {
    const tauBefore = state.vm.tau;
    const eventStart = state.vm.H.length;
    const phases: DeepTracePhase[] = [];
    const recorder: PhaseRecorder | undefined = options.collectDeep
      ? {
          record: (phase, detail) => {
            const row: DeepTracePhase = {
              phase,
              tau: state.vm.tau
            };
            if (detail) {
              row.detail = normalizeForJson(detail);
            }
            if (options.includeSnapshots) {
              row.snapshot = normalizeForJson(serializeState(state));
            }
            phases.push(row);
          }
        }
      : undefined;
    let readOp: string | null = null;
    let shapeOp: string | null = null;
    let boundaryMode: SpaceBoundaryMode | undefined;
    let boundaryRank: number | null | undefined;
    let continuation: boolean | undefined;
    let pendingJoinCreated: string | undefined;
    const isWordFinal =
      token.letter !== "□" && (index === tokens.length - 1 || tokens[index + 1].letter === "□");
    recorder?.record("token_enter", {
      index,
      token: token.letter,
      token_raw: token.raw,
      is_word_final: token.letter === "□" ? null : isWordFinal,
      word_index: token.word_index ?? null
    });
    if (token.letter === "□") {
      boundaryMode = token.boundary?.mode ?? "hard";
      boundaryRank = token.boundary?.rank ?? null;
      continuation = boundaryMode === "glue" || boundaryMode === "glue_maqqef";
      recorder?.record("space_apply", {
        boundary_mode: boundaryMode,
        rank: boundaryRank,
        continuation
      });
      applySpace(state, {
        mode: boundaryMode,
        rank: boundaryRank,
        leftTrope: token.boundary?.left_trope ?? null
      });
      if (continuation) {
        pendingJoinCreated = state.vm.PendingJoin?.id;
      }
    } else {
      const wordText = resolveWordText(token, wordTextByIndex);
      const execution = executeLetter(state, token, { isWordFinal, wordText }, recorder);
      readOp = execution.read_op;
      shapeOp = execution.shape_op;
    }
    const eventEnd = state.vm.H.length;
    applyEventLinks(state, state.vm.H.slice(eventStart, eventEnd));
    recorder?.record("token_exit", {
      D: state.vm.D,
      F: state.vm.F,
      R: state.vm.R,
      KLength: state.vm.K.length,
      OStackLength: state.vm.OStack_word.length,
      barrier: state.vm.LeftContextBarrier,
      pending_join_created: pendingJoinCreated ?? null,
      pending_join_consumed: state.vm.lastPendingJoinConsumedId ?? null
    });
    const entry: TraceEntry = {
      index,
      token: token.letter,
      read_op: readOp,
      shape_op: shapeOp,
      tauBefore,
      tauAfter: state.vm.tau,
      D: state.vm.D,
      F: state.vm.F,
      R: state.vm.R,
      route_mode: state.vm.route_mode,
      route_arity: state.vm.route_arity,
      KLength: state.vm.K.length,
      OStackLength: state.vm.OStack_word.length,
      boundary_mode: boundaryMode,
      rank: boundaryRank,
      continuation,
      pending_join_created: pendingJoinCreated,
      pending_join_consumed: state.vm.lastPendingJoinConsumedId,
      barrier: state.vm.LeftContextBarrier,
      events: state.vm.H.slice(eventStart, eventEnd)
    };
    trace.push(entry);

    if (options.collectDeep) {
      deepTrace.push({
        ...entry,
        token_raw: token.raw,
        dot_kind: token.dot_kind,
        inside_dot_kind: token.inside_dot_kind,
        is_final: token.is_final,
        word_index: token.word_index,
        diacritics: token.diacritics.map((diacritic) => ({
          mark: diacritic.mark,
          kind: diacritic.kind,
          tier: diacritic.tier,
          composite: diacritic.composite
        })),
        boundary: token.boundary ? normalizeForJson(token.boundary) : null,
        trope: token.trope ? normalizeForJson(token.trope) : null,
        phases
      });
    }

    if (options.finalizeAtVerseEnd && shouldFinalizeAtBoundary(boundaryMode, boundaryRank)) {
      verseSnapshots.push(
        finalizeAtSofPasuqBoundary(state, {
          tokenIndex: index,
          boundaryMode: boundaryMode ?? "hard",
          boundaryRank,
          finalizeVerseOptions: options.finalizeVerseOptions,
          onVerseSnapshot: options.onVerseSnapshot
        })
      );
    }
  });

  return {
    state,
    trace,
    deepTrace,
    preparedTokens,
    verseSnapshots
  };
}

export function runProgramWithTrace(
  input: string,
  state: State = createInitialState(),
  options: ProgramRunOptions = {}
): { state: State; trace: TraceEntry[]; verseSnapshots: VerseSnapshot[] } {
  const result = runProgramWithTraceInternal(input, state, {
    collectDeep: false,
    includeSnapshots: false,
    finalizeAtVerseEnd: options.finalizeAtVerseEnd === true,
    finalizeVerseOptions: options.finalizeVerseOptions,
    onVerseSnapshot: options.onVerseSnapshot
  });
  return {
    state: result.state,
    trace: result.trace,
    verseSnapshots: result.verseSnapshots
  };
}

export function runProgramWithDeepTrace(
  input: string,
  state: State = createInitialState(),
  options: DeepTraceOptions = {}
): {
  state: State;
  trace: TraceEntry[];
  deepTrace: DeepTraceEntry[];
  preparedTokens: PreparedTraceToken[];
  verseSnapshots: VerseSnapshot[];
} {
  const result = runProgramWithTraceInternal(input, state, {
    collectDeep: true,
    includeSnapshots: options.includeStateSnapshots !== false,
    finalizeAtVerseEnd: options.finalizeAtVerseEnd === true,
    finalizeVerseOptions: options.finalizeVerseOptions,
    onVerseSnapshot: options.onVerseSnapshot
  });
  return {
    state: result.state,
    trace: result.trace,
    deepTrace: result.deepTrace,
    preparedTokens: result.preparedTokens,
    verseSnapshots: result.verseSnapshots
  };
}
