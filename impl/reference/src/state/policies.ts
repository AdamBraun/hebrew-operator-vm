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
  if (envelope.policy !== "soft") {
    return envelope;
  }
  return {
    ...envelope,
    policy: "framed_lock"
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
