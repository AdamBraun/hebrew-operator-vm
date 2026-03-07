import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

type EdgeSnapshot = {
  vm?: { F?: string };
  carry?: string[];
  supp?: string[];
};

type ResolutionShape = {
  operand: string;
  focus: string;
  carry: boolean;
  supp: boolean;
};

function inspectResolution(word: string, token: string): ResolutionShape {
  const result = runProgramWithDeepTrace(word, createInitialState(), {
    includeStateSnapshots: true
  });
  const entry = result.deepTrace.find((row) => row.token === token);
  const selectArgs =
    entry?.phases.find((phase) => phase.phase === "select")?.detail?.select_operands?.args ?? [];
  const snapshot = (entry?.phases.find((phase) => phase.phase === "token_exit")?.snapshot ??
    {}) as EdgeSnapshot;
  const operand = String(Array.isArray(selectArgs) ? (selectArgs[0] ?? "") : "");
  const focus = String(snapshot.vm?.F ?? "");
  const carry = (snapshot.carry ?? []).includes(`${operand}->${focus}`);
  const supp = (snapshot.supp ?? []).includes(`${focus}->${operand}`);

  return { operand, focus, carry, supp };
}

describe("resolved/unresolved symmetry across nun/final-nun and resh/dalet", () => {
  it("uses the same carry-plus-supp mechanism in both pairs", () => {
    const matrix = {
      נ: inspectResolution("קנ", "נ"),
      ן: inspectResolution("קן", "ן"),
      ר: inspectResolution("קר", "ר"),
      ד: inspectResolution("קד", "ד")
    };

    expect(new Set(Object.values(matrix).map((shape) => shape.operand))).toEqual(
      new Set(["ק:1:1"])
    );

    expect(matrix["נ"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ן"]).toMatchObject({ carry: true, supp: true });
    expect(matrix["ר"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ד"]).toMatchObject({ carry: true, supp: true });

    expect(matrix["נ"].carry && matrix["ן"].carry && matrix["ר"].carry && matrix["ד"].carry).toBe(
      true
    );
    expect(matrix["ן"].supp && matrix["ד"].supp).toBe(true);
    expect(matrix["נ"].supp || matrix["ר"].supp).toBe(false);
  });

  it("uses the same carry-plus-supp distinction in the detached-leg pair", () => {
    const matrix = {
      ק: inspectResolution("רק", "ק"),
      ה: inspectResolution("רה", "ה")
    };

    expect(new Set(Object.values(matrix).map((shape) => shape.operand))).toEqual(
      new Set(["ר:1:1"])
    );

    expect(matrix["ק"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ה"]).toMatchObject({ carry: true, supp: true });
  });
});
