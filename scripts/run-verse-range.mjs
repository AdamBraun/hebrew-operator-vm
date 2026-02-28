#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadRunVerseRangeRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/runVerseRange/runtime"
  );
  try {
    return cjsRequire(runtimeModulePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND"
    ) {
      throw new Error(
        "Missing compiled run-verse-range runtime module. Run `npm run build` before `node scripts/run-verse-range.mjs`."
      );
    }
    throw error;
  }
}

const runVerseRangeRuntime = loadRunVerseRangeRuntime();

runVerseRangeRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
