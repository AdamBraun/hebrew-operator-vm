import { createHandle } from "../state/handles";
import { addBoundary, closeMemZoneSilently } from "../state/relations";
import { State } from "../state/state";
import { collectGarbage } from "./gc";
import { nextId } from "./ids";

export function applySpace(state: State): void {
  state.vm.tau += 1;

  while (state.vm.OStack_word.length > 0) {
    const obligation = state.vm.OStack_word.pop();
    if (!obligation) {
      break;
    }
    if (obligation.kind === "MEM_ZONE") {
      closeMemZoneSilently(state, obligation.child);
    }
    if (obligation.kind === "SUPPORT") {
      state.vm.H.push({
        type: "fall",
        tau: state.vm.tau,
        data: { child: obligation.child, parent: obligation.parent }
      });
      state.vm.R = obligation.child;
      state.vm.F = obligation.parent;
    }
    if (obligation.kind === "BOUNDARY") {
      const boundaryId = nextId(state, "□");
      state.handles.set(
        boundaryId,
        createHandle(boundaryId, "boundary", {
          anchor: 1,
          meta: { inside: obligation.child, outside: obligation.parent, closedBy: "space" }
        })
      );
      addBoundary(state, boundaryId, obligation.child, obligation.parent, 1);
      state.vm.H.push({
        type: "boundary_auto_close",
        tau: state.vm.tau,
        data: { id: boundaryId, inside: obligation.child, outside: obligation.parent }
      });
      state.vm.R = obligation.child;
      state.vm.F = obligation.parent;
    }
  }

  state.vm.K = [state.vm.F, state.vm.R];
  collectGarbage(state);
}
