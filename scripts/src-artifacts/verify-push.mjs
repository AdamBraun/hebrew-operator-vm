#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { ensureKnownFlags, listWorkingTreeChanges } from "../artifacts/lib.mjs";
import {
  SOURCE_RELEVANT_PATHS,
  TRACKED_ARTIFACT_SCOPES,
  expandImpactedLayers,
  requiredTrackedArtifactsForLayers,
  selectDirectLayers
} from "./config.mjs";

const CWD = process.cwd();
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;
const PUSH_DIFF_FILTER = "ACMRT";

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function uniqueSorted(values) {
  return [
    ...new Set((values ?? []).map((entry) => toPosixPath(String(entry).trim())).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: CWD,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: GIT_OUTPUT_MAX_BUFFER
    });
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const stderr = Buffer.isBuffer(error?.stderr)
      ? error.stderr.toString("utf8").trim()
      : String(error?.stderr ?? "").trim();
    const suffix = stderr.length > 0 ? `: ${stderr}` : "";
    throw new Error(`git ${args.join(" ")} failed${suffix}`);
  }
}

function parseNewlineOutput(value) {
  return uniqueSorted(String(value ?? "").split(/\r?\n/u));
}

function resolvePushDiffFiles() {
  const upstreamRef = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
    allowFailure: true
  }).trim();
  if (upstreamRef.length > 0) {
    return parseNewlineOutput(
      runGit(
        ["diff", "--name-only", `--diff-filter=${PUSH_DIFF_FILTER}`, `${upstreamRef}...HEAD`],
        {
          allowFailure: true
        }
      )
    );
  }

  const fallback = parseNewlineOutput(
    runGit(["diff", "--name-only", `--diff-filter=${PUSH_DIFF_FILTER}`, "HEAD~1..HEAD"], {
      allowFailure: true
    })
  );
  if (fallback.length > 0) {
    return fallback;
  }

  return parseNewlineOutput(
    runGit(
      ["show", "--pretty=format:", "--name-only", `--diff-filter=${PUSH_DIFF_FILTER}`, "HEAD"],
      {
        allowFailure: true
      }
    )
  );
}

function includesPath(paths, expectedPath) {
  return paths.includes(expectedPath);
}

function assertCleanWorkingTree() {
  const relevantPaths = [...SOURCE_RELEVANT_PATHS, ...TRACKED_ARTIFACT_SCOPES];
  const dirty = listWorkingTreeChanges(relevantPaths);
  if (dirty.length === 0) {
    return;
  }

  console.error(
    "src-artifacts:verify:push requires committed state. Uncommitted changes in src/artifact paths:"
  );
  for (const filePath of dirty) {
    console.error(`- ${filePath}`);
  }
  console.error("Commit these changes before pushing.");
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const verbose = args.includes("--verbose");

  assertCleanWorkingTree();

  const pushDiffFiles = resolvePushDiffFiles();
  if (pushDiffFiles.length === 0) {
    console.log("src-artifacts:verify:push ok (no commits to verify)");
    return;
  }

  const directLayers = selectDirectLayers(pushDiffFiles);
  if (directLayers.size === 0) {
    console.log("src-artifacts:verify:push ok (no src-layer changes in push range)");
    return;
  }

  const impactedLayers = expandImpactedLayers(directLayers);
  const requiredArtifacts = requiredTrackedArtifactsForLayers(impactedLayers);
  const missingArtifacts = requiredArtifacts.filter(
    (filePath) => !includesPath(pushDiffFiles, filePath)
  );

  if (verbose) {
    console.log(`src-artifacts:verify:push push_files=${pushDiffFiles.length}`);
    console.log(
      `src-artifacts:verify:push impacted_layers=${[...impactedLayers]
        .sort((left, right) => left.localeCompare(right, "en"))
        .join(",")}`
    );
  }

  if (missingArtifacts.length > 0) {
    console.error("src-artifacts:verify:push failed");
    console.error("Missing required tracked artifact updates for impacted layers:");
    for (const filePath of missingArtifacts) {
      console.error(`- ${filePath}`);
    }
    console.error(
      "Fix: run `npm run src-artifacts:recompute -- --changed-only --staged`, commit, then push."
    );
    process.exit(1);
  }

  console.log(
    [
      "src-artifacts:verify:push ok",
      `impacted_layers=${[...impactedLayers].sort((left, right) => left.localeCompare(right, "en")).join(",")}`,
      `required_artifacts=${requiredArtifacts.length}`
    ].join(" ")
  );
}

try {
  main();
} catch (error) {
  console.error(`src-artifacts:verify:push error: ${String(error?.message ?? error)}`);
  process.exit(2);
}
