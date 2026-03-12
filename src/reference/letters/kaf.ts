import { BOT_ID, createHandle } from "../state/handles";
import { addCont, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "כ",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const kafOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const source = ops.args[0];
    const holdId = nextId(S, "כ");
    S.handles.set(
      holdId,
      createHandle(holdId, "scope", {
        meta: { heldFrom: source }
      })
    );
    addCont(S, source, holdId);
    addSupp(S, holdId, source);
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { source, holdId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { holdId } = cons.meta as { holdId: string };
    return { S, h: holdId, r: BOT_ID };
  }
};
