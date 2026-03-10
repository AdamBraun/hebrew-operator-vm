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

function traceFinalHe(word: string): { selectArgs: string[]; headOf: string[] } {
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

  return {
    selectArgs: Array.isArray(selectArgs) ? selectArgs.map(String) : [],
    headOf: Array.isArray(snapshot?.head_of) ? snapshot.head_of.map(String) : []
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
});
