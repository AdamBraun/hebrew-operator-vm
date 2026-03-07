import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addHeadOf, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { resolveSelectableFocus, selectCurrentFocus } from "../vm/select";
import { exportHeadAdjuncts } from "./headAdjunct";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ד",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const daletOp: LetterOp = {
  meta,
  select: (S: State) => {
    const source = selectDaletSource(S);
    if (source === S.vm.F) {
      return selectCurrentFocus(S);
    }
    return { S, ops: { args: [source], prefs: {} } };
  },
  bound: (S: State, ops: SelectOperands) => {
    const whole = ops.args[0] ?? selectDaletSource(S);
    const headId = nextId(S, "ד");
    S.handles.set(
      headId,
      createHandle(headId, "scope", {
        meta: { exposedBy: "ד", headOf: whole, backed_head: 1 }
      })
    );
    addHeadOf(S, headId, whole);
    addCarry(S, whole, headId);
    addSupp(S, headId, whole);
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
      sourceLetter: "ד",
      specs: exported_adjuncts
    });
    const data: { id: string; whole: string; adjuncts?: string[] } = { id: headId, whole };
    if (adjuncts.length > 0) {
      data.adjuncts = adjuncts;
    }
    S.vm.H.push({
      type: "head_backed",
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

function selectDaletSource(state: State): string {
  if (isWordEntryBaseline(state)) {
    return state.vm.wordEntryFocus ?? resolveSelectableFocus(state);
  }
  return resolveSelectableFocus(state);
}
