import { BOT_ID, OMEGA_ID } from "./handles";
import { State } from "./state";

export function assertStateInvariants(state: State): void {
  const ids = new Set(state.handles.keys());
  ids.add(BOT_ID);
  ids.add(OMEGA_ID);

  const ensure = (id: string): void => {
    if (!ids.has(id)) {
      throw new Error(`Missing handle ${id}`);
    }
  };

  ensure(BOT_ID);
  ensure(OMEGA_ID);
  if (state.handles.get(BOT_ID)?.kind !== "empty") {
    throw new Error(`Handle ${BOT_ID} must be kind 'empty'`);
  }
  if (state.handles.get(OMEGA_ID)?.kind !== "scope") {
    throw new Error(`Handle ${OMEGA_ID} must be kind 'scope'`);
  }
  ensure(state.vm.D);
  ensure(state.vm.F);
  ensure(state.vm.R);
  if (!Number.isInteger(state.vm.segment.segmentId) || state.vm.segment.segmentId < 0) {
    throw new Error(`vm.segment.segmentId must be a non-negative integer`);
  }
  if (!Array.isArray(state.vm.segment.OStack)) {
    throw new Error(`vm.segment.OStack must be an array`);
  }
  if (state.vm.segment.OStack !== state.vm.OStack_word) {
    throw new Error(`vm.segment.OStack must alias vm.OStack_word`);
  }
  state.vm.K.forEach(ensure);
  state.vm.W.forEach(ensure);
  state.vm.A.forEach(ensure);
  if (state.vm.wordLastSealedArtifact) {
    ensure(state.vm.wordLastSealedArtifact);
  }
  if (state.vm.activeConstruct) {
    ensure(state.vm.activeConstruct);
  }
  if (state.vm.wordEntryFocus) {
    ensure(state.vm.wordEntryFocus);
  }
  if (state.vm.PendingJoin) {
    ensure(state.vm.PendingJoin.left_span_handle);
  }
  for (const value of state.vm.phraseWordValues) {
    ensure(value);
  }

  for (const obligation of state.vm.OStack_word) {
    ensure(obligation.parent);
    ensure(obligation.child);
    if (obligation.tau_created > state.vm.tau) {
      throw new Error(`Obligation tau_created ${obligation.tau_created} exceeds vm.tau`);
    }
  }

  for (const event of state.vm.H) {
    if (event.tau < 1 || event.tau > state.vm.tau) {
      throw new Error(`Event tau ${event.tau} out of bounds`);
    }
    if (event.data?.child) {
      ensure(event.data.child);
    }
    if (event.data?.parent) {
      ensure(event.data.parent);
    }
  }

  for (let i = 1; i < state.vm.H.length; i += 1) {
    if (state.vm.H[i].tau < state.vm.H[i - 1].tau) {
      throw new Error("Event tau values must be nondecreasing");
    }
  }

  for (const chunk of state.vm.H_phrase) {
    if (chunk.start_event_index < 0 || chunk.end_event_index < chunk.start_event_index) {
      throw new Error(`Invalid H_phrase range for chunk ${chunk.id}`);
    }
    ensure(chunk.word_value);
  }
  for (const chunk of state.vm.H_committed) {
    if (chunk.start_event_index < 0 || chunk.end_event_index < chunk.start_event_index) {
      throw new Error(`Invalid H_committed range for chunk ${chunk.id}`);
    }
    ensure(chunk.word_value);
  }

  const nodeIds = new Set(Object.keys(state.vm.CNodes));
  for (const frame of state.vm.CStack) {
    if (!nodeIds.has(frame.node_id)) {
      throw new Error(`CStack references missing node ${frame.node_id}`);
    }
  }
  for (const node of Object.values(state.vm.CNodes)) {
    if (node.parent_id && !nodeIds.has(node.parent_id)) {
      throw new Error(`Constituent node ${node.id} has missing parent ${node.parent_id}`);
    }
    for (const childId of node.children) {
      if (!nodeIds.has(childId)) {
        throw new Error(`Constituent node ${node.id} has missing child ${childId}`);
      }
    }
  }

  for (const edge of state.cont) {
    const [from, to] = edge.split("->");
    ensure(from);
    ensure(to);
  }

  for (const boundary of state.boundaries) {
    ensure(boundary.inside);
    ensure(boundary.outside);
    ensure(boundary.id);
  }

  for (const link of state.links) {
    ensure(link.from);
    ensure(link.to);
  }

  for (const edge of state.vm.aliasEdges) {
    ensure(edge.from);
    ensure(edge.to);
    if (edge.type !== "ALIAS") {
      throw new Error(`Alias edge type must be ALIAS (got ${String(edge.type)})`);
    }
  }
}
