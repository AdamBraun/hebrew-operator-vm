import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "normalize-torah.mjs");

function writeFixtureJson(
  outPath: string,
  verses: Array<{ n: number; he: string }> = [
    { n: 1, he: "<big>בְּ</big>רֵאשִׁ֖ית" },
    { n: 2, he: "וְהָאָֽרֶץ" }
  ]
): void {
  const fixture = {
    books: [
      {
        name: "Genesis",
        chapters: [
          {
            n: 1,
            verses
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

  it("writes deterministic keep-teamim artifacts and verifies with --keep-teamim", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "normalize-torah-test-"));
    const input = path.join(tmpDir, "torah.json");
    const out = path.join(tmpDir, "torah.normalized.teamim.txt");
    const sha = path.join(tmpDir, "torah.normalized.teamim.sha256");
    const report = path.join(tmpDir, "normalization_teamim_report.md");

    writeFixtureJson(input);

    const runArgs = [
      SCRIPT,
      "--keep-teamim",
      `--input=${input}`,
      `--out=${out}`,
      `--sha-out=${sha}`,
      `--report-out=${report}`
    ];

    const firstRun = runNode(runArgs);
    expect(firstRun).toContain("teAmimPolicy=keep");
    const firstOut = fs.readFileSync(out, "utf8");
    const firstSha = fs.readFileSync(sha, "utf8");

    const secondRun = runNode(runArgs);
    expect(secondRun).toContain("teAmimPolicy=keep");
    expect(fs.readFileSync(out, "utf8")).toBe(firstOut);
    expect(fs.readFileSync(sha, "utf8")).toBe(firstSha);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      "--keep-teamim",
      `--input=${input}`,
      `--out=${out}`,
      `--sha-out=${sha}`
    ]);
    expect(verifyOut).toContain("verify: ok");
    expect(verifyOut).toContain("teAmimPolicy=keep");

    const reportText = fs.readFileSync(report, "utf8");
    expect(reportText).toContain("## Teamim Codepoints Observed");
    expect(reportText).toContain("## Policy Transformations Applied");
  });

  it("fails fast with codepoint and context for unsupported combining marks", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "normalize-torah-test-"));
    const input = path.join(tmpDir, "torah.json");
    const out = path.join(tmpDir, "torah.normalized.txt");
    const sha = path.join(tmpDir, "torah.normalized.sha256");
    const report = path.join(tmpDir, "normalization_report.md");

    writeFixtureJson(input, [{ n: 1, he: "אָ\u0301רֶץ" }]);

    expect(() =>
      runNode([
        SCRIPT,
        `--input=${input}`,
        `--out=${out}`,
        `--sha-out=${sha}`,
        `--report-out=${report}`
      ])
    ).toThrow(/Unsupported combining mark U\+0301[\s\S]*Context:/);
  });
});
