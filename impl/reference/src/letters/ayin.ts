import { BOT_ID, createHandle } from "../state/handles";
import { addCarry } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, LetterMeta, LetterOp, SelectOperands, defaultEnvelope } from "./types";

// ע — Exported-origin continuation.
// Same cont/carry step as נ, but K receives a handle to the origin.
const meta: LetterMeta = {
  letter: "ע",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const ayinOp: LetterOp = {
  meta,
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
  bound: (S: State, ops: SelectOperands) => {
    const origin = ops.args[0];
    const child = nextId(S, "ע");
    S.handles.set(child, createHandle(child, "scope", { meta: { succOf: origin } }));
    addCarry(S, origin, child);
    const originHandleId = nextId(S, "ע");
    S.handles.set(
      originHandleId,
      createHandle(originHandleId, "alias", {
        meta: { target: origin, export_origin: true }
      })
    );
    const cons: Construction = {
      base: origin,
      envelope: defaultEnvelope(),
      meta: { origin, child, originHandleId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { child, originHandleId } = cons.meta as { child: string; originHandleId: string };
    return { S, h: child, r: BOT_ID, export_handle: originHandleId };
  }
};
