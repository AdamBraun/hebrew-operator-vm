import { createHandle } from "../state/handles";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ך",
  arity_req: 1,
  arity_opt: 1,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const finalKafOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const target = ops.args[0];
    const template = ops.args[1];
    const portionId = nextId(S, "ך");
    const residueId = nextId(S, "ך");
    S.handles.set(
      portionId,
      createHandle(portionId, "scope", {
        policy: "framed_lock",
        meta: { portionOf: target, template, unitized: 1, final: 1 }
      })
    );
    S.handles.set(
      residueId,
      createHandle(residueId, "scope", { meta: { residueOf: target, template } })
    );
    const cons: Construction = {
      base: target,
      envelope: defaultEnvelope("framed_lock"),
      meta: { portionId, residueId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { portionId, residueId } = cons.meta as { portionId: string; residueId: string };
    return { S, h: portionId, r: residueId };
  }
};
