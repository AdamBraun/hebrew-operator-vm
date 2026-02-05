import { BOT_ID, createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ץ",
  arity_req: 2,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const finalTsadiOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const [focus, exemplar] = ops.args;
    const alignedId = nextId(S, "ץ");
    S.handles.set(
      alignedId,
      createHandle(alignedId, "artifact", {
        policy: "final",
        meta: { focus, exemplar, aligned: 1 }
      })
    );
    const cons: Construction = {
      base: focus,
      envelope: defaultEnvelope("final"),
      meta: { alignedId, focus, exemplar }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { alignedId, focus, exemplar } = cons.meta as {
      alignedId: string;
      focus: string;
      exemplar: string;
    };
    S.links.push({ from: focus, to: alignedId, label: "align" });
    S.vm.H.push({
      type: "align_final",
      tau: S.vm.tau,
      data: { id: alignedId, focus, exemplar }
    });
    return { S, h: alignedId, r: BOT_ID };
  }
};
