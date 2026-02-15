#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadUiBundleRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/uiBundle/runtime"
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
        "Missing compiled ui bundle runtime module. Run `npm run build` before `node scripts/ui-bundle.mjs`."
      );
    }
    throw error;
  }
}

const uiBundleRuntime = loadUiBundleRuntime();

uiBundleRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});

