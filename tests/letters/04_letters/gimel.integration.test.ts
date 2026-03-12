import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type SnapshotHandle = {
  id: string;
  kind: string;
  meta?: Record<string, any>;
};

type TokenExitSnapshot = {
  vm?: {
    F?: string;
  };
  handles?: SnapshotHandle[];
  cont?: string[];
  carry?: string[];
  supp?: string[];
  head_of?: string[];
  sub?: string[];
  links?: Array<{ label: string }>;
  boundaries?: unknown[];
  rules?: unknown[];
};

function gimelTokenExitSnapshot(): TokenExitSnapshot {
  const execution = runProgramWithDeepTrace("ג", createInitialState(), {
    includeStateSnapshots: true
  });
  const gimelEntry = execution.deepTrace.find((entry) => entry.token_raw === "ג");
  const snapshot = gimelEntry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot;
  if (!snapshot) {
    throw new Error("Missing token_exit snapshot for ג");
  }
  return snapshot as TokenExitSnapshot;
}

function baselineId(snapshot: TokenExitSnapshot): string {
  const baseline = snapshot.handles?.find(
    (handle) => handle.meta?.construct_role === "baseline"
  )?.id;
  if (!baseline) {
    throw new Error("Missing word baseline handle");
  }
  return baseline;
}

describe("gimel parser/executor integration", () => {
  it("runs through the public word pipeline and emits the shoulder topology for a one-letter word", () => {
    expect(() => gimelTokenExitSnapshot()).not.toThrow();

    const snapshot = gimelTokenExitSnapshot();
    const F0 = baselineId(snapshot);
    const gimelHandles = (snapshot.handles ?? [])
      .map((handle) => handle.id)
      .filter((id) => id.startsWith("ג:"))
      .sort((left, right) => left.localeCompare(right));
    const [M, F1] = gimelHandles;

    expect(gimelHandles).toHaveLength(2);
    expect(snapshot.cont ?? []).toEqual([`${F0}->${M}`, `${M}->${F1}`]);
    expect(snapshot.carry ?? []).toEqual([`${F0}->${M}`]);
    expect(snapshot.supp ?? []).toEqual([]);
    expect(snapshot.vm?.F).toBe(F1);
    expect(snapshot.carry ?? []).not.toContain(`${F0}->${F1}`);
    expect(snapshot.head_of ?? []).toEqual([]);
    expect(snapshot.sub ?? []).toEqual([]);
    expect(snapshot.links ?? []).toEqual([]);
    expect(snapshot.boundaries ?? []).toEqual([]);
    expect(snapshot.rules ?? []).toEqual([]);
    expect((snapshot.handles ?? []).filter((handle) => handle.kind === "structured")).toEqual([]);
    expect(
      (snapshot.handles ?? []).filter(
        (handle) => handle.id !== F0 && handle.id !== "Ω" && handle.id !== "⊥"
      )
    ).toHaveLength(2);
  });
});
