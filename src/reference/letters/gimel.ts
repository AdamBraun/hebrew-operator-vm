import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addCont } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ג",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const gimelOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const source = ops.args[0];
    const shoulderId = nextId(S, "ג");
    const successorId = nextId(S, "ג");
    S.handles.set(shoulderId, createHandle(shoulderId, "scope"));
    S.handles.set(successorId, createHandle(successorId, "scope"));
    addCont(S, source, shoulderId);
    addCarry(S, source, shoulderId);
    addCont(S, shoulderId, successorId);
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { source, shoulderId, successorId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { successorId } = cons.meta as { successorId: string };
    return { S, h: successorId, r: BOT_ID };
  }
};
