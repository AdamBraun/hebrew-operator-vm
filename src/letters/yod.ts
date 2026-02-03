import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

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
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const focus = ops.args[0];
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope(),
      meta: { focus }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const focus = cons.meta.focus as string;
    const seedId = nextId(S, "י");
    S.handles.set(
      seedId,
      createHandle(seedId, "entity", { meta: { seedOf: focus } })
    );
    return { S, h: seedId, r: BOT_ID };
  }
};
