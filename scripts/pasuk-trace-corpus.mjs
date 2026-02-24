#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadPasukTraceCorpusRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/pasukTraceCorpus/runtime"
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
        "Missing compiled pasuk trace corpus runtime module. Run `npm run build` before `node scripts/pasuk-trace-corpus.mjs`."
      );
    }
    throw error;
  }
}

const pasukTraceCorpusRuntime = loadPasukTraceCorpusRuntime();

pasukTraceCorpusRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
