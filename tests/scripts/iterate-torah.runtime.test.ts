import { describe, expect, it } from "vitest";
import {
  iteratePayload,
  parseArgs,
  sanitizeText,
  type IterateTorahOptions
} from "@ref/scripts/iterateTorah/runtime";

const DEFAULT_OPTS: IterateTorahOptions = {
  input: "/tmp/torah.json",
  lang: "he",
  normalizeFinals: false,
  keepTeamim: false,
  allowRuntimeErrors: false
};

describe("iterate torah runtime", () => {
  it("parses args and validates lang", () => {
    const parsed = parseArgs([
      "--input=/tmp/in.json",
      "--lang=both",
      "--normalize-finals",
      "--keep-teamim",
      "--allow-runtime-errors"
    ]);
    expect(parsed).toEqual({
      input: "/tmp/in.json",
      lang: "both",
      normalizeFinals: true,
      keepTeamim: true,
      allowRuntimeErrors: true
    });

    expect(() => parseArgs(["--lang=bad"])).toThrow("Invalid --lang value: bad");
  });

  it("sanitizes markup and optional final-form normalization", () => {
    const raw = "<b>מָ</b>־לֶךְ׃";
    const keepFinals = sanitizeText(raw, { ...DEFAULT_OPTS, normalizeFinals: false });
    const normalizeFinals = sanitizeText(raw, { ...DEFAULT_OPTS, normalizeFinals: true });
    const keepTeamim = sanitizeText(raw, { ...DEFAULT_OPTS, keepTeamim: true });

    expect(keepFinals).toBe("מָ לֶךְ");
    expect(normalizeFinals).toBe("מָ לֶכְ");
    expect(keepTeamim).toBe("מָ־לֶךְ׃");
  });

  it("removes inline formatting markup without splitting a Hebrew word", () => {
    const raw = '<big>בְּ</big>רֵאשִׁ֖ית&nbsp;<span class="mam-spi-pe">{פ}</span><br>';
    const stripped = sanitizeText(raw, { ...DEFAULT_OPTS });
    const kept = sanitizeText(raw, { ...DEFAULT_OPTS, keepTeamim: true });

    expect(stripped).toBe("בְּרֵאשִׁית");
    expect(kept).toBe("בְּרֵאשִׁ֖ית");
    expect(kept).not.toContain("בְּ רֵאשִׁ֖ית");
  });

  it("iterates payload and tracks summary counts", () => {
    const inputs: string[] = [];
    const summary = iteratePayload(
      {
        books: [
          {
            chapters: [
              {
                verses: [{ he: "א׃" }, { he: "" }, { he: "ב" }]
              }
            ]
          }
        ]
      },
      DEFAULT_OPTS,
      {
        runProgram: (source: string) => {
          inputs.push(source);
        },
        createInitialState: () => ({})
      }
    );

    expect(inputs).toEqual(["א", "ב"]);
    expect(summary).toEqual({
      total: 3,
      skipped: 1,
      sanitized: 1,
      runtimeErrors: 0
    });
  });

  it("counts RuntimeError when allowed", () => {
    const summary = iteratePayload(
      {
        books: [
          {
            chapters: [{ verses: [{ he: "א" }, { he: "ב" }] }]
          }
        ]
      },
      { ...DEFAULT_OPTS, allowRuntimeErrors: true },
      {
        runProgram: (source: string) => {
          if (source === "ב") {
            throw { name: "RuntimeError" };
          }
        },
        createInitialState: () => ({})
      }
    );

    expect(summary.runtimeErrors).toBe(1);
    expect(summary.total).toBe(2);
  });

  it("rethrows non-runtime errors even when allowRuntimeErrors is true", () => {
    expect(() =>
      iteratePayload(
        {
          books: [
            {
              chapters: [{ verses: [{ he: "א" }] }]
            }
          ]
        },
        { ...DEFAULT_OPTS, allowRuntimeErrors: true },
        {
          runProgram: () => {
            throw new Error("boom");
          },
          createInitialState: () => ({})
        }
      )
    ).toThrow("boom");
  });
});
