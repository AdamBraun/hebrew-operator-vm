import { BOT_ID, createHandle } from "../state/handles";
import { addBoundary } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";
import { selectOperands } from "../vm/select";
import { Construction, LetterMeta, LetterOp, defaultEnvelope } from "./types";

const meta: LetterMeta = {
  letter: "ל",
  arity_req: 1,
  arity_opt: 1,
  distinct_required: false,
  distinct_optional: false,
  reflexive_ok: true
};

export const lamedOp: LetterOp = {
  meta,
  select: (S: State) => selectOperands(S, meta),
  bound: (S: State, ops) => {
    const endpoint = ops.args[0];
    const suggestedDomain = ops.args[1];
    const frame = S.vm.E[S.vm.E.length - 1];
    const domain =
      suggestedDomain ??
      (S.vm.R !== BOT_ID ? S.vm.R : frame?.Omega_frame ? frame.Omega_frame : S.vm.Omega);
    const boundaryId = nextId(S, "ל");
    S.handles.set(
      boundaryId,
      createHandle(boundaryId, "boundary", {
        anchor: 1,
        meta: { inside: endpoint, outside: domain, closedBy: "ל" }
      })
    );
    addBoundary(S, boundaryId, endpoint, domain, 1);
    const endpointId = nextId(S, "ל");
    S.handles.set(
      endpointId,
      createHandle(endpointId, "endpoint", {
        meta: { endpoint, domain, boundaryId }
      })
    );
    const cons: Construction = {
      base: endpoint,
      envelope: defaultEnvelope(),
      meta: { endpointId, endpoint, domain, boundaryId }
    };
    return { S, cons };
  },
  seal: (S: State, cons: Construction) => {
    const { endpointId, endpoint, domain, boundaryId } = cons.meta as {
      endpointId: string;
      endpoint: string;
      domain: string;
      boundaryId: string;
    };
    S.links.push({ from: endpoint, to: endpointId, label: "endpoint" });
    S.vm.H.push({
      type: "endpoint",
      tau: S.vm.tau,
      data: { id: endpointId, endpoint, domain, boundaryId }
    });
    return { S, h: endpointId, r: BOT_ID };
  }
};
