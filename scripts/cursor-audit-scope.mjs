#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "dist/src/reference/scripts/cursorAuditScope/runtime"
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
        "Missing compiled cursor audit scope runtime module. Run `npm run build` before `node scripts/cursor-audit-scope.mjs`."
      );
    }
    throw error;
  }
}

const runtime = loadRuntime();

runtime.main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
