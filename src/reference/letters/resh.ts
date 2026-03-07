import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addHeadOf } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { resolveSelectableFocus, selectCurrentFocus } from "../vm/select";
import { exportHeadAdjuncts } from "./headAdjunct";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ר",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const reshOp: LetterOp = {
  meta,
  select: (S: State) => {
    const source = selectReshSource(S);
    if (source === S.vm.F) {
      return selectCurrentFocus(S);
    }
    return { S, ops: { args: [source], prefs: {} } };
  },
  bound: (S: State, ops: SelectOperands) => {
    const whole = ops.args[0] ?? selectReshSource(S);
    const headId = nextId(S, "ר");
    S.handles.set(
      headId,
      createHandle(headId, "scope", {
        meta: { exposedBy: "ר", headOf: whole, bare_head: 1 }
      })
    );
    addHeadOf(S, headId, whole);
    addCarry(S, whole, headId);
    const cons: Construction = {
      base: whole,
      envelope: defaultEnvelope(),
      meta: { headId, whole }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { headId, whole, exported_adjuncts } = cons.meta as {
      headId: string;
      whole: string;
      exported_adjuncts?: unknown;
    };
    const adjuncts = exportHeadAdjuncts(S, {
      headId,
      sourceLetter: "ר",
      specs: exported_adjuncts
    });
    const data: { id: string; whole: string; adjuncts?: string[] } = { id: headId, whole };
    if (adjuncts.length > 0) {
      data.adjuncts = adjuncts;
    }
    S.vm.H.push({
      type: "head_expose",
      tau: S.vm.tau,
      data
    });
    return { S, h: headId, r: BOT_ID };
  }
};

function isWordEntryBaseline(state: State): boolean {
  const entryFocus = state.vm.wordEntryFocus ?? state.vm.F;
  const focus = state.vm.F;
  const baselineFocus =
    (state.vm.activeConstruct !== undefined && focus === state.vm.activeConstruct) ||
    focus === entryFocus;
  const stackMatches =
    state.vm.K.length === 2 &&
    state.vm.K[1] === BOT_ID &&
    (state.vm.K[0] === focus || state.vm.K[0] === entryFocus);
  return baselineFocus && state.vm.R === BOT_ID && stackMatches;
}

function selectReshSource(state: State): string {
  if (isWordEntryBaseline(state)) {
    return state.vm.wordEntryFocus ?? resolveSelectableFocus(state);
  }
  return resolveSelectableFocus(state);
}
