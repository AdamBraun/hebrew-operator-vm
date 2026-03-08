import { BOT_ID, createHandle } from "../state/handles";
import { applyEnvelopeToHandle, restrictToPortAccess } from "../state/policies";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectCurrentFocus } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ט",
  arity_req: 1,
  arity_opt: 0,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const tetOp: LetterOp = {
  meta,
  select: (S: State) => selectCurrentFocus(S),
  bound: (S: State, ops) => {
    const [target] = ops.args;
    const portId = nextId(S, "ט");
    const targetHandle = S.handles.get(target);
    const restrictedEnvelope = restrictToPortAccess(targetHandle?.envelope ?? defaultEnvelope(), [
      portId
    ]);
    applyEnvelopeToHandle(S, target, restrictedEnvelope);
    if (targetHandle) {
      targetHandle.meta = {
        ...targetHandle.meta,
        inward_interface: 1,
        sanctioned_port: portId
      };
    }
    S.handles.set(
      portId,
      createHandle(portId, "gate", {
        meta: { target, portOf: target, sanctioned: 1, inward: 1 }
      })
    );
    const cons: Construction = {
      base: target,
      envelope: restrictedEnvelope,
      meta: { target, portId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { target, portId } = cons.meta as {
      target: string;
      portId: string;
    };
    S.vm.H.push({
      type: "covert",
      tau: S.vm.tau,
      data: { target, port: portId }
    });
    return { S, h: portId, r: BOT_ID };
  }
};
