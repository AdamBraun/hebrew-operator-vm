import { describe, expect, it } from "vitest";
import { finalNunOp } from "@ref/letters/finalNun";
import type { LetterOp } from "@ref/letters/types";
import { nunOp } from "@ref/letters/nun";
import type { Handle } from "@ref/state/handles";
import { createInitialState } from "@ref/state/state";
import { vavOp } from "@ref/letters/vav";
import { yodOp } from "@ref/letters/yod";
import { zayinOp } from "@ref/letters/zayin";

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

type Execution = {
  nodeId: string;
  focusBefore: string;
  focusAfter: string;
  operatorKDelta: string[];
  finalKDelta: string[];
  rawHandle: Handle;
};

type FamilyExecution = Record<"י" | "ו" | "נ" | "ן" | "ז", Execution>;

function findFreshNodeId(currentIds: Iterable<string>, baselineIds: Set<string>): string {
  const freshIds = Array.from(currentIds)
    .filter((id) => !baselineIds.has(id))
    .sort();
  expect(freshIds).toHaveLength(1);
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
  expect(rawHandle).toBeDefined();
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
    rawHandle: rawHandle as Handle
  };
}

function executeFamily(): FamilyExecution {
  return {
    י: executeUnary(yodOp),
    ו: executeUnary(vavOp),
    נ: executeUnary(nunOp),
    ן: executeUnary(finalNunOp),
    ז: executeUnary(zayinOp)
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

describe("continuation family sealed-handle fields", () => {
  it("י and ו have identical cont-only handle core fields", () => {
    const family = executeFamily();
    const yodHandle = snapshotHandle(family["י"].rawHandle, [
      "pinOf",
      "selectable_pin",
      "handle_label"
    ]);
    const vavHandle = snapshotHandle(family["ו"].rawHandle);

    expect(family["י"].rawHandle.meta.pinOf).toBe(family["י"].focusBefore);
    expect(family["י"].rawHandle.meta.selectable_pin).toBe(1);
    expect(family["י"].rawHandle.meta.handle_label).toBe("pin");
    expect(family["ו"].rawHandle.meta.pinOf).toBeUndefined();
    expect(family["ו"].rawHandle.meta.selectable_pin).toBeUndefined();
    expect(family["ו"].rawHandle.meta.handle_label).toBeUndefined();

    expect(yodHandle).toEqual(vavHandle);
    expect(yodHandle.edge_mode).toBe("free");
    expect(yodHandle.policy).toBe("soft");
  });

  it("ז and ן have identical sealed-handle core fields", () => {
    const family = executeFamily();
    const zayinHandle = snapshotHandle(family["ז"].rawHandle, ["portOf", "handle_label"]);
    const finalNunHandle = snapshotHandle(family["ן"].rawHandle);

    expect(family["ז"].rawHandle.meta.portOf).toBe(family["ז"].focusBefore);
    expect(family["ז"].rawHandle.meta.handle_label).toBe("resolved_port");
    expect(family["ן"].rawHandle.meta.portOf).toBeUndefined();
    expect(family["ן"].rawHandle.meta.handle_label).toBeUndefined();

    expect(zayinHandle).toEqual(finalNunHandle);
    expect(zayinHandle.edge_mode).toBe("committed");
    expect(zayinHandle.policy).toBe("soft");
    expect(zayinHandle.envelope).toEqual({
      ctx_flow: "LOW",
      x_flow: "EXPLICIT_ONLY",
      data_flow: "SNAPSHOT",
      edit_flow: "TIGHT",
      ports: [],
      coupling: "CopyNoBacklink",
      policy: "soft"
    });
  });

  it("ו and נ keep the same unsealed handle field shape", () => {
    const family = executeFamily();
    const vavHandle = snapshotHandle(family["ו"].rawHandle);
    const nunHandle = snapshotHandle(family["נ"].rawHandle, ["succOf"]);

    expect(family["נ"].rawHandle.meta.succOf).toBe(family["נ"].focusBefore);
    expect(family["ו"].rawHandle.meta.succOf).toBeUndefined();

    expect(vavHandle).toEqual(nunHandle);
    expect(vavHandle.edge_mode).toBe("free");
    expect(vavHandle.policy).toBe("soft");
    expect(vavHandle.envelope).toEqual({
      ctx_flow: "LOW",
      x_flow: "IMPLICIT_OK",
      data_flow: "LIVE",
      edit_flow: "OPEN",
      ports: [],
      coupling: "LINK",
      policy: "soft"
    });
  });

  it("the entire continuation family splits cleanly into cont-only, carry, and resolved tiers", () => {
    const family = executeFamily();
    const pinTier = snapshotHandle(family["י"].rawHandle, [
      "pinOf",
      "selectable_pin",
      "handle_label"
    ]);
    const unsealedTier = snapshotHandle(family["ו"].rawHandle);
    const carryTier = snapshotHandle(family["נ"].rawHandle, ["succOf"]);
    const resolvedTier = snapshotHandle(family["ן"].rawHandle);
    const exportTier = snapshotHandle(family["ז"].rawHandle, ["portOf", "handle_label"]);

    expect(pinTier).toEqual(unsealedTier);
    expect(unsealedTier).toEqual(carryTier);
    expect(resolvedTier).toEqual(exportTier);
    expect(unsealedTier).not.toEqual(resolvedTier);

    expect(family["י"].operatorKDelta).toEqual([]);
    expect(family["ו"].operatorKDelta).toEqual([]);
    expect(family["נ"].operatorKDelta).toEqual([]);
    expect(family["ן"].operatorKDelta).toEqual([]);
    expect(family["ז"].operatorKDelta).toEqual([family["ז"].nodeId]);

    expect(family["י"].focusAfter).toBe(family["י"].focusBefore);
    expect(family["ו"].focusAfter).toBe(family["ו"].nodeId);
    expect(family["נ"].focusAfter).toBe(family["נ"].nodeId);
    expect(family["ן"].focusAfter).toBe(family["ן"].nodeId);
    expect(family["ז"].focusAfter).toBe(family["ז"].focusBefore);

    expect(family["י"].finalKDelta).toEqual([family["י"].nodeId]);
    expect(family["ו"].finalKDelta).toEqual([family["ו"].nodeId]);
    expect(family["נ"].finalKDelta).toEqual([family["נ"].nodeId]);
    expect(family["ן"].finalKDelta).toEqual([family["ן"].nodeId]);
    expect(family["ז"].finalKDelta).toEqual([family["ז"].nodeId, family["ז"].nodeId]);
  });
});
