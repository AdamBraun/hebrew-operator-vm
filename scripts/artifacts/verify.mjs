#!/usr/bin/env node
import {
  ARTIFACT_SETS,
  DOT_RENDERER_INPUT_PATHS,
  INTERPRETER_INPUT_PATHS,
  PASUK_CORPUS_CANONICAL_ARGS,
  REPAIR_COMMAND_HINT
} from "./config.mjs";
import {
  computeEngineInputsHash,
  ensureKnownFlags,
  filterPathsBySpecs,
  listChangedFiles,
  pathExists,
  readJsonFile,
  repoRelativeDisplay,
  sha256Text
} from "./lib.mjs";
import { pathToFileURL } from "node:url";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PASUK_MANIFEST_ID = "pasuk-trace-corpus-latest";

function assertShaField(payload, key, label) {
  const value = payload?.[key];
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    return `${label}: ${key} missing or invalid`;
  }
  return null;
}

function verifyManifest(set, expected) {
  const manifestPath = set.manifestPath;
  const label = `[${set.id}] ${manifestPath}`;

  if (!pathExists(manifestPath)) {
    return [`${label}: missing manifest`];
  }

  let payload;
  try {
    payload = readJsonFile(manifestPath);
  } catch (error) {
    return [`${label}: invalid JSON (${String(error?.message ?? error)})`];
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [`${label}: manifest root must be an object`];
  }

  const issues = [];
  if (payload.artifact_set_id !== set.id) {
    issues.push(
      `${label}: artifact_set_id must be '${set.id}' (got '${String(payload.artifact_set_id ?? "")}')`
    );
  }

  const interpreterFieldIssue = assertShaField(payload, "interpreter_inputs_hash", label);
  if (interpreterFieldIssue) {
    issues.push(interpreterFieldIssue);
  } else if (payload.interpreter_inputs_hash !== expected.interpreterHash) {
    issues.push(
      `${label}: interpreter_inputs_hash mismatch (expected ${expected.interpreterHash}, got ${payload.interpreter_inputs_hash})`
    );
  }

  if (set.requiresDotRendererHash) {
    const dotFieldIssue = assertShaField(payload, "dot_renderer_inputs_hash", label);
    if (dotFieldIssue) {
      issues.push(dotFieldIssue);
    } else if (payload.dot_renderer_inputs_hash !== expected.dotRendererHash) {
      issues.push(
        `${label}: dot_renderer_inputs_hash mismatch (expected ${expected.dotRendererHash}, got ${payload.dot_renderer_inputs_hash})`
      );
    }
  }

  if (set.id === PASUK_MANIFEST_ID) {
    const optionsFieldIssue = assertShaField(payload, "pasuk_corpus_args_sha256", label);
    if (optionsFieldIssue) {
      issues.push(optionsFieldIssue);
    } else if (payload.pasuk_corpus_args_sha256 !== expected.pasukArgsHash) {
      issues.push(
        `${label}: pasuk_corpus_args_sha256 mismatch (expected ${expected.pasukArgsHash}, got ${payload.pasuk_corpus_args_sha256})`
      );
    }
  }

  return issues;
}

function buildRamifications(verification) {
  const ramifications = [];
  const interpreterDrift =
    verification.failures.some((line) => line.includes("interpreter_inputs_hash")) ||
    verification.changedInterpreterFiles.length > 0;
  const dotDrift =
    verification.failures.some((line) => line.includes("dot_renderer_inputs_hash")) ||
    verification.changedDotFiles.length > 0;

  if (interpreterDrift) {
    ramifications.push(
      "Interpreter drift detected: all interpreter-derived corpus artifacts are stale (trace outputs and downstream reports)."
    );
    ramifications.push(
      "Required recalculation: full Torah regeneration for outputs/pasuk-trace-corpus/latest."
    );
  }

  if (dotDrift) {
    ramifications.push(
      "DOT renderer drift detected: all graph.dot artifacts in outputs/pasuk-trace-corpus/latest/refs/** are stale."
    );
    ramifications.push(
      "Required recalculation: regenerate the full pasuk trace corpus with canonical graph options."
    );
  }

  if (verification.failures.some((line) => line.includes("pasuk_corpus_args_sha256"))) {
    ramifications.push(
      "Corpus option drift detected: canonical pasuk corpus generation flags changed or were not used."
    );
  }

  if (ramifications.length === 0 && verification.failures.length > 0) {
    ramifications.push(
      "Manifest contract drift detected: required artifact metadata is incomplete."
    );
  }

  return ramifications;
}

export function verifyArtifacts({ verbose = false } = {}) {
  const interpreter = computeEngineInputsHash(INTERPRETER_INPUT_PATHS);
  const dotRenderer = computeEngineInputsHash(DOT_RENDERER_INPUT_PATHS);
  const pasukArgsHash = sha256Text(PASUK_CORPUS_CANONICAL_ARGS.join("\n"));
  const requiredSets = ARTIFACT_SETS.filter((set) => set.required !== false);
  const failures = [];

  for (const set of requiredSets) {
    failures.push(
      ...verifyManifest(set, {
        interpreterHash: interpreter.hash,
        dotRendererHash: dotRenderer.hash,
        pasukArgsHash
      })
    );
  }

  const changeScope = [...INTERPRETER_INPUT_PATHS, ...DOT_RENDERER_INPUT_PATHS];
  const changedFiles = listChangedFiles(changeScope);
  const changedInterpreterFiles = filterPathsBySpecs(changedFiles, INTERPRETER_INPUT_PATHS);
  const changedDotFiles = filterPathsBySpecs(changedFiles, DOT_RENDERER_INPUT_PATHS);

  if (verbose) {
    console.log(`artifacts:verify interpreter_inputs_files=${interpreter.files.length}`);
    for (const filePath of interpreter.files) {
      console.log(`- ${repoRelativeDisplay(filePath)}`);
    }
    console.log(`artifacts:verify dot_renderer_inputs_files=${dotRenderer.files.length}`);
    for (const filePath of dotRenderer.files) {
      console.log(`- ${repoRelativeDisplay(filePath)}`);
    }
  }

  const verification = {
    ok: failures.length === 0,
    failures,
    checked: requiredSets.length,
    interpreterHash: interpreter.hash,
    dotRendererHash: dotRenderer.hash,
    pasukArgsHash,
    changedInterpreterFiles,
    changedDotFiles
  };

  return {
    ...verification,
    ramifications: buildRamifications(verification)
  };
}

function printChangedPaths(label, paths) {
  if (paths.length === 0) {
    return;
  }
  console.error(`${label}:`);
  for (const filePath of paths) {
    console.error(`- ${filePath}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const verbose = args.includes("--verbose");

  const result = verifyArtifacts({ verbose });

  if (!result.ok) {
    console.error("artifacts:verify failed");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    printChangedPaths("Changed interpreter inputs (workspace)", result.changedInterpreterFiles);
    printChangedPaths("Changed DOT renderer inputs (workspace)", result.changedDotFiles);
    if (result.ramifications.length > 0) {
      console.error("Ramifications:");
      for (const line of result.ramifications) {
        console.error(`- ${line}`);
      }
    }
    console.error(`Fix: ${REPAIR_COMMAND_HINT}`);
    process.exit(1);
  }

  console.log(
    [
      "artifacts:verify ok",
      `manifests=${result.checked}`,
      `interpreter_inputs_hash=${result.interpreterHash}`,
      `dot_renderer_inputs_hash=${result.dotRendererHash}`,
      `pasuk_args_sha256=${result.pasukArgsHash}`
    ].join(" ")
  );
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(`artifacts:verify error: ${String(error?.message ?? error)}`);
    process.exit(2);
  }
}
