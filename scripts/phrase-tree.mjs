#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadPhraseTreeRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "dist/src/reference/scripts/phraseTree/runtime"
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
        "Missing compiled phrase tree runtime module. Run `npm run build` before `node scripts/phrase-tree.mjs`."
      );
    }
    throw error;
  }
}

const phraseTreeRuntime = loadPhraseTreeRuntime();

phraseTreeRuntime.main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
