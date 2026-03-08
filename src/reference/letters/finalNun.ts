import { BOT_ID } from "../state/handles";
import { committedEnvelope } from "../state/policies";
import { State } from "../state/state";
import { selectCurrentFocus } from "../vm/select";
import { spawnResolvedCarryNode } from "./continuation_primitives";
import { Construction, LetterMeta, LetterOp, SelectOperands } from "./types";

const meta: LetterMeta = {
  letter: "ן",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const finalNunOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const { nodeId: child } = spawnResolvedCarryNode(S, {
      sourceId: parent,
      idPrefix: "ן",
      meta: { succOf: parent },
      setPolicyLikeZayin: true
    });
    const cons: Construction = {
      base: parent,
      envelope: committedEnvelope(),
      meta: { parent, child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { child } = cons.meta as { child: string };
    return { S, h: child, r: BOT_ID };
  }
};
