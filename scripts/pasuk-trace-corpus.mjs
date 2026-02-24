#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";
import {
  ARTIFACT_SETS,
  DOT_RENDERER_INPUT_PATHS,
  INTERPRETER_INPUT_PATHS
} from "./artifacts/config.mjs";
import {
  computeEngineInputsHash,
  getGitHeadShortSha,
  readJsonFile,
  sha256Text,
  writeJsonFile
} from "./artifacts/lib.mjs";

const cjsRequire = createRequire(import.meta.url);
const PASUK_SET_ID = "pasuk-trace-corpus-latest";

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

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function toRepoRelativePath(relOrAbsPath) {
  const absolutePath = path.isAbsolute(relOrAbsPath)
    ? relOrAbsPath
    : path.resolve(process.cwd(), relOrAbsPath);
  const relativePath = path.relative(process.cwd(), absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return toPosixPath(absolutePath);
  }
  return toPosixPath(relativePath || ".");
}

function readPackageVersion() {
  try {
    const pkg = readJsonFile("package.json");
    if (pkg && typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function buildPasukCorpusArgsHash(opts) {
  const args = [
    `--input=${toRepoRelativePath(opts.input)}`,
    `--out-dir=${toRepoRelativePath(opts.outDir)}`,
    `--lang=${opts.lang}`,
    opts.keepTeamim ? "--keep-teamim" : "--strip-teamim",
    opts.includeSnapshots ? "--include-snapshots" : "--no-snapshots",
    `--layout=${opts.graphLayout}`,
    opts.graphPrettyIds ? "--pretty-ids" : "--no-pretty-ids",
    `--boundary=${opts.graphBoundary}`
  ];
  return sha256Text(args.join("\n"));
}

function stampPasukManifestContract(pasukArgsHash) {
  const pasukSet = ARTIFACT_SETS.find((set) => set.id === PASUK_SET_ID);
  if (!pasukSet) {
    throw new Error(`Missing artifact set definition for '${PASUK_SET_ID}'`);
  }

  const manifest = readJsonFile(pasukSet.manifestPath);
  manifest.artifact_set_id = pasukSet.id;
  manifest.interpreter_inputs_hash = computeEngineInputsHash(INTERPRETER_INPUT_PATHS).hash;
  manifest.dot_renderer_inputs_hash = computeEngineInputsHash(DOT_RENDERER_INPUT_PATHS).hash;
  manifest.pasuk_corpus_args_sha256 = pasukArgsHash;
  delete manifest.engine_inputs_hash;

  const gitSha = getGitHeadShortSha();
  if (gitSha) {
    manifest.engine_git_sha = gitSha;
  } else {
    delete manifest.engine_git_sha;
  }

  const packageVersion = readPackageVersion();

  manifest.artifact_generated_at = new Date().toISOString();
  manifest.artifact_tool_versions = {
    node: process.version,
    ...(packageVersion ? { package: packageVersion } : {})
  };

  writeJsonFile(pasukSet.manifestPath, manifest);
}

function shouldStampPasukManifest(rawArgs) {
  if (typeof pasukTraceCorpusRuntime.parseArgs !== "function") {
    return {
      shouldStamp: false,
      pasukArgsHash: ""
    };
  }
  const parsed = pasukTraceCorpusRuntime.parseArgs(rawArgs);
  const pasukSet = ARTIFACT_SETS.find((set) => set.id === PASUK_SET_ID);
  if (!pasukSet) {
    return {
      shouldStamp: false,
      pasukArgsHash: ""
    };
  }

  const expectedOutDir = path.resolve(process.cwd(), pasukSet.artifactRootPath);
  const requestedOutDir = path.resolve(parsed.outDir);
  return {
    shouldStamp: expectedOutDir === requestedOutDir,
    pasukArgsHash: buildPasukCorpusArgsHash(parsed)
  };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  await pasukTraceCorpusRuntime.main(rawArgs);

  const { shouldStamp, pasukArgsHash } = shouldStampPasukManifest(rawArgs);
  if (shouldStamp) {
    stampPasukManifestContract(pasukArgsHash);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
