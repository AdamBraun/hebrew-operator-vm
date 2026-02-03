import { BOT_ID, createHandle } from "../state/handles";
import { addCont } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ב",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const betOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const child = nextId(S, "ב");
    S.handles.set(
      child,
      createHandle(child, "scope", { meta: { insideOf: parent, openedBy: "ב" } })
    );
    addCont(S, parent, child);
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope(),
      meta: { parent, child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { parent, child } = cons.meta as { parent: string; child: string };
    S.vm.OStack_word.push({
      kind: "BOUNDARY",
      parent,
      child,
      payload: { anchor: 1 },
      tau_created: S.vm.tau
    });
    return { S, h: child, r: BOT_ID };
  }
};
