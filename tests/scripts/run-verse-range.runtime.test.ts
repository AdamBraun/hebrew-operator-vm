import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, runVerseRange } from "@ref/scripts/runVerseRange/runtime";

describe("run verse range runtime", () => {
  it("parses args and validates supported mode values", () => {
    const parsed = parseArgs([
      "--input=/tmp/in.json",
      "--out-dir=/tmp/out",
      "--from=Genesis/1/1",
      "--to=Genesis/1/3",
      "--mode=carry_omega_focus",
      "--allow-runtime-errors"
    ]);

    expect(parsed).toMatchObject({
      input: "/tmp/in.json",
      outDir: "/tmp/out",
      from: "Genesis/1/1",
      to: "Genesis/1/3",
      mode: "carry_omega_focus",
      allowRuntimeErrors: true
    });

    expect(() => parseArgs(["--from=Genesis/1/1", "--to=Genesis/1/3", "--mode=bad_mode"])).toThrow(
      /Invalid --mode value: bad_mode. Expected one of: reset, carry_omega, carry_omega_focus, carry_omega_focus_domain/
    );
  });

  it("runs an inclusive verse range and writes carry continuity summary", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-verse-range-runtime-"));
    const inputPath = path.join(tmpDir, "torah.json");
    const outDir = path.join(tmpDir, "outputs", "continual-run");

    const fixture = {
      books: [
        {
          name: "Genesis",
          chapters: [
            {
              n: 1,
              verses: [
                { n: 1, he: "א" },
                { n: 2, he: "א" },
                { n: 3, he: "א" }
              ]
            }
          ]
        }
      ]
    };
    fs.writeFileSync(inputPath, JSON.stringify(fixture, null, 2), "utf8");

    const summary = await runVerseRange({
      input: inputPath,
      outDir,
      from: "Genesis/1/1",
      to: "Genesis/1/3",
      mode: "carry_omega_focus",
      lang: "he",
      normalizeFinals: false,
      keepTeamim: false,
      allowRuntimeErrors: false
    });

    expect(summary.mode).toBe("carry_omega_focus");
    expect(summary.versesSelected).toBe(3);
    expect(summary.verses).toHaveLength(3);
    expect(summary.continuity.expectedTransitions).toBe(2);
    expect(summary.continuity.mismatches.omega).toHaveLength(0);
    expect(summary.continuity.mismatches.focus).toHaveLength(0);
    expect(summary.continuity.mismatches.domain).toHaveLength(0);
    expect(summary.sanity.nonIncreasingHandleCount).toBe(true);

    const [verse1, verse2, verse3] = summary.verses;
    expect(verse2?.carryIn.omega).toBe(verse1?.carryOut.omega);
    expect(verse2?.carryIn.focus).toBe(verse1?.carryOut.focus);
    expect(verse3?.carryIn.omega).toBe(verse2?.carryOut.omega);
    expect(verse3?.carryIn.focus).toBe(verse2?.carryOut.focus);

    for (const row of summary.verses) {
      expect(fs.existsSync(path.resolve(row.outputPath))).toBe(true);
    }

    const summaryPath = path.join(outDir, "summary.json");
    expect(fs.existsSync(summaryPath)).toBe(true);
    const summaryOnDisk = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    expect(summaryOnDisk.verses).toHaveLength(3);
  });
});
