import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

export function makeNoopLetter(letter: string): LetterOp {
  const meta: LetterMeta = {
    letter,
    arity_req: 1,
    arity_opt: 0,
    distinct_required: false,
    distinct_optional: false,
    reflexive_ok: true
  };

  return {
    meta,
    select: (S: State) => selectOperands(S, meta),
    bound: (S: State, ops) => {
      const base = ops.args[0] ?? S.vm.F;
      const cons: Construction = {
        base,
        envelope: defaultEnvelope(),
        meta: {}
      };
      return { S, cons };
    },
    seal: (S: State, cons) => {
      return { S, h: cons.base, r: BOT_ID };
    }
  };
}
