import { BOT_ID } from "../state/handles";
import { contReachable } from "../state/relations";
import { setPolicy } from "../state/policies";
import { State } from "../state/state";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ס",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const samekhOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const focus = ops.args[0];
    setPolicy(S, focus, "framed_lock");
    const handle = S.handles.get(focus);
    if (handle) {
      handle.meta = { ...handle.meta, stable: 1 };
    }
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope("framed_lock"),
      meta: { focus }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const focus = cons.meta.focus as string;
    const top = S.vm.OStack_word[S.vm.OStack_word.length - 1];
    if (top && top.kind === "SUPPORT" && contReachable(S, top.child, focus)) {
      const popped = S.vm.OStack_word.pop();
      if (popped) {
        S.vm.H.push({
          type: "support",
          tau: S.vm.tau,
          data: { child: popped.child, parent: focus }
        });
      }
    }
    return { S, h: focus, r: BOT_ID };
  }
};
