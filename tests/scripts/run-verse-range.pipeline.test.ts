import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RUN_VERSE_RANGE_SCRIPT = path.resolve(process.cwd(), "scripts", "run-verse-range.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("run verse range pipeline", () => {
  it("executes verses in order and writes summary with carry continuity", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-verse-range-pipeline-"));
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

    const output = runNode([
      RUN_VERSE_RANGE_SCRIPT,
      `--input=${inputPath}`,
      `--out-dir=${outDir}`,
      "--from=Genesis/1/1",
      "--to=Genesis/1/3",
      "--mode=carry_omega_focus"
    ]);
    expect(output).toContain("run-verse-range: verses=3 mode=carry_omega_focus");

    const summaryPath = path.join(outDir, "summary.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));

    expect(summary.mode).toBe("carry_omega_focus");
    expect(summary.versesSelected).toBe(3);
    expect(summary.verses).toHaveLength(3);
    expect(summary.continuity.mismatches.omega).toHaveLength(0);
    expect(summary.continuity.mismatches.focus).toHaveLength(0);

    const refs = summary.verses.map((row: { ref_key: string }) => row.ref_key);
    expect(refs).toEqual(["Genesis/1/1", "Genesis/1/2", "Genesis/1/3"]);
  });
});
