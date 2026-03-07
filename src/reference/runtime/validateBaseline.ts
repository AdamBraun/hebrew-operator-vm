import { BOT_ID, OMEGA_ID } from "../state/handles";
import { State } from "../state/state";

export type ValidateBaselineOptions = {
  keepSystemHandles?: Set<string>;
  preserveCounters?: boolean;
  context?: string;
};

function normalizeAllowedHandleIds(keepSystemHandles?: Set<string>): Set<string> {
  const allowed = new Set(keepSystemHandles ?? []);
  allowed.add(OMEGA_ID);
  allowed.add(BOT_ID);
  return allowed;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function assertArrayEmpty(errors: string[], value: unknown, label: string, context: string): void {
  if (!Array.isArray(value)) {
    errors.push(`${context}.${label} expected an array`);
    return;
  }
  if (value.length !== 0) {
    errors.push(`${context}.${label} expected empty but had length ${value.length}`);
  }
}

function assertEquals(errors: string[], actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    errors.push(`${label} expected ${formatValue(expected)} but got ${formatValue(actual)}`);
  }
}

const KNOWN_VM_KEYS = new Set([
  "tau",
  "D",
  "F",
  "R",
  "K",
  "E",
  "W",
  "segment",
  "OStack_word",
  "H",
  "A",
  "aliasEdges",
  "activeConstruct",
  "wordHasContent",
  "wordLastSealedArtifact",
  "wordEntryFocus",
  "metaCounter",
  "route_mode",
  "route_arity",
  "H_phrase",
  "H_committed",
  "PendingJoin",
  "LeftContextBarrier",
  "CStack",
  "CNodes",
  "phraseWordValues",
  "phraseChunkIds",
  "lastBoundaryEventIndex",
  "lastPendingJoinConsumedId"
]);

export function validateBaseline(state: State, opts: ValidateBaselineOptions = {}): void {
  const context = opts.context ?? "finalizeVerse";
  const errors: string[] = [];
  const allowedHandles = normalizeAllowedHandleIds(opts.keepSystemHandles);

  assertEquals(errors, state.vm.D, OMEGA_ID, "vm.D");
  assertEquals(errors, state.vm.F, OMEGA_ID, "vm.F");
  assertEquals(errors, state.vm.R, BOT_ID, "vm.R");
  assertEquals(errors, state.vm.tau, 0, "vm.tau");

  if (!Array.isArray(state.vm.K) || state.vm.K.length !== 2) {
    errors.push(`vm.K expected [${OMEGA_ID}, ${BOT_ID}]`);
  } else {
    assertEquals(errors, state.vm.K[0], OMEGA_ID, "vm.K[0]");
    assertEquals(errors, state.vm.K[1], BOT_ID, "vm.K[1]");
  }

  assertArrayEmpty(errors, state.vm.A, "A", "vm");
  assertArrayEmpty(errors, state.vm.W, "W", "vm");
  assertArrayEmpty(errors, state.vm.E, "E", "vm");
  assertArrayEmpty(errors, state.vm.OStack_word, "OStack_word", "vm");
  assertArrayEmpty(errors, state.vm.H, "H", "vm");
  assertArrayEmpty(errors, state.vm.aliasEdges, "aliasEdges", "vm");
  assertArrayEmpty(errors, state.vm.H_phrase, "H_phrase", "vm");
  assertArrayEmpty(errors, state.vm.H_committed, "H_committed", "vm");
  assertArrayEmpty(errors, state.vm.phraseWordValues, "phraseWordValues", "vm");
  assertArrayEmpty(errors, state.vm.phraseChunkIds, "phraseChunkIds", "vm");
  if (!state.vm.segment || typeof state.vm.segment !== "object") {
    errors.push("vm.segment expected object");
  } else {
    assertEquals(errors, state.vm.segment.segmentId, 0, "vm.segment.segmentId");
    assertArrayEmpty(errors, state.vm.segment.OStack, "OStack", "vm.segment");
    if (state.vm.segment.OStack !== state.vm.OStack_word) {
      errors.push("vm.segment.OStack expected to alias vm.OStack_word");
    }
  }

  if (state.vm.PendingJoin !== undefined) {
    errors.push("vm.PendingJoin expected undefined");
  }
  if (state.vm.wordLastSealedArtifact !== undefined) {
    errors.push("vm.wordLastSealedArtifact expected undefined");
  }
  if (state.vm.activeConstruct !== undefined) {
    errors.push("vm.activeConstruct expected undefined");
  }
  if (state.vm.lastPendingJoinConsumedId !== undefined) {
    errors.push("vm.lastPendingJoinConsumedId expected undefined");
  }
  if (state.vm.route_mode !== undefined) {
    errors.push("vm.route_mode expected undefined");
  }
  if (state.vm.route_arity !== undefined) {
    errors.push("vm.route_arity expected undefined");
  }
  if (state.vm.LeftContextBarrier !== null) {
    errors.push(
      `vm.LeftContextBarrier expected null but got ${formatValue(state.vm.LeftContextBarrier)}`
    );
  }
  if (state.vm.wordHasContent !== false) {
    errors.push(`vm.wordHasContent expected false but got ${formatValue(state.vm.wordHasContent)}`);
  }
  assertEquals(errors, state.vm.wordEntryFocus, OMEGA_ID, "vm.wordEntryFocus");
  assertEquals(errors, state.vm.lastBoundaryEventIndex, 0, "vm.lastBoundaryEventIndex");

  if (!opts.preserveCounters && state.vm.metaCounter !== undefined) {
    errors.push("vm.metaCounter expected undefined when preserveCounters is false");
  }

  if (state.links.length !== 0) {
    errors.push(`links expected empty but had length ${state.links.length}`);
  }
  if (state.boundaries.length !== 0) {
    errors.push(`boundaries expected empty but had length ${state.boundaries.length}`);
  }
  if (state.rules.length !== 0) {
    errors.push(`rules expected empty but had length ${state.rules.length}`);
  }
  if (state.cont.size !== 0) {
    errors.push(`cont expected empty but had size ${state.cont.size}`);
  }
  if (state.carry.size !== 0) {
    errors.push(`carry expected empty but had size ${state.carry.size}`);
  }
  if (state.supp.size !== 0) {
    errors.push(`supp expected empty but had size ${state.supp.size}`);
  }
  if (state.head_of.size !== 0) {
    errors.push(`head_of expected empty but had size ${state.head_of.size}`);
  }
  if (state.sub.size !== 0) {
    errors.push(`sub expected empty but had size ${state.sub.size}`);
  }
  if (Object.keys(state.adjuncts).length !== 0) {
    errors.push(`adjuncts expected empty but had size ${Object.keys(state.adjuncts).length}`);
  }

  const handleIds = Array.from(state.handles.keys());
  for (const id of handleIds) {
    if (!allowedHandles.has(id)) {
      errors.push(`handles contains unexpected id '${id}'`);
    }
  }
  for (const required of [OMEGA_ID, BOT_ID]) {
    if (!state.handles.has(required)) {
      errors.push(`handles missing required id '${required}'`);
    }
  }
  if (state.handles.get(OMEGA_ID)?.kind !== "scope") {
    errors.push(`handles['${OMEGA_ID}'] expected kind 'scope'`);
  }
  if (state.handles.get(BOT_ID)?.kind !== "empty") {
    errors.push(`handles['${BOT_ID}'] expected kind 'empty'`);
  }

  const unknownVmKeys = Object.keys(state.vm)
    .filter((key) => !KNOWN_VM_KEYS.has(key))
    .sort((left, right) => left.localeCompare(right));
  if (unknownVmKeys.length > 0) {
    errors.push(`Unexpected vm baseline fields detected: ${unknownVmKeys.join(", ")}`);
  }

  if (errors.length > 0) {
    throw new Error(
      [
        `Post-reset baseline invariant failed (${context})`,
        ...errors.map((error) => `- ${error}`)
      ].join("\n")
    );
  }
}
