import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ע",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const ayinOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const target = ops.args[0];
    const watchId = nextId(S, "ע");
    S.handles.set(watchId, createHandle(watchId, "watch", { meta: { target } }));
    const cons: Construction = {
      base: target,
      envelope: defaultEnvelope(),
      meta: { watchId, target }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { watchId } = cons.meta as { watchId: string };
    if (!S.vm.W.includes(watchId)) {
      S.vm.W.push(watchId);
    }
    return { S, h: watchId, r: BOT_ID };
  }
};
