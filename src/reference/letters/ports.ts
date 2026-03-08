import { committedEnvelope } from "../state/policies";
import { createHandle } from "../state/handles";
import { addCarry, addSupp } from "../state/relations";
import { State } from "../state/state";
import { nextId } from "../vm/ids";

type SpawnResolvedPortArgs = {
  portOf: string;
  prefix: string;
  exportToK: boolean;
};

// Shared ז-style port primitive: committed handle plus resolved carry edges.
// Standard letters usually leave `exportToK` false because the VM publishes the
// sealed handle during register commit. Internal callers can keep the same
// structure without exposing the port on K.
export function spawnResolvedPort(
  S: State,
  { portOf, prefix, exportToK }: SpawnResolvedPortArgs
): { portId: string } {
  const portId = nextId(S, prefix);
  S.handles.set(
    portId,
    createHandle(portId, "scope", {
      meta: { portOf },
      edge_mode: "committed",
      envelope: committedEnvelope()
    })
  );
  addCarry(S, portOf, portId);
  addSupp(S, portId, portOf);
  if (exportToK) {
    S.vm.K.push(portId);
  }
  return { portId };
}
