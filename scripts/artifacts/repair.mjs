#!/usr/bin/env node
import {
  ARTIFACT_SETS,
  DOT_RENDERER_INPUT_PATHS,
  ENGINE_INPUT_PATHS,
  INTERPRETER_INPUT_PATHS,
  PASUK_CORPUS_CANONICAL_ARGS,
  REPAIR_COMMAND_HINT
} from "./config.mjs";
import {
  computeEngineInputsHash,
  ensureKnownFlags,
  filterPathsBySpecs,
  getGitHeadShortSha,
  listChangedFiles,
  listStagedFiles,
  readJsonFile,
  repoRelativeDisplay,
  runCommand,
  sha256Text,
  writeJsonFile
} from "./lib.mjs";
import { verifyArtifacts } from "./verify.mjs";

function selectArtifactSets({ changedOnly, full, stagedOnly, verbose }) {
  const requiredSets = ARTIFACT_SETS.filter((set) => set.required !== false);
  if (full || !changedOnly) {
    return {
      selected: requiredSets,
      changedFiles: []
    };
  }

  const changedFiles = stagedOnly ? listStagedFiles() : listChangedFiles();
  const engineTouched = filterPathsBySpecs(changedFiles, ENGINE_INPUT_PATHS);

  if (engineTouched.length === 0) {
    const verify = verifyArtifacts({ verbose: false });
    if (verify.ok) {
      if (verbose) {
        console.log("artifacts:repair changed-only found no engine-impacting file changes");
      }
      return {
        selected: [],
        changedFiles
      };
    }
    console.log(
      "artifacts:repair changed-only found no engine-impacting file changes but manifests are stale; repairing all required sets"
    );
    return {
      selected: requiredSets,
      changedFiles
    };
  }

  if (verbose) {
    console.log(`artifacts:repair engine-impacting changed files=${engineTouched.length}`);
    for (const filePath of engineTouched) {
      console.log(`- ${filePath}`);
    }
  }

  const selected = requiredSets.filter((set) => {
    const matched = filterPathsBySpecs(engineTouched, set.impactPaths ?? []);
    return matched.length > 0;
  });

  return {
    selected: selected.length > 0 ? selected : requiredSets,
    changedFiles
  };
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

function stampManifestContract(args) {
  const {
    set,
    interpreterHash,
    dotRendererHash,
    pasukArgsHash,
    gitSha,
    timestamp,
    packageVersion
  } = args;
  const manifest = readJsonFile(set.manifestPath);
  manifest.artifact_set_id = set.id;
  manifest.interpreter_inputs_hash = interpreterHash;
  if (set.requiresDotRendererHash) {
    manifest.dot_renderer_inputs_hash = dotRendererHash;
  } else {
    delete manifest.dot_renderer_inputs_hash;
  }
  if (set.id === "pasuk-trace-corpus-latest") {
    manifest.pasuk_corpus_args_sha256 = pasukArgsHash;
  } else {
    delete manifest.pasuk_corpus_args_sha256;
  }
  delete manifest.engine_inputs_hash;
  if (gitSha) {
    manifest.engine_git_sha = gitSha;
  } else {
    delete manifest.engine_git_sha;
  }
  manifest.artifact_generated_at = timestamp;
  manifest.artifact_tool_versions = {
    node: process.version,
    ...(packageVersion ? { package: packageVersion } : {})
  };
  writeJsonFile(set.manifestPath, manifest);
}

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--changed-only", "--full", "--staged", "--verbose"]);
  ensureKnownFlags(args, knownFlags);

  const changedOnly = args.includes("--changed-only");
  const full = args.includes("--full");
  const stagedOnly = args.includes("--staged");
  const verbose = args.includes("--verbose");

  if (full && changedOnly) {
    throw new Error("--full and --changed-only cannot be used together.");
  }

  const { selected } = selectArtifactSets({ changedOnly, full, stagedOnly, verbose });
  if (selected.length === 0) {
    console.log("artifacts:repair no impacted artifact sets to regenerate");
    return;
  }

  console.log(`artifacts:repair selected_sets=${selected.length}`);
  for (const set of selected) {
    console.log(`- ${set.id}`);
  }

  console.log("artifacts:repair running build");
  runCommand(["npm", "run", "build"], { label: "npm run build" });

  for (const set of selected) {
    if (!Array.isArray(set.repairCommand) || set.repairCommand.length === 0) {
      throw new Error(`No repair command configured for artifact set '${set.id}'`);
    }
    console.log(`artifacts:repair regenerating ${set.id}`);
    runCommand(set.repairCommand, { label: set.repairCommand.join(" ") });
  }

  const interpreter = computeEngineInputsHash(INTERPRETER_INPUT_PATHS);
  const dotRenderer = computeEngineInputsHash(DOT_RENDERER_INPUT_PATHS);
  const pasukArgsHash = sha256Text(PASUK_CORPUS_CANONICAL_ARGS.join("\n"));
  const gitSha = getGitHeadShortSha();
  const timestamp = new Date().toISOString();
  const packageVersion = readPackageVersion();

  for (const set of selected) {
    stampManifestContract({
      set,
      interpreterHash: interpreter.hash,
      dotRendererHash: dotRenderer.hash,
      pasukArgsHash,
      gitSha,
      timestamp,
      packageVersion
    });
    console.log(`artifacts:repair stamped ${repoRelativeDisplay(set.manifestPath)}`);
  }

  const verify = verifyArtifacts({ verbose: false });
  if (!verify.ok) {
    console.error("artifacts:repair regenerated outputs but verify still failed");
    for (const failure of verify.failures) {
      console.error(`- ${failure}`);
    }
    console.error(`Fix: ${REPAIR_COMMAND_HINT}`);
    process.exit(1);
  }

  console.log(
    [
      "artifacts:repair ok",
      `sets=${selected.length}`,
      `interpreter_inputs_hash=${verify.interpreterHash}`,
      `dot_renderer_inputs_hash=${verify.dotRendererHash}`
    ].join(" ")
  );
}

try {
  main();
} catch (error) {
  console.error(`artifacts:repair error: ${String(error?.message ?? error)}`);
  process.exit(2);
}
