import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { selectCurrentFocus } from "../vm/select";
import { spawnContinuationNode } from "./continuation_primitives";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ו",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const vavOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const { nodeId: child } = spawnContinuationNode(S, {
      sourceId: parent,
      idPrefix: "ו"
    });
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope(),
      meta: { child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { child } = cons.meta as { child: string };
    return { S, h: child, r: BOT_ID };
  }
};
