import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "extract-token-registry.mjs");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("token registry extraction pipeline", () => {
  it("writes deterministic artifacts and verify gate passes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "token-registry-test-"));
    const input = path.join(tmpDir, "torah.normalized.txt");
    const registryOut = path.join(tmpDir, "tokens.registry.json");
    const signaturesOut = path.join(tmpDir, "tokens.signatures.txt");
    const reportOut = path.join(tmpDir, "token_registry_report.md");

    const fixture = [
      "Genesis 1:1\tשִׂיר בָּרָא",
      "Genesis 1:2\tהּ וּ אֳ מָֽיִם׃",
      "Genesis 1:3\tא־ב",
      ""
    ].join("\n");
    fs.writeFileSync(input, fixture, "utf8");

    const runOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--registry-out=${registryOut}`,
      `--signatures-out=${signaturesOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(runOut).toContain("done:");

    const registryText = fs.readFileSync(registryOut, "utf8");
    const signaturesText = fs.readFileSync(signaturesOut, "utf8");
    const registry = JSON.parse(registryText);
    expect(registry.stats.clusters_scanned).toBe(registry.stats.clusters_mapped);
    expect(registry.stats.distinct_signatures).toBeGreaterThan(0);
    expect(signaturesText).toContain("BASE=ש|MARKS=U+05B4,U+05C2");

    const rerunOut = runNode([
      SCRIPT,
      `--input=${input}`,
      `--registry-out=${registryOut}`,
      `--signatures-out=${signaturesOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(rerunOut).toContain("done:");
    expect(fs.readFileSync(registryOut, "utf8")).toBe(registryText);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--input=${input}`,
      `--registry-out=${registryOut}`,
      `--signatures-out=${signaturesOut}`,
      `--report-out=${reportOut}`
    ]);
    expect(verifyOut).toContain("verify: ok");
  });

  it("fails loudly for unsupported combining marks", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "token-registry-test-"));
    const input = path.join(tmpDir, "torah.normalized.txt");
    const registryOut = path.join(tmpDir, "tokens.registry.json");
    const signaturesOut = path.join(tmpDir, "tokens.signatures.txt");
    const reportOut = path.join(tmpDir, "token_registry_report.md");

    fs.writeFileSync(input, `Genesis 1:1\t\u05D0\u0301\n`, "utf8");

    expect(() =>
      runNode([
        SCRIPT,
        `--input=${input}`,
        `--registry-out=${registryOut}`,
        `--signatures-out=${signaturesOut}`,
        `--report-out=${reportOut}`
      ])
    ).toThrow(/Unsupported combining mark U\+0301/);
  });
});
