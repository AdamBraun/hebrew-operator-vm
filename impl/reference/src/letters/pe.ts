import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "פ",
  arity_req: 2,
  arity_opt: 1,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const peOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [source, payload] = ops.args;
    const target =
      ops.args[2] ?? (S.vm.R !== BOT_ID ? S.vm.R : S.vm.Omega);
    const ruleId = nextId(S, "פ");
    S.handles.set(
      ruleId,
      createHandle(ruleId, "rule", {
        meta: { source, payload, target, open_utterance: 1 }
      })
    );
    S.rules.push({
      id: ruleId,
      target,
      patch: { source, payload, utterance: true },
      priority: 0
    });
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { ruleId, source, payload, target }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { ruleId, source, payload, target } = cons.meta as {
      ruleId: string;
      source: string;
      payload: string;
      target: string;
    };
    S.vm.H.push({
      type: "utter",
      tau: S.vm.tau,
      data: { id: ruleId, source, payload, target }
    });
    return { S, h: ruleId, r: BOT_ID };
  }
};
