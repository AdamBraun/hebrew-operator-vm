import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { resolveSelectableFocus, selectCurrentFocus } from "../vm/select";
import { exposeHeadWithLeg } from "./headAdjunct";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ק",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const qofOp: LetterOp = {
  meta,
  select: (S: State) => {
    const source = selectQofSource(S);
    if (source === S.vm.F) {
      return selectCurrentFocus(S);
    }
    return { S, ops: { args: [source], prefs: {} } };
  },
  bound: (S: State, ops) => {
    const source = ops.args[0] ?? selectQofSource(S);
    const { head, leg } = exposeHeadWithLeg(S, {
      source,
      resolved: false,
      headIdPrefix: "ק",
      legIdPrefix: "ק",
      headMeta: { exposedBy: "ק", headOf: source, bare_head: 1 },
      legMeta: { exposedBy: "ק", detached_leg: 1 }
    });
    const headHandle = S.handles.get(head);
    if (headHandle) {
      headHandle.meta = { ...(headHandle.meta ?? {}), detached_leg: leg };
    }
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { source, headId: head, legId: leg }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { source, headId, legId } = cons.meta as {
      source: string;
      headId: string;
      legId: string;
    };
    S.vm.H.push({
      type: "head_with_leg",
      tau: S.vm.tau,
      data: {
        letter: "ק",
        source,
        head: headId,
        focus: headId,
        adjunct: legId,
        exported_adjuncts: [legId],
        resolved: false,
        edges: [
          { kind: "head_of", from: headId, to: source },
          { kind: "carry", from: source, to: headId },
          { kind: "cont", from: headId, to: legId },
          { kind: "carry", from: headId, to: legId }
        ]
      }
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

function selectQofSource(state: State): string {
  if (isWordEntryBaseline(state)) {
    return state.vm.wordEntryFocus ?? resolveSelectableFocus(state);
  }
  return resolveSelectableFocus(state);
}
