import type { HandlePolicy } from "./handles";
import type { State } from "./state";

export type Envelope = {
  ctx_flow: "HIGH" | "LOW";
  x_flow: "IMPLICIT_OK" | "EXPLICIT_ONLY";
  data_flow: "LIVE" | "SNAPSHOT";
  edit_flow: "OPEN" | "TIGHT";
  ports: Set<string>;
  coupling: "LINK" | "CopyNoBacklink";
  policy: HandlePolicy;
};

export function defaultEnvelope(policy: HandlePolicy = "soft"): Envelope {
  return {
    ctx_flow: "LOW",
    x_flow: "IMPLICIT_OK",
    data_flow: "LIVE",
    edit_flow: "OPEN",
    ports: new Set(),
    coupling: "LINK",
    policy
  };
}

export function harden(envelope: Envelope): Envelope {
  const raisePolicy = (policy: HandlePolicy): HandlePolicy => {
    if (policy === "soft") {
      return "framed_lock";
    }
    if (policy === "framed_lock") {
      return "final";
    }
    return "final";
  };
  return {
    ...envelope,
    ctx_flow: "LOW",
    x_flow: "EXPLICIT_ONLY",
    data_flow: "SNAPSHOT",
    edit_flow: "TIGHT",
    ports: new Set(),
    coupling: "CopyNoBacklink",
    policy: raisePolicy(envelope.policy)
  };
}

function restrictPolicy(policy: HandlePolicy): HandlePolicy {
  if (policy === "soft") {
    return "framed_lock";
  }
  return policy;
}

// ט-style restriction: keep the same live handle, but force external access
// through an explicit sanctioned port instead of ambient/default reachability.
export function restrictToPortAccess(
  envelope: Envelope,
  ports: Iterable<string> = envelope.ports
): Envelope {
  return {
    ...envelope,
    ctx_flow: "LOW",
    x_flow: "EXPLICIT_ONLY",
    data_flow: "LIVE",
    edit_flow: "TIGHT",
    ports: new Set(ports),
    coupling: "LINK",
    policy: restrictPolicy(envelope.policy)
  };
}

function cloneEnvelope(envelope: Envelope): Envelope {
  return {
    ...envelope,
    ports: new Set(envelope.ports)
  };
}

export function applyEnvelopeToHandle(state: State, handleId: string, envelope: Envelope): void {
  const handle = state.handles.get(handleId);
  if (!handle) {
    return;
  }
  handle.envelope = cloneEnvelope(envelope);
  handle.policy = handle.envelope.policy;
}

export function setPolicy(state: State, handleId: string, policy: HandlePolicy): void {
  const handle = state.handles.get(handleId);
  if (handle) {
    handle.policy = policy;
    handle.envelope = { ...handle.envelope, policy };
  }
}

export function hardenHandle(state: State, handleId: string): void {
  const handle = state.handles.get(handleId);
  if (!handle) {
    return;
  }
  applyEnvelopeToHandle(state, handleId, harden(handle.envelope));
}
