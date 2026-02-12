#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadIterateTorahRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/iterateTorah/runtime"
  );
  try {
    return cjsRequire(runtimeModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled iterate torah runtime module. Run `npm run build` before `node scripts/iterate-torah.mjs`."
      );
    }
    throw error;
  }
}

const iterateTorahRuntime = loadIterateTorahRuntime();

iterateTorahRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
