import { BOT_ID, createHandle } from "../state/handles";
import { addCont } from "../state/relations";
import { setPolicy } from "../state/policies";
import { State } from "../state/state";
import { RuntimeError } from "../vm/errors";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

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
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const child = nextId(S, "ן");
    S.handles.set(child, createHandle(child, "scope", { meta: { succOf: parent } }));
    addCont(S, parent, child);
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope("framed_lock"),
      meta: { parent, child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { parent, child } = cons.meta as { parent: string; child: string };
    S.vm.OStack_word.push({
      kind: "SUPPORT",
      parent,
      child,
      payload: {},
      tau_created: S.vm.tau
    });
    const popped = S.vm.OStack_word.pop();
    if (!popped || popped.kind !== "SUPPORT" || popped.child !== child) {
      throw new RuntimeError("Final nun support discharge mismatch");
    }
    setPolicy(S, child, "framed_lock");
    return { S, h: child, r: BOT_ID };
  }
};
