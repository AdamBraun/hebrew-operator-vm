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
  it("keeps only nun/resh on the carry axis while final nun/dalet/kaf stay direct-supported", () => {
    const matrix = {
      נ: inspectResolution("קנ", "נ"),
      ן: inspectResolution("קן", "ן"),
      ר: inspectResolution("קר", "ר"),
      ד: inspectResolution("קד", "ד"),
      כ: inspectResolution("נכ", "כ")
    };

    expect(
      new Set([matrix["נ"].operand, matrix["ן"].operand, matrix["ר"].operand, matrix["ד"].operand])
    ).toEqual(new Set(["ק:1:1"]));
    expect(matrix["כ"].operand).toBe("נ:1:1");

    expect(matrix["נ"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ן"]).toMatchObject({ carry: false, supp: true });
    expect(matrix["ר"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ד"]).toMatchObject({ carry: false, supp: true });
    expect(matrix["כ"]).toMatchObject({ carry: false, supp: true });

    expect(matrix["נ"].carry && matrix["ר"].carry).toBe(true);
    expect(matrix["ן"].carry).toBe(false);
    expect(matrix["ד"].carry).toBe(false);
    expect(matrix["כ"].carry).toBe(false);
    expect(matrix["ן"].supp && matrix["ד"].supp && matrix["כ"].supp).toBe(true);
    expect(matrix["נ"].supp || matrix["ר"].supp).toBe(false);
  });

  it("keeps the resolved head side direct-backed across the detached-leg pair", () => {
    const matrix = {
      ק: inspectResolution("רק", "ק"),
      ה: inspectResolution("רה", "ה")
    };

    expect(new Set(Object.values(matrix).map((shape) => shape.operand))).toEqual(
      new Set(["ר:1:1"])
    );

    expect(matrix["ק"]).toMatchObject({ carry: true, supp: false });
    expect(matrix["ה"]).toMatchObject({ carry: false, supp: true });
  });
});
