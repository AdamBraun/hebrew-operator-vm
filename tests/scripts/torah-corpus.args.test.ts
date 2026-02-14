import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIFF_REPORT_OUT,
  DEFAULT_GOLDENS_OUT,
  DEFAULT_REGRESSION_REPORT_OUT,
  parseCommonRunArgs,
  parseDiffArgs,
  parseExecuteArgs,
  parseRegressArgs
} from "@ref/scripts/torahCorpus/args";

describe("torah corpus args parser", () => {
  it("parses common run flags with defaults and toggles", () => {
    const parsed = parseCommonRunArgs([
      "--lang=both",
      "--input",
      "/tmp/in.json",
      "--out-dir",
      "/tmp/out",
      "--normalize-finals",
      "--keep-teamim",
      "--allow-runtime-errors"
    ]);
    expect(parsed).toEqual({
      input: "/tmp/in.json",
      outDir: "/tmp/out",
      lang: "both",
      normalizeFinals: true,
      keepTeamim: true,
      allowRuntimeErrors: true
    });
  });

  it("parses execute mode with WINDOW(N) shorthand", () => {
    const parsed = parseExecuteArgs(["--mode=WINDOW(6)", "--window-size=99"]);
    expect(parsed.mode).toBe("WINDOW");
    expect(parsed.modeLabel).toBe("WINDOW(6)");
    expect(parsed.windowSize).toBe(6);
  });

  it("rejects invalid safety-rail threshold", () => {
    expect(() => parseExecuteArgs(["--safety-rail-threshold=2"])).toThrow(
      /Invalid --safety-rail-threshold/
    );
  });

  it("requires diff args", () => {
    expect(() => parseDiffArgs(["--prev=/tmp/a"])).toThrow(/diff requires --prev and --next/);
  });

  it("parses regress args with defaults", () => {
    const parsed = parseRegressArgs(["--run-a=/tmp/a.jsonl", "--run-b=/tmp/b.jsonl"]);
    expect(parsed).toEqual({
      runA: "/tmp/a.jsonl",
      runB: "/tmp/b.jsonl",
      diffOut: DEFAULT_DIFF_REPORT_OUT,
      goldens: DEFAULT_GOLDENS_OUT,
      regressionOut: DEFAULT_REGRESSION_REPORT_OUT,
      compiledA: "",
      compiledB: "",
      updateGoldens: false,
      goldenLimit: 60
    });
  });
});
