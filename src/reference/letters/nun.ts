import { BOT_ID, createHandle } from "../state/handles";
import { addCarry } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "נ",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const nunOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const parent = ops.args[0];
    const child = nextId(S, "נ");
    S.handles.set(child, createHandle(child, "scope", { meta: { succOf: parent } }));
    addCarry(S, parent, child);
    const cons: Construction = {
      base: parent,
      envelope: defaultEnvelope(),
      meta: { parent, child }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { child } = cons.meta as { child: string };
    return { S, h: child, r: BOT_ID };
  }
};
