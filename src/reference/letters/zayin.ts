import { BOT_ID, createHandle } from "../state/handles";
import { addCarry, addSupp } from "../state/relations";
import { setPolicy } from "../state/policies";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ז",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const zayinOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const focus = ops.args[0];
    const portId = nextId(S, "ז");
    S.handles.set(portId, createHandle(portId, "scope", { meta: { portOf: focus } }));
    addCarry(S, focus, portId);
    addSupp(S, portId, focus);
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope("framed_lock"),
      meta: { portId, focus }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { portId } = cons.meta as { portId: string };
    setPolicy(S, portId, "framed_lock");
    return { S, h: portId, r: BOT_ID, export_handle: portId, advance_focus: false };
  }
};
