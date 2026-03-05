import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CHECK_SCRIPT = path.resolve(process.cwd(), "scripts", "check-version-contract.cjs");

type VersionValues = {
  trace: string;
  semantics: string;
  render: string;
};

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writeVersionFile(cwd: string, values: VersionValues): void {
  const versionFilePath = path.join(cwd, "src", "reference", "version.ts");
  const source = [
    "export type SemVer = `${number}.${number}.${number}`;",
    "export type TraceVersion = `1.${number}.${number}`;",
    "",
    `export const TRACE_VERSION: TraceVersion = "${values.trace}";`,
    `export const SEMANTICS_VERSION: SemVer = "${values.semantics}";`,
    `export const RENDER_VERSION: SemVer = "${values.render}";`,
    "",
    "export const VERSION_CONTRACT = {",
    "  trace_version: TRACE_VERSION,",
    "  semantics_version: SEMANTICS_VERSION,",
    "  render_version: RENDER_VERSION",
    "} as const;",
    ""
  ].join("\n");
  fs.writeFileSync(versionFilePath, source, "utf8");
}

function initRepo(): { repoDir: string; baseSha: string } {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-contract-ci-test-"));
  fs.mkdirSync(path.join(repoDir, "src", "reference"), { recursive: true });
  fs.mkdirSync(path.join(repoDir, "src", "reference", "scripts", "phraseTree"), {
    recursive: true
  });
  fs.mkdirSync(path.join(repoDir, "registry"), { recursive: true });
  fs.mkdirSync(path.join(repoDir, "spec"), { recursive: true });
  fs.mkdirSync(path.join(repoDir, "render"), { recursive: true });

  writeVersionFile(repoDir, {
    trace: "1.0.0",
    semantics: "1.0.0",
    render: "1.0.0"
  });
  fs.writeFileSync(
    path.join(repoDir, "registry", "token-semantics.json"),
    JSON.stringify({ semver: "1.0.0", rules: ["base"] }, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(repoDir, "registry", "teamim.classification.json"),
    JSON.stringify(
      {
        schema_version: 1,
        entries: {
          "U+0596": {
            codepoint: "U+0596",
            class: "DISJUNCTIVE",
            precedence: 100
          }
        }
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(repoDir, "spec", "70-TRACE-FORMAT.schema.json"),
    JSON.stringify({ title: "trace schema", version: 1 }, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(path.join(repoDir, "render", "rules.md"), "render rules v1\n", "utf8");
  fs.writeFileSync(
    path.join(repoDir, "src", "reference", "scripts", "phraseTree", "runtime.ts"),
    "export const PHRASE_VERSION = 'phrase_tree.v1';\n",
    "utf8"
  );

  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.email", "ci@example.com"]);
  runGit(repoDir, ["config", "user.name", "CI Tester"]);
  runGit(repoDir, ["add", "."]);
  runGit(repoDir, ["commit", "-m", "base"]);

  return {
    repoDir,
    baseSha: runGit(repoDir, ["rev-parse", "HEAD"])
  };
}

function runCheck(
  repoDir: string,
  baseSha: string,
  headSha: string
): { ok: boolean; output: string } {
  try {
    const output = execFileSync(
      "node",
      [CHECK_SCRIPT, "--mode=fail", `--base-sha=${baseSha}`, `--head-sha=${headSha}`],
      { cwd: repoDir, encoding: "utf8" }
    );
    return { ok: true, output };
  } catch (error) {
    const err = error as {
      stdout?: string;
      stderr?: string;
    };
    return {
      ok: false,
      output: `${err.stdout ?? ""}${err.stderr ?? ""}`
    };
  }
}

describe("version contract CI checks", () => {
  it("fails when token semantics change without semantics version bump", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(
      path.join(repoDir, "registry", "token-semantics.json"),
      JSON.stringify({ semver: "1.0.0", rules: ["base", "new-op"] }, null, 2) + "\n",
      "utf8"
    );
    runGit(repoDir, ["add", "registry/token-semantics.json"]);
    runGit(repoDir, ["commit", "-m", "change token semantics"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("semantics_version must bump");
  });

  it("passes when token semantics change and semantics version is bumped", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(
      path.join(repoDir, "registry", "token-semantics.json"),
      JSON.stringify({ semver: "1.0.1", rules: ["base", "new-op"] }, null, 2) + "\n",
      "utf8"
    );
    writeVersionFile(repoDir, {
      trace: "1.0.0",
      semantics: "1.0.1",
      render: "1.0.0"
    });
    runGit(repoDir, ["add", "registry/token-semantics.json", "src/reference/version.ts"]);
    runGit(repoDir, ["commit", "-m", "change token semantics with bump"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("semantics_version bumped");
  });

  it("fails when teamim classification changes without semantics version bump", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(
      path.join(repoDir, "registry", "teamim.classification.json"),
      JSON.stringify(
        {
          schema_version: 1,
          entries: {
            "U+0596": {
              codepoint: "U+0596",
              class: "DISJUNCTIVE",
              precedence: 100
            },
            "U+05A3": {
              codepoint: "U+05A3",
              class: "CONJUNCTIVE",
              precedence: 100
            }
          }
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    runGit(repoDir, ["add", "registry/teamim.classification.json"]);
    runGit(repoDir, ["commit", "-m", "update teamim classification"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("semantics_version must bump");
  });

  it("fails when render files change without render version bump", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(path.join(repoDir, "render", "rules.md"), "render rules v2\n", "utf8");
    runGit(repoDir, ["add", "render/rules.md"]);
    runGit(repoDir, ["commit", "-m", "render change"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("render_version must bump");
  });

  it("fails when phrase tree rules change without render version bump", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(
      path.join(repoDir, "src", "reference", "scripts", "phraseTree", "runtime.ts"),
      "export const PHRASE_VERSION = 'phrase_tree.v2';\n",
      "utf8"
    );
    runGit(repoDir, ["add", "src/reference/scripts/phraseTree/runtime.ts"]);
    runGit(repoDir, ["commit", "-m", "phrase tree rule change"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("render_version must bump");
  });

  it("fails when trace schema changes without trace version bump", () => {
    const { repoDir, baseSha } = initRepo();
    fs.writeFileSync(
      path.join(repoDir, "spec", "70-TRACE-FORMAT.schema.json"),
      JSON.stringify({ title: "trace schema", version: 2 }, null, 2) + "\n",
      "utf8"
    );
    runGit(repoDir, ["add", "spec/70-TRACE-FORMAT.schema.json"]);
    runGit(repoDir, ["commit", "-m", "trace schema change"]);
    const headSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const result = runCheck(repoDir, baseSha, headSha);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("trace_version must bump");
  });
});
