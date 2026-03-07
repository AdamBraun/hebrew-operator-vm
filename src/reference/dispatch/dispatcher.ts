import { LetterMode } from "../compile/types";
import { letterRegistry } from "../letters/registry";
import { Construction, LetterOp, SelectOperands } from "../letters/types";
import { applyEventLinks } from "../state/eventLinks";
import { hardenHandle } from "../state/policies";
import { State } from "../state/state";
import { assertOperatorDomainStable } from "../vm/domainTransition";
import { applySpace } from "../vm/space";
import {
  CompiledTokenBundle,
  CompiledTokenRuntime,
  CompiledTokensFile,
  DispatchApplyResult,
  DispatchContext,
  TokenDispatchTable
} from "./types";

type ExecuteContext = {
  isWordFinal: boolean;
};

function isVavMode(mode: LetterMode | null | undefined): mode is "plain" | "seeded" | "transport" {
  return mode === "plain" || mode === "seeded" || mode === "transport";
}

function resolveLetterMode(
  runtime: CompiledTokenRuntime,
  _isWordFinal: boolean
): LetterMode | undefined {
  if (runtime.letter_mode_forced) {
    return runtime.letter_mode_forced;
  }
  if (runtime.token_letter === "ו") {
    return "plain";
  }
  return undefined;
}

function applyRosh(runtime: CompiledTokenRuntime, ops: SelectOperands): SelectOperands {
  if (runtime.rosh_branch === "right") {
    return {
      ...ops,
      prefs: { ...ops.prefs, shin_direction: "external" }
    };
  }
  if (runtime.rosh_branch === "left") {
    return {
      ...ops,
      prefs: { ...ops.prefs, shin_direction: "internal" }
    };
  }
  return ops;
}

function applyToch(
  runtime: CompiledTokenRuntime,
  cons: Construction,
  letterMode?: LetterMode
): Construction {
  const meta = { ...cons.meta };
  if (runtime.token_letter === "ו" && isVavMode(letterMode)) {
    meta.vav_mode = letterMode;
  }
  if (runtime.has_shuruk) {
    meta.carrier_mode = "seeded";
    meta.rep_flag = 1;
  }
  return { ...cons, meta };
}

function applySof(state: State, runtime: CompiledTokenRuntime, handleId: string): string {
  const handle = state.handles.get(handleId);
  if (!handle) {
    return handleId;
  }
  if (runtime.sof_modifiers.length === 0) {
    return handleId;
  }

  const meta = { ...(handle.meta ?? {}) };
  const sofModifiers = Array.isArray(meta.sof_modifiers) ? [...meta.sof_modifiers] : [];

  for (const modifier of runtime.sof_modifiers) {
    const parsedCodepoint = Number.parseInt(modifier.mark.replace(/^U\+/u, ""), 16);
    const markChar =
      Number.isFinite(parsedCodepoint) && parsedCodepoint > 0
        ? String.fromCodePoint(parsedCodepoint)
        : modifier.mark;
    sofModifiers.push({
      kind: modifier.kind,
      mark: markChar,
      composite: undefined
    });

    switch (modifier.kind) {
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

    if (modifier.hataf) {
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
  bundle: CompiledTokenBundle,
  op: LetterOp,
  context: ExecuteContext
): void {
  const D_before = state.vm.D;
  const F_before = state.vm.F;
  const selectResult = op.select(state);
  const ops = applyRosh(bundle.runtime, selectResult.ops);
  const letterMode = resolveLetterMode(bundle.runtime, context.isWordFinal);

  const boundResult = op.bound(selectResult.S, ops);
  const cons = applyToch(bundle.runtime, boundResult.cons, letterMode);

  const sealResult = op.seal(boundResult.S, cons);
  const sealed = applySof(sealResult.S, bundle.runtime, sealResult.h);

  if (bundle.runtime.should_harden) {
    hardenHandle(sealResult.S, sealed);
    const handle = sealResult.S.handles.get(sealed);
    if (handle) {
      handle.meta = { ...handle.meta, hard: 1 };
    }
  }

  if (bundle.runtime.has_shuruk && cons.meta?.carrier_mode === "seeded") {
    const handle = sealResult.S.handles.get(sealed);
    if (handle) {
      handle.meta = { ...handle.meta, carrier_mode: "seeded", rep_flag: 1 };
    }
  }

  const sealedHandle = sealResult.S.handles.get(sealed);
  if (sealedHandle?.kind === "artifact") {
    sealResult.S.vm.wordLastSealedArtifact = sealed;
  }

  const exportHandle = sealResult.export_handle ?? sealed;
  sealResult.S.vm.K.push(exportHandle);
  sealResult.S.vm.F = sealResult.advance_focus === false ? F_before : sealed;
  sealResult.S.vm.R = sealResult.r;
  assertOperatorDomainStable(sealResult.S, {
    before: D_before,
    operator: op.meta.letter
  });
}

function applyShape(runtime: CompiledTokenRuntime, state: State): void {
  if (runtime.shape_effect_scope !== "routing") {
    return;
  }
  if (runtime.shape_letter === "ש") {
    state.vm.route_mode = "fork";
    state.vm.route_arity = 3;
  }
}

function executeBundle(
  state: State,
  bundle: CompiledTokenBundle,
  context: ExecuteContext
): { read_op: string; shape_op: string | null } {
  if (!state.vm.wordHasContent) {
    state.vm.wordEntryFocus = state.vm.F;
  }
  state.vm.wordHasContent = true;

  const readOp = letterRegistry[bundle.runtime.read_letter];
  if (!readOp) {
    throw new Error(
      `Missing read op '${bundle.runtime.read_letter}' for token ${bundle.token_id} (${bundle.signature})`
    );
  }

  executeReadRail(state, bundle, readOp, context);
  applyShape(bundle.runtime, state);

  return {
    read_op: readOp.meta.letter,
    shape_op: bundle.runtime.shape_letter
  };
}

export function buildDispatchTable(compiled: CompiledTokensFile): TokenDispatchTable {
  const ids = Object.keys(compiled.tokens).map((entry) => Number(entry));
  const maxId = ids.length === 0 ? 0 : Math.max(...ids);
  const table: TokenDispatchTable = new Array(maxId + 1).fill(undefined);

  for (const key of Object.keys(compiled.tokens)) {
    const numericId = Number(key);
    table[numericId] = compiled.tokens[key];
  }

  return table;
}

export function applyTokenId(
  table: TokenDispatchTable,
  tokenId: number,
  state: State,
  context: DispatchContext = {}
): DispatchApplyResult {
  const bundle = table[tokenId];
  if (!bundle) {
    throw new Error(`Unknown token id '${tokenId}'`);
  }

  const eventStart = state.vm.H.length;

  if (bundle.runtime.token_letter === "□") {
    applySpace(state);
  } else {
    executeBundle(state, bundle, {
      isWordFinal: context.isWordFinal ?? false
    });
  }

  const events = state.vm.H.slice(eventStart);
  applyEventLinks(state, events);
  return [state, events];
}

export function createTokenDispatcher(compiled: CompiledTokensFile): {
  table: TokenDispatchTable;
  apply: (tokenId: number, state: State, context?: DispatchContext) => DispatchApplyResult;
} {
  const table = buildDispatchTable(compiled);
  return {
    table,
    apply: (tokenId: number, state: State, context?: DispatchContext): DispatchApplyResult =>
      applyTokenId(table, tokenId, state, context)
  };
}
