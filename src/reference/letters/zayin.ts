import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
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
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops) => {
    const target = ops.args[0];
    const gateId = nextId(S, "ז");
    S.handles.set(
      gateId,
      createHandle(gateId, "gate", { meta: { target, armed: 1, policy: "guard" } })
    );
    const cons: Construction = {
      base: target,
      envelope: defaultEnvelope(),
      meta: { gateId, target }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { gateId, target } = cons.meta as { gateId: string; target: string };
    S.links.push({ from: target, to: gateId, label: "gate" });
    S.vm.H.push({ type: "gate", tau: S.vm.tau, data: { id: gateId, target } });
    return { S, h: gateId, r: BOT_ID };
  }
};
