import { defaultEnvelope } from "./policies";
import type { Envelope } from "./policies";

export type HandleKind =
  | "empty"
  | "scope"
  | "entity"
  | "boundary"
  | "alias"
  | "rule"
  | "artifact"
  | "memZone"
  | "memHandle"
  | "endpoint"
  | "watch"
  | "gate"
  | "compartment"
  | "structured";

export type HandlePolicy = "soft" | "framed_lock" | "final";

export type HandleEdgeMode =
  | "free"
  | "gated"
  | "stabilized"
  | "convergent"
  | "committed"
  | "bundled"
  | "collapsed";

export type Handle = {
  id: string;
  kind: HandleKind;
  policy: HandlePolicy;
  anchor: 0 | 1;
  edge_mode: HandleEdgeMode;
  envelope: Envelope;
  meta: Record<string, any>;
};

export const BOT_ID = "⊥";
export const OMEGA_ID = "Ω";

export function createHandle(
  id: string,
  kind: HandleKind,
  overrides: Partial<Omit<Handle, "id" | "kind">> = {}
): Handle {
  const envelope =
    overrides.envelope ??
    defaultEnvelope(overrides.policy ?? "soft");
  return {
    id,
    kind,
    policy: overrides.policy ?? envelope.policy,
    anchor: overrides.anchor ?? 0,
    edge_mode: overrides.edge_mode ?? "free",
    envelope: { ...envelope, policy: overrides.policy ?? envelope.policy },
    meta: overrides.meta ?? {}
  };
}
