import { createHandle } from "../../state/handles";
import { Envelope, defaultEnvelope } from "../../state/policies";
import { addCont, addSub } from "../../state/relations";
import { State } from "../../state/state";
import { nextId } from "../ids";

export type AttachThreeDirection = "external" | "internal";

export type AttachThreeResult = {
  points: [string, string, string];
  direction: AttachThreeDirection;
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

function stampAttachThreeMeta(
  state: State,
  focusId: string,
  direction: AttachThreeDirection,
  points: [string, string, string]
): void {
  const focus = state.handles.get(focusId);
  if (!focus) {
    return;
  }
  const nextMeta: Record<string, any> = {
    ...(focus.meta ?? {}),
    fork_direction: direction,
    fork_ports: points
  };
  delete nextMeta.active_branch;
  delete nextMeta.active_child;
  delete nextMeta.fork_children;
  focus.meta = nextMeta;
}

function emitShinEvent(
  state: State,
  focusId: string,
  direction: AttachThreeDirection,
  points: [string, string, string]
): void {
  const [p1, p2, p3] = points;
  state.vm.H.push({
    type: "shin",
    tau: state.vm.tau,
    data: {
      id: focusId,
      focus: focusId,
      direction,
      points,
      // Retain legacy payload keys consumed by trace/render tooling.
      spine: p1,
      left: p2,
      right: p3
    }
  });
}

export function attachThree(
  focusId: string,
  direction: AttachThreeDirection,
  state: State
): AttachThreeResult {
  const p1 = nextId(state, "ש");
  const p2 = nextId(state, "ש");
  const p3 = nextId(state, "ש");
  const points: [string, string, string] = [p1, p2, p3];
  const envelopeSnapshot = focusEnvelopeSnapshot(state, focusId);

  if (direction === "external") {
    state.handles.set(
      p1,
      createHandle(p1, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "p1", parent: focusId, fork_direction: "external" }
      })
    );
    state.handles.set(
      p2,
      createHandle(p2, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "p2", parent: focusId, fork_direction: "external" }
      })
    );
    state.handles.set(
      p3,
      createHandle(p3, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "p3", parent: focusId, fork_direction: "external" }
      })
    );
    addCont(state, focusId, p1);
    addCont(state, focusId, p2);
    addCont(state, focusId, p3);
    stampAttachThreeMeta(state, focusId, direction, points);
    emitShinEvent(state, focusId, direction, points);
    return { points, direction };
  }

  state.handles.set(
    p1,
    createHandle(p1, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c1", parent: focusId, fork_direction: "internal" }
    })
  );
  state.handles.set(
    p2,
    createHandle(p2, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c2", parent: focusId, fork_direction: "internal" }
    })
  );
  state.handles.set(
    p3,
    createHandle(p3, "compartment", {
      envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
      meta: { role: "c3", parent: focusId, fork_direction: "internal" }
    })
  );

  addSub(state, focusId, p1);
  addSub(state, focusId, p2);
  addSub(state, focusId, p3);
  addSub(state, p1, p2);
  addSub(state, p2, p3);
  addSub(state, p3, p1);
  stampAttachThreeMeta(state, focusId, direction, points);
  emitShinEvent(state, focusId, direction, points);

  return { points, direction };
}
