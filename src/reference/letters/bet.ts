import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
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
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const shouldReframeDomain = isWordEntryBaseline(S);
    const outside = S.vm.F;
    let anchor = ops.args[0];
    const domainCarrier = shouldReframeDomain ? 1 : 0;

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
          domainCarrier
        }
      })
    );
    addBoundary(S, boundaryId, anchor, outside, 1);
    const cons: Construction = {
      base: anchor,
      envelope: defaultEnvelope(),
      meta: { boundaryId, anchor, outside, domainCarrier }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { boundaryId, anchor, outside, domainCarrier } = cons.meta as {
      boundaryId: string;
      anchor: string;
      outside: string;
      domainCarrier: 0 | 1;
    };
    S.vm.H.push({
      type: "boundary_open",
      tau: S.vm.tau,
      data: {
        id: boundaryId,
        boundaryId,
        inside: anchor,
        outside,
        anchor: 1,
        domainCarrier
      }
    });
    S.vm.E.push({ F: S.vm.F, lambda: "class", D_frame: S.vm.D });
    return { S, h: boundaryId, r: BOT_ID };
  }
};
