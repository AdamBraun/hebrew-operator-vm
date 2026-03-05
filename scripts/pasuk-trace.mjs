#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadPasukTraceRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "dist/src/reference/scripts/pasukTrace/runtime"
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
        "Missing compiled pasuk trace runtime module. Run `npm run build` before `node scripts/pasuk-trace.mjs`."
      );
    }
    throw error;
  }
}

const pasukTraceRuntime = loadPasukTraceRuntime();

pasukTraceRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
