import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addSupp } from "../state/relations";
import { setPolicy } from "../state/policies";
import { State } from "../state/state";
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
    addCarry(S, parent, child);
    addSupp(S, child, parent);
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope("framed_lock"),
      meta: { parent, child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { child } = cons.meta as { child: string };
    setPolicy(S, child, "framed_lock");
    return { S, h: child, r: BOT_ID };
  }
};
