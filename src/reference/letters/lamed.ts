import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addCont, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ל",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const lamedOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops: SelectOperands) => {
    const source = ops.args[0];
    const holdId = nextId(S, "ל");
    const exteriorId = nextId(S, "ל");
    S.handles.set(holdId, createHandle(holdId, "scope"));
    S.handles.set(exteriorId, createHandle(exteriorId, "scope"));
    addCarry(S, source, holdId);
    addSupp(S, holdId, source);
    addCont(S, holdId, exteriorId);
    const cons: Construction = {
      base: source,
      envelope: defaultEnvelope(),
      meta: { source, holdId, exteriorId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { source, holdId, exteriorId } = cons.meta as {
      source: string;
      holdId: string;
      exteriorId: string;
    };
    S.vm.H.push({
      type: "lamed_step_past",
      tau: S.vm.tau,
      data: { id: exteriorId, source, hold: holdId }
    });
    return { S, h: exteriorId, r: BOT_ID };
  }
};
