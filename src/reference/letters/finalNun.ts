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
    const focus = ops.args[0];
    const { nodeId } = spawnResolvedCarryNode(S, {
      sourceId: focus,
      idPrefix: "ן",
      setPolicyLikeZayin: true
    });
    const cons: Construction = {
      base: focus,
      envelope: committedEnvelope(),
      meta: { nodeId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { nodeId } = cons.meta as { nodeId: string };
    return { S, h: nodeId, r: BOT_ID };
  }
};
