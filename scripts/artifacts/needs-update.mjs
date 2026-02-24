#!/usr/bin/env node
import { ENGINE_INPUT_PATHS } from "./config.mjs";
import { ensureKnownFlags, filterPathsBySpecs, listStagedFiles } from "./lib.mjs";

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const verbose = args.includes("--verbose");

  const staged = listStagedFiles();
  const matched = filterPathsBySpecs(staged, ENGINE_INPUT_PATHS);

  if (matched.length === 0) {
    if (verbose) {
      console.log("artifacts:needs-update no engine-impacting staged files");
    }
    process.exit(0);
  }

  console.log(`artifacts:needs-update matched ${matched.length} staged engine-impacting path(s)`);
  if (verbose) {
    for (const filePath of matched) {
      console.log(`- ${filePath}`);
    }
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(2);
}
