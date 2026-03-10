#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { ensureKnownFlags } from "../artifacts/lib.mjs";

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--staged", "--push-range", "--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const passthroughArgs =
    args.includes("--staged") || args.includes("--push-range") ? args : ["--push-range", ...args];

  execFileSync(
    process.execPath,
    ["scripts/src-artifacts/recompute.mjs", "--changed-only", "--check", ...passthroughArgs],
    {
      cwd: process.cwd(),
      stdio: "inherit"
    }
  );
}

main();
