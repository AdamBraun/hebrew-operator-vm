import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "teamim-registry.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("teamim registry pipeline", () => {
  it("writes deterministic artifacts and verify gate passes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "teamim-registry-test-"));
    const input = path.join(tmpDir, "torah.normalized.teamim.txt");
    const classification = path.join(tmpDir, "teamim.classification.json");
    const registryOut = path.join(tmpDir, "teamim.registry.json");
    const reportOut = path.join(tmpDir, "teamim_registry_report.md");

    const fixture = ["Genesis 1:1\tא֖ ב֣", "Genesis 1:2\tג֤ ד֪", ""].join("\n");
    fs.writeFileSync(input, fixture, "utf8");
    fs.writeFileSync(
      classification,
      `${JSON.stringify(
        {
          schema_version: 1,
          entries: {
            "U+0596": {
              codepoint: "U+0596",
              unicode_name: "HEBREW ACCENT TIPEHA",
              hebrew_name: "tipcha",
              class: "DISJUNCTIVE",
              precedence: 100
            },
            "U+05A3": {
              codepoint: "U+05A3",
              unicode_name: "HEBREW ACCENT MUNAH",
              hebrew_name: "munach",
              class: "CONJUNCTIVE",
              precedence: 100
            },
            "U+05A4": {
              codepoint: "U+05A4",
              unicode_name: "HEBREW ACCENT MAHAPAKH",
              hebrew_name: "mahpakh",
              class: "CONJUNCTIVE",
              precedence: 100
            },
            "U+05AA": {
              codepoint: "U+05AA",
              unicode_name: "HEBREW ACCENT YERAH BEN YOMO",
              hebrew_name: "yerah_ben_yomo",
              class: "OTHER",
              precedence: 0
            }
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const runOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--classification=${classification}`,
      `--registry-out=${registryOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(runOut).toContain("done:");

    const firstRegistry = fs.readFileSync(registryOut, "utf8");
    const firstReport = fs.readFileSync(reportOut, "utf8");

    const rerunOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--classification=${classification}`,
      `--registry-out=${registryOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(rerunOut).toContain("done:");
    expect(fs.readFileSync(registryOut, "utf8")).toBe(firstRegistry);
    expect(fs.readFileSync(reportOut, "utf8")).toBe(firstReport);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--input=${input}`,
      `--classification=${classification}`,
      `--registry-out=${registryOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(verifyOut).toContain("verify: ok");
  });
});
