import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "מ",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const memOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const zone = nextId(S, "מ");
    S.handles.set(zone, createHandle(zone, "memZone", { meta: { anchor: parent } }));
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope(),
      meta: { parent, zone }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { parent, zone } = cons.meta as { parent: string; zone: string };
    S.vm.OStack_word.push({
      kind: "MEM_ZONE",
      parent,
      child: zone,
      payload: { anchor: parent },
      tau_created: S.vm.tau
    });
    return { S, h: parent, r: BOT_ID };
  }
};
