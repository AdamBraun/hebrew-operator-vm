import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { selectCurrentFocus } from "../vm/select";
import { committedEnvelope } from "../state/policies";
import { spawnResolvedCarryNode } from "./continuation_primitives";
import { Construction, LetterMeta, LetterOp } from "./types";

const meta: LetterMeta = {
  letter: "ז",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const zayinOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const focus = ops.args[0];
    const { nodeId: portId } = spawnResolvedCarryNode(S, {
      sourceId: focus,
      idPrefix: "ז",
      meta: { portOf: focus, handle_label: "resolved_port" },
      setPolicyLikeZayin: true
    });
    S.vm.K.push(portId);
    const cons: Construction = {
      base: focus,
      envelope: committedEnvelope(),
      meta: { portId, focus }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { portId } = cons.meta as { portId: string };
    return { S, h: portId, r: BOT_ID, export_handle: portId, advance_focus: false };
  }
};
