import { BOT_ID, createHandle } from "../state/handles";
import { applyEnvelopeToHandle } from "../state/policies";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { Construction, Envelope, LetterMeta, LetterOp, defaultEnvelope } from "./types";

function restrictToPortAccess(envelope: Envelope, ports: Iterable<string>): Envelope {
  return {
    ...envelope,
    ctx_flow: "LOW",
    x_flow: "EXPLICIT_ONLY",
    data_flow: "LIVE",
    edit_flow: "TIGHT",
    ports: new Set(ports),
    coupling: "LINK",
    policy: envelope.policy === "soft" ? "framed_lock" : envelope.policy
  };
}

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
  select: (S: State) => ({ S, ops: { args: [S.vm.F], prefs: {} } }),
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
      data: { id: portId, target }
    });
    return { S, h: portId, r: BOT_ID };
  }
};
