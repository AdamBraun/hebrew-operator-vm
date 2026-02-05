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

export const betOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const anchor = ops.args[0];
    const boundaryId = nextId(S, "ב");
    const outside = S.vm.F;
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: { inside: anchor, outside, openedBy: "ב" }
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
    S.vm.E.push({ F: S.vm.F, lambda: "class", Omega_frame: S.vm.Omega });
    S.vm.Omega = boundaryId;
    return { S, h: boundaryId, r: BOT_ID };
  }
};
