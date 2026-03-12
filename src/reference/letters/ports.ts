import { State } from "../state/state";
import { spawnResolvedCarryNode } from "./continuation_primitives";

type SpawnResolvedPortArgs = {
  portOf: string;
  prefix: string;
  exportToK: boolean;
};

// Shared internal resolved-port primitive: committed handle plus resolved carry
// edges. Standard letters usually leave `exportToK` false because the VM
// publishes the sealed handle during register commit. Internal callers can keep
// the same structure without exposing the port on K.
export function spawnResolvedPort(
  S: State,
  { portOf, prefix, exportToK }: SpawnResolvedPortArgs
): { portId: string } {
  const { nodeId: portId } = spawnResolvedCarryNode(S, {
    sourceId: portOf,
    idPrefix: prefix,
    meta: { portOf },
    setPolicyLikeZayin: true
  });
  if (exportToK) {
    S.vm.K.push(portId);
  }
  return { portId };
}
