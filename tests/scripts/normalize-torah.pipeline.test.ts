import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "normalize-torah.mjs");

function writeFixtureJson(outPath: string): void {
  const fixture = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses: [
              { n: 1, he: "<big>בְּ</big>רֵאשִׁ֖ית" },
              { n: 2, he: "וְהָאָֽרֶץ" }
            ]
          }
        ]
      }
    ]
  };

  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2), "utf8");
}

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("normalize-torah pipeline", () => {
  it("writes artifacts and verify gate passes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "normalize-torah-test-"));
    const input = path.join(tmpDir, "torah.json");
    const out = path.join(tmpDir, "torah.normalized.txt");
    const sha = path.join(tmpDir, "torah.normalized.sha256");
    const report = path.join(tmpDir, "normalization_report.md");

    writeFixtureJson(input);

    const runOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--out=${out}`,
      `--sha-out=${sha}`,
      `--report-out=${report}`
    ]);
    expect(runOut).toContain("sourceIdempotenceFailures=0");
    expect(runOut).toContain("outputIdempotenceFailures=0");

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--input=${input}`,
      `--out=${out}`,
      `--sha-out=${sha}`
    ]);
    expect(verifyOut).toContain("verify: ok");

    const reportText = fs.readFileSync(report, "utf8");
    expect(reportText).toContain("source idempotence failures: 0");
    expect(reportText).toContain("output idempotence failures: 0");
  });

  it("fails verify when checksum file is tampered", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "normalize-torah-test-"));
    const input = path.join(tmpDir, "torah.json");
    const out = path.join(tmpDir, "torah.normalized.txt");
    const sha = path.join(tmpDir, "torah.normalized.sha256");
    const report = path.join(tmpDir, "normalization_report.md");

    writeFixtureJson(input);

    runNode([
      SCRIPT,
      `--input=${input}`,
      `--out=${out}`,
      `--sha-out=${sha}`,
      `--report-out=${report}`
    ]);

    fs.writeFileSync(sha, `${"0".repeat(64)}\n`, "utf8");

    expect(() =>
      runNode([SCRIPT, "verify", `--input=${input}`, `--out=${out}`, `--sha-out=${sha}`])
    ).toThrow(/verify failed/);
  });
});
