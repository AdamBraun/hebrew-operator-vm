import type { HandlePolicy } from "../state/handles";
import { createHandle } from "../state/handles";
import { committedEnvelope, setPolicy } from "../state/policies";
import { addCarry, addCont, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";

type ContinuationNodeArgs = {
  sourceId: string;
  idPrefix: string;
  meta?: Record<string, any>;
};

type SpawnResolvedCarryNodeArgs = ContinuationNodeArgs & {
  setPolicyLikeZayin: boolean;
};

type HandleOverrides = Parameters<typeof createHandle>[2];

// Keep zayin-style sealing in one place so final nun inherits the same handle
// fields whenever zayin's committed node shape changes.
const ZAYIN_POLICY: HandlePolicy | null = null;

function allocateContinuationNode(
  S: State,
  idPrefix: string,
  overrides: HandleOverrides = {}
): string {
  const nodeId = nextId(S, idPrefix);
  S.handles.set(nodeId, createHandle(nodeId, "scope", overrides));
  return nodeId;
}

function applyZayinSealedHandleFields(S: State, nodeId: string, setPolicyLikeZayin: boolean): void {
  if (setPolicyLikeZayin && ZAYIN_POLICY !== null) {
    setPolicy(S, nodeId, ZAYIN_POLICY);
  }
}

export function spawnContinuationNode(
  S: State,
  { sourceId, idPrefix, meta = {} }: ContinuationNodeArgs
): { nodeId: string } {
  // Shared cont-only substrate for the continuation family.
  // `ו` advances focus to this node; `י` exports it while keeping focus fixed.
  const nodeId = allocateContinuationNode(S, idPrefix, { meta });
  addCont(S, sourceId, nodeId);
  return { nodeId };
}

export function spawnCarryContinuationNode(
  S: State,
  { sourceId, idPrefix, meta = {} }: ContinuationNodeArgs
): { nodeId: string } {
  const nodeId = allocateContinuationNode(S, idPrefix, { meta });
  addCarry(S, sourceId, nodeId);
  return { nodeId };
}

export function spawnResolvedCarryNode(
  S: State,
  { sourceId, idPrefix, meta = {}, setPolicyLikeZayin }: SpawnResolvedCarryNodeArgs
): { nodeId: string } {
  const nodeId = allocateContinuationNode(S, idPrefix, {
    meta,
    edge_mode: "committed",
    envelope: committedEnvelope()
  });
  applyZayinSealedHandleFields(S, nodeId, setPolicyLikeZayin);
  addCarry(S, sourceId, nodeId);
  addSupp(S, nodeId, sourceId);
  return { nodeId };
}
