import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "א",
  arity_req: 2,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const alephOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [left, right] = ops.args;
    const cons: Construction = {
      base: left,
      envelope: defaultEnvelope(),
      meta: { left, right }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { left, right } = cons.meta as { left: string; right: string };
    const aliasId = nextId(S, "א");
    S.handles.set(
      aliasId,
      createHandle(aliasId, "alias", { meta: { left, right, transport: true } })
    );
    S.links.push({ from: left, to: right, label: "transport" });
    S.links.push({ from: right, to: left, label: "transport" });
    S.vm.H.push({ type: "alias", tau: S.vm.tau, data: { left, right, id: aliasId } });
    return { S, h: aliasId, r: BOT_ID };
  }
};
