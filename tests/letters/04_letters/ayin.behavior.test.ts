import { describe, expect, it } from "vitest";
import { createInitialState } from "@ref/state/state";
import { runProgramWithDeepTrace } from "@ref/vm/vm";

describe("ayin behavior", () => {
  it("exports an origin alias to K while advancing focus to the continuation successor", () => {
    const { deepTrace } = runProgramWithDeepTrace("ע", createInitialState(), {
      includeStateSnapshots: true
    });
    const ayinEntry = deepTrace.find((entry) => entry.token_raw === "ע");
    const ayinExitSnapshot = ayinEntry?.phases.find((phase) => phase.phase === "token_exit")
      ?.snapshot as
      | {
          vm?: { K?: string[]; F?: string; W?: string[] };
          handles?: Array<{
            id: string;
            kind: string;
            meta?: Record<string, any>;
          }>;
          cont?: string[];
          carry?: string[];
          supp?: string[];
        }
      | undefined;
    const exportHandle = ayinExitSnapshot?.handles?.find(
      (handle) => handle.meta?.export_origin === true
    );
    const exportHandleId = String(exportHandle?.id ?? "");
    const origin = String(exportHandle?.meta?.target ?? "");
    const child = ayinExitSnapshot?.handles?.find((handle) => handle.meta?.succOf === origin)?.id;

    expect(exportHandle?.kind).toBe("alias");
    expect(origin.length).toBeGreaterThan(0);
    expect(child).toBeDefined();
    expect(ayinExitSnapshot?.cont ?? []).toContain(`${origin}->${child}`);
    expect(ayinExitSnapshot?.carry ?? []).toContain(`${origin}->${child}`);
    expect(ayinExitSnapshot?.supp ?? []).not.toContain(`${child}->${origin}`);
    expect(ayinExitSnapshot?.vm?.K?.includes(exportHandleId)).toBe(true);
    expect(ayinExitSnapshot?.vm?.F).toBe(child);
    expect(ayinExitSnapshot?.vm?.W ?? []).toEqual([]);
  });
});
