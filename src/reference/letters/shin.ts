import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { attachThree, AttachThreeDirection } from "../vm/constructs/attach-three";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ש",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const shinOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const focus = ops.args[0] ?? S.vm.F;
    const direction: AttachThreeDirection =
      ops.prefs?.shin_direction === "internal" ? "internal" : "external";
    attachThree(focus, direction, S);
    const cons: Construction = { base: focus, envelope: defaultEnvelope(), meta: {} };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => ({ S, h: cons.base, r: BOT_ID })
};
