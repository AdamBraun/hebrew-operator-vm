import { describe, expect, it } from "vitest";

import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
  const before = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    if (before === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = before;
    }
  }
}

function parseEdge(edge: string): [string, string] | null {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    return null;
  }
  const from = edge.slice(0, pivot);
  const to = edge.slice(pivot + 2);
  if (!from || !to) {
    return null;
  }
  return [from, to];
}

function traceFinalHe(word: string): {
  selectArgs: string[];
  headOf: string[];
  cursorTags: string[];
  currentFocusBeforeHe: string;
  exportedHandleId: string | null;
  exportedReferentId: string | null;
} {
  const result = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });
  const heEntries = result.deepTrace.filter((entry) => entry.token === "ה");
  const finalHe = heEntries[heEntries.length - 1];
  if (!finalHe) {
    throw new Error(`Missing final ה in ${word}`);
  }

  const selectArgs =
    finalHe.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ?? [];
  const snapshot = finalHe.phases.find((phase) => phase.phase === "token_exit")?.snapshot as
    | { head_of?: string[] }
    | undefined;
  const traceIndex = result.trace.findIndex(
    (entry) => entry.index === finalHe.index && entry.token === finalHe.token
  );
  const traceEntry = traceIndex >= 0 ? result.trace[traceIndex] : undefined;
  const previousTraceEntry = traceIndex > 0 ? result.trace[traceIndex - 1] : undefined;
  let exportedHandleId: string | null = null;
  let exportedReferentId: string | null = null;
  for (const handle of Array.from(result.state.handles.values()).reverse()) {
    if (handle.meta?.export_origin !== true) {
      continue;
    }
    exportedHandleId = handle.id;
    exportedReferentId =
      typeof handle.meta?.target === "string"
        ? handle.meta.target
        : typeof handle.meta?.referent === "string"
          ? handle.meta.referent
          : null;
    break;
  }

  return {
    selectArgs: Array.isArray(selectArgs) ? selectArgs.map(String) : [],
    headOf: Array.isArray(snapshot?.head_of) ? snapshot.head_of.map(String) : [],
    cursorTags: Array.isArray(traceEntry?.cursor_tags) ? traceEntry.cursor_tags.map(String) : [],
    currentFocusBeforeHe: String(previousTraceEntry?.F ?? ""),
    exportedHandleId,
    exportedReferentId
  };
}

describe("he non-F export experiment", () => {
  it("keeps the current זה accompaniment baseline when the experiment is off", () => {
    const traced = withEnv("HE_CONSUME_NON_F_EXPORTS", undefined, () => traceFinalHe("זה"));
    expect(traced.selectArgs).toEqual(["C:1:1"]);
    expect(traced.headOf).toContain("ה:1:1->C:1:1");
  });

  it("lets ה head the prior ז port in זה when the experiment is on", () => {
    const traced = withEnv("HE_CONSUME_NON_F_EXPORTS", "1", () => traceFinalHe("זה"));
    expect(traced.selectArgs).toEqual(["ז:1:1"]);
    expect(traced.headOf).toContain("ה:1:1->ז:1:1");
  });

  it("lets the final ה in הזה choose the live ז port over current focus when enabled", () => {
    const traced = withEnv("HE_CONSUME_NON_F_EXPORTS", "1", () => traceFinalHe("הזה"));
    expect(traced.selectArgs).toEqual(["ז:1:1"]);
    expect(traced.headOf).toContain("ה:1:3->ז:1:1");
  });

  it("rejects direct exported alias handles as ה head targets in synthetic עוה", () => {
    const traced = withEnv("HE_CONSUME_NON_F_EXPORTS", "1", () => traceFinalHe("עוה"));
    const headTargets = traced.headOf
      .map((edge) => parseEdge(edge)?.[1] ?? null)
      .filter((target): target is string => target !== null);
    const allowedTargets = new Set(
      [traced.currentFocusBeforeHe, traced.exportedReferentId].filter(
        (target): target is string => typeof target === "string" && target.length > 0
      )
    );

    expect(traced.exportedHandleId).toBe("ע:1:2");
    expect(traced.exportedReferentId).toBe("C:1:1");
    expect(traced.currentFocusBeforeHe).toBe("ו:1:1");
    expect(headTargets).not.toContain(traced.exportedHandleId);

    if (headTargets.length > 0) {
      expect(headTargets.every((target) => allowedTargets.has(target))).toBe(true);
    } else {
      expect(traced.cursorTags).toContain("cursor_accompany");
      expect(traced.cursorTags).not.toContain("cursor_consume");
    }
  });
});
