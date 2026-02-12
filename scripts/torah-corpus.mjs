#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";

const cjsRequire = createRequire(import.meta.url);

function loadTorahCorpusRuntime() {
  const runtimeModulePath = path.resolve(
    process.cwd(),
    "impl/reference/dist/scripts/torahCorpus/runtimeCommands"
  );
  try {
    return cjsRequire(runtimeModulePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing compiled torah corpus runtime module. Run `npm run build` before `node scripts/torah-corpus.mjs`."
      );
    }
    throw error;
  }
}

const torahCorpusRuntime = loadTorahCorpusRuntime();

torahCorpusRuntime
  .main(process.argv.slice(2))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
