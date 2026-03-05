import { createHandle } from "../../state/handles";
import { Envelope, defaultEnvelope } from "../../state/policies";
import { addCont, addSub } from "../../state/relations";
import { State } from "../../state/state";
import { nextId } from "../ids";

export type ForkDirection = "external" | "internal";
export type ForkActive = "left" | "right";

export type ForkHandle = {
  parentId: string;
  focusId: string;
  direction: ForkDirection;
  active: ForkActive;
  activeId: string;
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

function activeBranch(active?: ForkActive): ForkActive {
  return active === "left" ? "left" : "right";
}

export function fork(
  state: State,
  focusId: string,
  direction: ForkDirection,
  active?: ForkActive
): ForkHandle {
  const activeResolved = activeBranch(active);
  const spineId = nextId(state, "ש");
  const leftId = nextId(state, "ש");
  const rightId = nextId(state, "ש");
  const activeId = activeResolved === "left" ? leftId : rightId;
  const envelopeSnapshot = focusEnvelopeSnapshot(state, focusId);

  if (direction === "external") {
    const parentId = nextId(state, "ש");
    state.handles.set(
      spineId,
      createHandle(spineId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "spine", parent: parentId, fork_direction: "external" }
      })
    );
    state.handles.set(
      leftId,
      createHandle(leftId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "left", parent: parentId, fork_direction: "external" }
      })
    );
    state.handles.set(
      rightId,
      createHandle(rightId, "structured", {
        envelope: cloneEnvelopeSnapshot(envelopeSnapshot),
        meta: { role: "right", parent: parentId, fork_direction: "external" }
      })
    );
    state.handles.set(
      parentId,
      createHandle(parentId, "structured", {
        meta: {
          base: focusId,
          spine: spineId,
          left: leftId,
          right: rightId,
          active: activeResolved,
          fork_direction: "external"
        }
      })
    );
    addCont(state, focusId, spineId);
    addCont(state, focusId, leftId);
    addCont(state, focusId, rightId);
    return {
      parentId,
      focusId,
      direction,
      active: activeResolved,
      activeId,
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

  const focus = state.handles.get(focusId);
  if (focus) {
    focus.meta = {
      ...(focus.meta ?? {}),
      fork_direction: "internal",
      fork_children: [spineId, leftId, rightId],
      active_branch: activeResolved,
      active_child: activeId
    };
  }

  return {
    parentId: focusId,
    focusId,
    direction,
    active: activeResolved,
    activeId,
    spineId,
    leftId,
    rightId
  };
}
