import { BOT_ID } from "../state/handles";
import { setPolicy } from "../state/policies";
import { State } from "../state/state";
import { RuntimeError } from "../vm/errors";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ף",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const finalPeOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const utteranceId = ops.args[0];
    const handle = S.handles.get(utteranceId);
    if (!handle || handle.kind !== "rule" || !handle.meta?.open_utterance) {
      throw new RuntimeError("Final pe requires an open utterance handle");
    }
    setPolicy(S, utteranceId, "final");
    handle.meta = { ...handle.meta, open_utterance: 0, closed: 1 };
    const cons: Construction = {
      base: utteranceId,
      envelope: defaultEnvelope("final"),
      meta: { utteranceId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { utteranceId } = cons.meta as { utteranceId: string };
    S.vm.H.push({
      type: "utter_close",
      tau: S.vm.tau,
      data: { id: utteranceId }
    });
    return { S, h: utteranceId, r: BOT_ID };
  }
};
