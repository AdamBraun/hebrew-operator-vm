import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(process.cwd(), "scripts", "compile-token-operators.mjs");
const DEFINITIONS = path.resolve(process.cwd(), "registry", "token-semantics.json");

function runNode(args: string[]): string {
  return execFileSync("node", args, { encoding: "utf8" });
}

describe("token compile pipeline", () => {
  it("compiles deterministic token bundles and verify passes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "token-compile-test-"));
    const registryPath = path.join(tmpDir, "tokens.registry.json");
    const outPath = path.join(tmpDir, "tokens.compiled.json");
    const reportPath = path.join(tmpDir, "compile_report.md");

    const fixture = {
      input: {
        path: registryPath,
        sha256: "fixture-sha"
      },
      tokens: {
        "1": {
          token_id: 1,
          base: "א",
          marks: [],
          signature: "BASE=א|MARKS=NONE",
          count: 10
        },
        "2": {
          token_id: 2,
          base: "ה",
          marks: ["U+05BC"],
          signature: "BASE=ה|MARKS=U+05BC",
          count: 3
        },
        "3": {
          token_id: 3,
          base: "ו",
          marks: ["U+05BC"],
          signature: "BASE=ו|MARKS=U+05BC",
          count: 4
        },
        "4": {
          token_id: 4,
          base: "ש",
          marks: ["U+05C2"],
          signature: "BASE=ש|MARKS=U+05C2",
          count: 5
        },
        "5": {
          token_id: 5,
          base: "ב",
          marks: ["U+05B2"],
          signature: "BASE=ב|MARKS=U+05B2",
          count: 2
        }
      }
    };

    fs.writeFileSync(registryPath, JSON.stringify(fixture, null, 2), "utf8");

    const runOut = runNode([
      SCRIPT,
      `--registry=${registryPath}`,
      `--out=${outPath}`,
      `--report=${reportPath}`,
      `--defs=${DEFINITIONS}`
    ]);
    expect(runOut).toContain("done:");

    const compiledText = fs.readFileSync(outPath, "utf8");
    const compiled = JSON.parse(compiledText);

    expect(compiled.semantics.semver).toBe("1.0.0");
    expect(compiled.tokens["2"].derived.toch).toContain("MAPIQ");
    expect(compiled.tokens["2"].derived.modes).toContain("HEH_PINNED");
    expect(compiled.tokens["3"].derived.toch).toContain("SHURUK");
    expect(compiled.tokens["3"].derived.modes).toContain("VAV_SEEDED");
    expect(compiled.tokens["4"].op_family).toBe("SIN_COMPOSITE");
    expect(compiled.tokens["4"].runtime.read_letter).toBe("ס");
    expect(compiled.tokens["5"].runtime.sof_modifiers).toEqual([
      {
        kind: "shva",
        mark: "U+05B2",
        modifier: "SHVA",
        hataf: true
      },
      {
        kind: "patach",
        mark: "U+05B2",
        modifier: "PATACH",
        hataf: true
      }
    ]);

    const rerunOut = runNode([
      SCRIPT,
      `--registry=${registryPath}`,
      `--out=${outPath}`,
      `--report=${reportPath}`,
      `--defs=${DEFINITIONS}`
    ]);
    expect(rerunOut).toContain("done:");
    expect(fs.readFileSync(outPath, "utf8")).toBe(compiledText);

    const verifyOut = runNode([
      SCRIPT,
      "verify",
      `--registry=${registryPath}`,
      `--out=${outPath}`,
      `--report=${reportPath}`,
      `--defs=${DEFINITIONS}`
    ]);
    expect(verifyOut).toContain("verify: ok");
  });

  it("fails loudly for illegal host/modifier combinations", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "token-compile-test-"));
    const registryPath = path.join(tmpDir, "tokens.registry.json");
    const outPath = path.join(tmpDir, "tokens.compiled.json");
    const reportPath = path.join(tmpDir, "compile_report.md");

    const fixture = {
      input: {
        path: registryPath,
        sha256: "fixture-sha"
      },
      tokens: {
        "1": {
          token_id: 1,
          base: "א",
          marks: ["U+05C1"],
          signature: "BASE=א|MARKS=U+05C1",
          count: 1
        }
      }
    };
    fs.writeFileSync(registryPath, JSON.stringify(fixture, null, 2), "utf8");

    expect(() =>
      runNode([
        SCRIPT,
        `--registry=${registryPath}`,
        `--out=${outPath}`,
        `--report=${reportPath}`,
        `--defs=${DEFINITIONS}`
      ])
    ).toThrow(/ILLEGAL_SHIN_DOT_HOST/);
  });
});
