import { HandlePolicy } from "./handles";
import { State } from "./state";

export function setPolicy(state: State, handleId: string, policy: HandlePolicy): void {
  const handle = state.handles.get(handleId);
  if (handle) {
    handle.policy = policy;
  }
}

export function harden(state: State, handleId: string): void {
  const handle = state.handles.get(handleId);
  if (!handle) {
    return;
  }
  if (handle.policy === "soft") {
    handle.policy = "framed_lock";
  }
}
