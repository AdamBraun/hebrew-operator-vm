import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ט",
  arity_req: 2,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const tetOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [target, patch] = ops.args;
    const portId = nextId(S, "ט");
    S.handles.set(
      portId,
      createHandle(portId, "gate", {
        meta: { target, patch, proxy: 1, hidden: 1 }
      })
    );
    const cons: Construction = {
      base: target,
      envelope: defaultEnvelope(),
      meta: { target, patch, portId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { target, patch, portId } = cons.meta as {
      target: string;
      patch: string;
      portId: string;
    };
    S.vm.H.push({
      type: "covert",
      tau: S.vm.tau,
      data: { id: portId, target, patch }
    });
    return { S, h: portId, r: BOT_ID };
  }
};
