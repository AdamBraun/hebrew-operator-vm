import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ה",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const heOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const cons: Construction = {
      base: ops.args[0],
      envelope: defaultEnvelope(),
      meta: { focus: ops.args[0] }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const focus = cons.meta.focus as string;
    const ruleId = nextId(S, "ה");
    S.handles.set(
      ruleId,
      createHandle(ruleId, "rule", {
        meta: { source: focus, public: 1, tau: S.vm.tau }
      })
    );
    S.rules.push({ id: ruleId, target: focus, patch: { public: true }, priority: 0 });
    S.vm.H.push({
      type: "declare",
      tau: S.vm.tau,
      data: { id: ruleId, target: focus }
    });
    return { S, h: ruleId, r: BOT_ID };
  }
};
