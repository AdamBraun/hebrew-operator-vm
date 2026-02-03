import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ו",
  arity_req: 2,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const vavOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [from, to] = ops.args;
    const cons: Construction = {
      base: from,
      envelope: defaultEnvelope(),
      meta: { from, to }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { from, to } = cons.meta as { from: string; to: string };
    const linkId = nextId(S, "ו");
    S.handles.set(
      linkId,
      createHandle(linkId, "structured", { meta: { from, to, label: "vav" } })
    );
    S.links.push({ from, to, label: "vav" });
    return { S, h: linkId, r: BOT_ID };
  }
};
