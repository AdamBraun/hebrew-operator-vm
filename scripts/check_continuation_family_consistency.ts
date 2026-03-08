import assert from "node:assert/strict";
import { finalNunOp } from "../src/reference/letters/finalNun";
import { nunOp } from "../src/reference/letters/nun";
import type { LetterOp } from "../src/reference/letters/types";
import { vavOp } from "../src/reference/letters/vav";
import { yodOp } from "../src/reference/letters/yod";
import { zayinOp } from "../src/reference/letters/zayin";
import type { Handle } from "../src/reference/state/handles";
import { createInitialState } from "../src/reference/state/state";

type EdgeDelta = {
  cont: string[];
  carry: string[];
  supp: string[];
};

type Execution = {
  nodeId: string;
  focusBefore: string;
  focusAfter: string;
  operatorKDelta: string[];
  finalKDelta: string[];
  edgeDelta: EdgeDelta;
  rawHandle: Handle;
};

type FamilyExecution = {
  yod: Execution;
  vav: Execution;
  nun: Execution;
  finalNun: Execution;
  zayin: Execution;
};

type HandleSnapshot = {
  kind: Handle["kind"];
  policy: Handle["policy"];
  anchor: Handle["anchor"];
  edge_mode: Handle["edge_mode"];
  envelope: {
    ctx_flow: Handle["envelope"]["ctx_flow"];
    x_flow: Handle["envelope"]["x_flow"];
    data_flow: Handle["envelope"]["data_flow"];
    edit_flow: Handle["envelope"]["edit_flow"];
    ports: string[];
    coupling: Handle["envelope"]["coupling"];
    policy: Handle["envelope"]["policy"];
  };
  meta: Record<string, any>;
};

function diffSet(after: Set<string>, before: Set<string>): string[] {
  return Array.from(after)
    .filter((edge) => !before.has(edge))
    .sort();
}

function normalizeEdges(edges: string[], replacements: Record<string, string>): string[] {
  return edges
    .map((edge) => {
      const [from = "", to = ""] = edge.split("->");
      return `${replacements[from] ?? from}->${replacements[to] ?? to}`;
    })
    .sort();
}

function findFreshNodeId(currentIds: Iterable<string>, baselineIds: Set<string>): string {
  const freshIds = Array.from(currentIds)
    .filter((id) => !baselineIds.has(id))
    .sort();
  assert.equal(
    freshIds.length,
    1,
    `expected exactly one fresh continuation node, got ${JSON.stringify(freshIds)}`
  );
  return freshIds[0];
}

function executeUnary(op: LetterOp): Execution {
  const baseline = createInitialState();
  const state = createInitialState();
  const focusBefore = baseline.vm.F;
  const baselineHandleIds = new Set(baseline.handles.keys());
  const baselineK = [...baseline.vm.K];

  const selected = op.select(state);
  const bound = op.bound(selected.S, selected.ops);
  const sealed = op.seal(bound.S, bound.cons);

  const nodeId = findFreshNodeId(state.handles.keys(), baselineHandleIds);
  const rawHandle = state.handles.get(nodeId);
  assert.ok(rawHandle, `missing fresh handle for ${nodeId}`);
  const operatorKDelta = state.vm.K.slice(baselineK.length);

  state.vm.K.push(sealed.export_handle ?? sealed.h);
  state.vm.F = sealed.advance_focus === false ? focusBefore : sealed.h;
  state.vm.R = sealed.r;

  return {
    nodeId,
    focusBefore,
    focusAfter: state.vm.F,
    operatorKDelta,
    finalKDelta: state.vm.K.slice(baselineK.length),
    edgeDelta: {
      cont: normalizeEdges(diffSet(state.cont, baseline.cont), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      }),
      carry: normalizeEdges(diffSet(state.carry, baseline.carry), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      }),
      supp: normalizeEdges(diffSet(state.supp, baseline.supp), {
        [focusBefore]: "F0",
        [nodeId]: "N1"
      })
    },
    rawHandle
  };
}

function executeFamily(): FamilyExecution {
  return {
    yod: executeUnary(yodOp),
    vav: executeUnary(vavOp),
    nun: executeUnary(nunOp),
    finalNun: executeUnary(finalNunOp),
    zayin: executeUnary(zayinOp)
  };
}

function snapshotHandle(handle: Handle, omitMetaKeys: string[] = []): HandleSnapshot {
  const meta = Object.fromEntries(
    Object.entries(handle.meta)
      .filter(([key]) => !omitMetaKeys.includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
  );

  return {
    kind: handle.kind,
    policy: handle.policy,
    anchor: handle.anchor,
    edge_mode: handle.edge_mode,
    envelope: {
      ctx_flow: handle.envelope.ctx_flow,
      x_flow: handle.envelope.x_flow,
      data_flow: handle.envelope.data_flow,
      edit_flow: handle.envelope.edit_flow,
      ports: Array.from(handle.envelope.ports).sort(),
      coupling: handle.envelope.coupling,
      policy: handle.envelope.policy
    },
    meta
  };
}

function verifyEdgeGradient(family: FamilyExecution): void {
  assert.deepStrictEqual(family.yod.edgeDelta.cont, ["F0->N1"]);
  assert.deepStrictEqual(family.vav.edgeDelta.cont, ["F0->N1"]);
  assert.deepStrictEqual(family.yod.edgeDelta.cont, family.vav.edgeDelta.cont);
  assert.deepStrictEqual(family.nun.edgeDelta.cont, family.vav.edgeDelta.cont);
  assert.deepStrictEqual(family.finalNun.edgeDelta.cont, family.vav.edgeDelta.cont);
  assert.deepStrictEqual(family.zayin.edgeDelta.cont, family.vav.edgeDelta.cont);

  assert.deepStrictEqual(family.yod.edgeDelta.carry, []);
  assert.deepStrictEqual(family.vav.edgeDelta.carry, []);
  assert.deepStrictEqual(family.nun.edgeDelta.carry, ["F0->N1"]);
  assert.deepStrictEqual(family.finalNun.edgeDelta.carry, family.nun.edgeDelta.carry);
  assert.deepStrictEqual(family.zayin.edgeDelta.carry, family.nun.edgeDelta.carry);

  assert.deepStrictEqual(family.yod.edgeDelta.supp, []);
  assert.deepStrictEqual(family.vav.edgeDelta.supp, []);
  assert.deepStrictEqual(family.nun.edgeDelta.supp, []);
  assert.deepStrictEqual(family.finalNun.edgeDelta.supp, ["N1->F0"]);
  assert.deepStrictEqual(family.zayin.edgeDelta.supp, family.finalNun.edgeDelta.supp);
}

function verifyYodVavEquivalence(family: FamilyExecution): void {
  assert.deepStrictEqual(family.yod.edgeDelta, family.vav.edgeDelta);
  assert.equal(family.yod.rawHandle.meta.pinOf, family.yod.focusBefore);
  assert.equal(family.yod.rawHandle.meta.selectable_pin, 1);
  assert.equal(family.yod.rawHandle.meta.handle_label, "pin");
  assert.equal(family.vav.rawHandle.meta.pinOf, undefined);
  assert.equal(family.vav.rawHandle.meta.selectable_pin, undefined);
  assert.equal(family.vav.rawHandle.meta.handle_label, undefined);
  assert.deepStrictEqual(
    snapshotHandle(family.yod.rawHandle, ["pinOf", "selectable_pin", "handle_label"]),
    snapshotHandle(family.vav.rawHandle)
  );

  assert.equal(family.yod.focusAfter, family.yod.focusBefore);
  assert.equal(family.vav.focusAfter, family.vav.nodeId);
  assert.notEqual(family.vav.focusAfter, family.vav.focusBefore);

  assert.deepStrictEqual(family.yod.operatorKDelta, []);
  assert.deepStrictEqual(family.vav.operatorKDelta, []);
  assert.deepStrictEqual(family.yod.finalKDelta, [family.yod.nodeId]);
  assert.deepStrictEqual(family.vav.finalKDelta, [family.vav.nodeId]);
}

function verifyFinalNunZayinEquivalence(family: FamilyExecution): void {
  assert.deepStrictEqual(family.zayin.edgeDelta, family.finalNun.edgeDelta);

  assert.equal(family.zayin.rawHandle.meta.portOf, family.zayin.focusBefore);
  assert.equal(family.zayin.rawHandle.meta.handle_label, "resolved_port");
  assert.equal(family.finalNun.rawHandle.meta.portOf, undefined);
  assert.equal(family.finalNun.rawHandle.meta.handle_label, undefined);
  assert.deepStrictEqual(
    snapshotHandle(family.zayin.rawHandle, ["portOf", "handle_label"]),
    snapshotHandle(family.finalNun.rawHandle)
  );

  assert.equal(family.zayin.focusAfter, family.zayin.focusBefore);
  assert.equal(family.finalNun.focusAfter, family.finalNun.nodeId);
  assert.notEqual(family.finalNun.focusAfter, family.finalNun.focusBefore);

  assert.deepStrictEqual(family.zayin.operatorKDelta, [family.zayin.nodeId]);
  assert.deepStrictEqual(family.finalNun.operatorKDelta, []);
  assert.deepStrictEqual(family.zayin.finalKDelta, [family.zayin.nodeId, family.zayin.nodeId]);
  assert.deepStrictEqual(family.finalNun.finalKDelta, [family.finalNun.nodeId]);
}

function verifyFamilySealTiers(family: FamilyExecution): void {
  assert.deepStrictEqual(
    snapshotHandle(family.yod.rawHandle, ["pinOf", "selectable_pin", "handle_label"]),
    snapshotHandle(family.vav.rawHandle)
  );
  assert.equal(family.nun.rawHandle.meta.succOf, family.nun.focusBefore);
  assert.equal(family.vav.rawHandle.meta.succOf, undefined);
  assert.deepStrictEqual(
    snapshotHandle(family.vav.rawHandle),
    snapshotHandle(family.nun.rawHandle, ["succOf"])
  );

  assert.deepStrictEqual(
    snapshotHandle(family.finalNun.rawHandle),
    snapshotHandle(family.zayin.rawHandle, ["portOf", "handle_label"])
  );
  assert.notDeepStrictEqual(
    snapshotHandle(family.vav.rawHandle),
    snapshotHandle(family.finalNun.rawHandle)
  );

  assert.deepStrictEqual(family.yod.operatorKDelta, []);
  assert.deepStrictEqual(family.vav.operatorKDelta, []);
  assert.deepStrictEqual(family.nun.operatorKDelta, []);
  assert.deepStrictEqual(family.finalNun.operatorKDelta, []);
  assert.deepStrictEqual(family.zayin.operatorKDelta, [family.zayin.nodeId]);

  assert.equal(family.yod.focusAfter, family.yod.focusBefore);
  assert.equal(family.vav.focusAfter, family.vav.nodeId);
  assert.equal(family.nun.focusAfter, family.nun.nodeId);
  assert.equal(family.finalNun.focusAfter, family.finalNun.nodeId);
  assert.equal(family.zayin.focusAfter, family.zayin.focusBefore);

  assert.deepStrictEqual(family.yod.finalKDelta, [family.yod.nodeId]);
  assert.deepStrictEqual(family.vav.finalKDelta, [family.vav.nodeId]);
  assert.deepStrictEqual(family.nun.finalKDelta, [family.nun.nodeId]);
  assert.deepStrictEqual(family.finalNun.finalKDelta, [family.finalNun.nodeId]);
  assert.deepStrictEqual(family.zayin.finalKDelta, [family.zayin.nodeId, family.zayin.nodeId]);
}

function main(): void {
  const family = executeFamily();
  verifyEdgeGradient(family);
  verifyYodVavEquivalence(family);
  verifyFinalNunZayinEquivalence(family);
  verifyFamilySealTiers(family);
  console.log("continuation family consistency: OK");
}

main();
