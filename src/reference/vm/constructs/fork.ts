import { createHandle } from "../../state/handles";
import { Envelope, defaultEnvelope } from "../../state/policies";
import { addCont, addSub } from "../../state/relations";
import { State } from "../../state/state";
import { nextId } from "../ids";

export type ForkDirection = "external" | "internal";

export type ForkResult = {
  focusId: string;
  direction: ForkDirection;
  spineId: string;
  leftId: string;
  rightId: string;
};

function cloneEnvelopeSnapshot(envelope: Envelope): Envelope {
  return {
    ...envelope,
    ports: new Set(envelope.ports)
  };
}

function focusEnvelopeSnapshot(state: State, focusId: string): Envelope {
  const focusEnvelope = state.handles.get(focusId)?.envelope ?? defaultEnvelope();
  return cloneEnvelopeSnapshot(focusEnvelope);
}

function stampForkMeta(
  state: State,
  focusId: string,
  direction: ForkDirection,
  ports: string[]
): void {
  const focus = state.handles.get(focusId);
  if (!focus) {
    return;
  }
  const nextMeta: Record<string, any> = {
    ...(focus.meta ?? {}),
    fork_direction: direction,
    fork_ports: ports
  };
  delete nextMeta.active_branch;
  delete nextMeta.active_child;
  delete nextMeta.fork_children;
  focus.meta = nextMeta;
}

export function fork(state: State, focusId: string, direction: ForkDirection): ForkResult {
  const spineId = nextId(state, "ש");
  const leftId = nextId(state, "ש");
  const rightId = nextId(state, "ש");
  const envelopeSnapshot = focusEnvelopeSnapshot(state, focusId);
  const ports = [spineId, leftId, rightId];

  if (direction === "external") {
    state.handles.set(
      spineId,
      createHandle(spineId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "spine", parent: focusId, fork_direction: "external" }
      })
    );
    state.handles.set(
      leftId,
      createHandle(leftId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "left", parent: focusId, fork_direction: "external" }
      })
    );
    state.handles.set(
      rightId,
      createHandle(rightId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "right", parent: focusId, fork_direction: "external" }
      })
    );
    addCont(state, focusId, spineId);
    addCont(state, focusId, leftId);
    addCont(state, focusId, rightId);
    stampForkMeta(state, focusId, direction, ports);
    state.links.push({ from: focusId, to: spineId, label: "branch" });
    state.links.push({ from: focusId, to: leftId, label: "branch" });
    state.links.push({ from: focusId, to: rightId, label: "branch" });
    state.vm.H.push({
      type: "shin",
      tau: state.vm.tau,
      data: {
        id: focusId,
        focus: focusId,
        spine: spineId,
        left: leftId,
        right: rightId,
        direction
      }
    });
    return {
      focusId,
      direction,
      spineId,
      leftId,
      rightId
    };
  }

  state.handles.set(
    spineId,
    createHandle(spineId, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c1", parent: focusId, fork_direction: "internal" }
    })
  );
  state.handles.set(
    leftId,
    createHandle(leftId, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c2", parent: focusId, fork_direction: "internal" }
    })
  );
  state.handles.set(
    rightId,
    createHandle(rightId, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c3", parent: focusId, fork_direction: "internal" }
    })
  );
  addSub(state, focusId, spineId);
  addSub(state, focusId, leftId);
  addSub(state, focusId, rightId);
  stampForkMeta(state, focusId, direction, ports);
  state.vm.H.push({
    type: "shin",
    tau: state.vm.tau,
    data: {
      id: focusId,
      focus: focusId,
      spine: spineId,
      left: leftId,
      right: rightId,
      direction
    }
  });

  return {
    focusId,
    direction,
    spineId,
    leftId,
    rightId
  };
}
