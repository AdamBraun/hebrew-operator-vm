import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ג",
  arity_req: 3,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const gimelOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [from, to, payload] = ops.args;
    const cons: Construction = {
      base: from,
      envelope: defaultEnvelope(),
      meta: { from, to, payload }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { from, to, payload } = cons.meta as { from: string; to: string; payload: string };
    const linkId = nextId(S, "ג");
    S.handles.set(
      linkId,
      createHandle(linkId, "structured", {
        meta: { from, to, payload, label: "gimel" }
      })
    );
    S.links.push({ from, to, label: "bestow" });
    S.vm.H.push({
      type: "bestow",
      tau: S.vm.tau,
      data: { from, to, payload }
    });
    return { S, h: linkId, r: BOT_ID };
  }
};
