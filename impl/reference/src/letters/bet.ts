import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ב",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
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

export const betOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const shouldReframeDomain = isWordEntryBaseline(S);
    const outside = S.vm.F;
    let anchor = ops.args[0];

    if (shouldReframeDomain) {
      const seedId = nextId(S, "ב");
      S.handles.set(seedId, createHandle(seedId, "entity"));
      anchor = seedId;
    }

    const boundaryId = nextId(S, "ב");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: {
          inside: anchor,
          outside,
          openedBy: "ב",
          domainCarrier: shouldReframeDomain ? 1 : 0
        }
      })
    );
    addBoundary(S, boundaryId, anchor, outside, 1);
    const cons: Construction = {
      base: anchor,
      envelope: defaultEnvelope(),
      meta: { boundaryId, anchor, outside }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { boundaryId } = cons.meta as { boundaryId: string };
    S.vm.E.push({ F: S.vm.F, lambda: "class", D_frame: S.vm.D });
    return { S, h: boundaryId, r: BOT_ID };
  }
};
