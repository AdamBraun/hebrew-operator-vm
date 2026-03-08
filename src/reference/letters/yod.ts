import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { selectCurrentFocus } from "../vm/select";
import { spawnContinuationNode } from "./continuation_primitives";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "י",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const yodOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const anchor = ops.args[0];
    const { nodeId: pinId } = spawnContinuationNode(S, {
      sourceId: anchor,
      idPrefix: "י",
      meta: { pinOf: anchor, selectable_pin: 1 }
    });
    const cons: Construction = {
      base: anchor,
      envelope: defaultEnvelope(),
      meta: { anchor, pinId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { anchor, pinId } = cons.meta as { anchor: string; pinId: string };
    S.vm.H.push({
      type: "pin",
      tau: S.vm.tau,
      data: {
        letter: "י",
        anchor,
        pin: pinId,
        exported: pinId,
        focus_before: anchor,
        focus_after: anchor,
        focus_unchanged: true,
        note: "focus remains unchanged",
        edges: [{ kind: "cont", from: anchor, to: pinId }]
      }
    });
    return { S, h: pinId, r: BOT_ID, export_handle: pinId, advance_focus: false };
  }
};
