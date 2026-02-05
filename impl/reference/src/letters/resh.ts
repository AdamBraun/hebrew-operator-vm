import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

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
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const inside = ops.args[0];
    const frame = S.vm.E[S.vm.E.length - 1];
    const outside =
      S.vm.R !== BOT_ID ? S.vm.R : frame?.Omega_frame ? frame.Omega_frame : S.vm.Omega;
    const boundaryId = nextId(S, "ר");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 0,
        meta: { inside, outside, closedBy: "ר" }
      })
    );
    addBoundary(S, boundaryId, inside, outside, 0);
    const cons: Construction = {
      base: inside,
      envelope: defaultEnvelope(),
      meta: { boundaryId, inside, outside }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { boundaryId, inside, outside } = cons.meta as {
      boundaryId: string;
      inside: string;
      outside: string;
    };
    S.vm.H.push({
      type: "boundary_close",
      tau: S.vm.tau,
      data: { id: boundaryId, inside, outside, anchor: 0 }
    });
    return { S, h: boundaryId, r: BOT_ID };
  }
};
