#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsRaw from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ensureKnownFlags,
  listChangedFiles,
  listStagedFiles,
  listWorkingTreeChanges,
  runCommand
} from "../artifacts/lib.mjs";
import {
  CANONICAL_PATHS,
  LAYERS,
  SOURCE_RELEVANT_PATHS,
  TRACKED_ARTIFACT_SCOPES,
  expandImpactedLayers,
  forceLayerRebuild,
  requiredTrackedArtifactsForLayers,
  selectDirectLayers
} from "./config.mjs";

const CWD = process.cwd();
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;
const PUSH_DIFF_FILTER = "ACDMRT";
const STITCH_INPUT_LAYERS = Object.freeze(["spine", "letters", "niqqud", "cantillation", "layout"]);
const LEGACY_LATEST_PATHS = Object.freeze([
  "outputs/runs/latest/manifests",
  "outputs/runs/latest/stitched"
]);

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function uniqueSorted(values) {
  return [
    ...new Set((values ?? []).map((entry) => toPosixPath(String(entry).trim())).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function parseNewlineOutput(value) {
  return uniqueSorted(String(value ?? "").split(/\r?\n/u));
}

function toAbs(relOrAbsPath) {
  return path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.resolve(CWD, relOrAbsPath);
}

function toRepoRel(relOrAbsPath) {
  const absolutePath = toAbs(relOrAbsPath);
  const relativePath = path.relative(CWD, absolutePath);
  return toPosixPath(relativePath || ".");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fsRaw.createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
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

function isGitObjectName(value) {
  return /^[a-f0-9]{7,64}$/iu.test(String(value ?? "").trim());
}

function resolveDiffRangeFromEnv() {
  const baseSha = String(process.env.GUARDRAILS_BASE_SHA ?? "").trim();
  const headSha = String(process.env.GUARDRAILS_HEAD_SHA ?? "").trim();
  if (!isGitObjectName(baseSha) || !isGitObjectName(headSha)) {
    return null;
  }
  return `${baseSha}..${headSha}`;
}

function resolvePushDiffFiles() {
  const envRange = resolveDiffRangeFromEnv();
  if (envRange) {
    return parseNewlineOutput(
      runGit(["diff", "--name-only", `--diff-filter=${PUSH_DIFF_FILTER}`, envRange], {
        allowFailure: true
      })
    );
  }

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

function canonicalPathForLayer(layer) {
  switch (layer) {
    case "spine":
      return CANONICAL_PATHS.spineJsonlPath;
    case "letters":
      return CANONICAL_PATHS.lettersIrPath;
    case "niqqud":
      return CANONICAL_PATHS.niqqudIrPath;
    case "cantillation":
      return CANONICAL_PATHS.cantillationIrPath;
    case "layout":
      return CANONICAL_PATHS.layoutIrPath;
    case "metadata":
      return CANONICAL_PATHS.metadataPlanJsonlPath;
    default:
      return null;
  }
}

async function resolveExistingTrackedArtifact(layer) {
  const relPath = canonicalPathForLayer(layer);
  if (!relPath) {
    return null;
  }
  const absPath = toAbs(relPath);
  return (await pathExists(absPath)) ? absPath : null;
}

async function maybeCopyFile(srcPath, dstPath) {
  const absSrc = toAbs(srcPath);
  const absDst = toAbs(dstPath);
  if (!(await pathExists(absSrc))) {
    throw new Error(`Missing source file: ${toRepoRel(absSrc)}`);
  }

  const srcDigest = await sha256File(absSrc);
  let dstDigest = null;
  if (await pathExists(absDst)) {
    dstDigest = await sha256File(absDst);
  }

  if (dstDigest === srcDigest) {
    return false;
  }

  await fs.mkdir(path.dirname(absDst), { recursive: true });
  await fs.copyFile(absSrc, absDst);
  return true;
}

async function maybeWriteTextFile(dstPath, text) {
  const absDst = toAbs(dstPath);
  let existing = null;
  try {
    existing = await fs.readFile(absDst, "utf8");
  } catch {}

  if (existing === text) {
    return false;
  }

  await fs.mkdir(path.dirname(absDst), { recursive: true });
  await fs.writeFile(absDst, text, "utf8");
  return true;
}

async function readJsonObject(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object at ${toRepoRel(filePath)}`);
  }
  return parsed;
}

async function renderMetadataPlanJsonlText(filePath) {
  const parsed = await readJsonObject(filePath);
  return `${JSON.stringify(parsed)}\n`;
}

async function compareCanonicalFile(layer, expectedFilePath) {
  const canonicalRelPath = canonicalPathForLayer(layer);
  if (!canonicalRelPath) {
    return null;
  }
  const canonicalAbsPath = toAbs(canonicalRelPath);
  if (!(await pathExists(canonicalAbsPath))) {
    return `Missing canonical tracked artifact: ${canonicalRelPath}`;
  }

  const [expectedDigest, actualDigest] = await Promise.all([
    sha256File(expectedFilePath),
    sha256File(canonicalAbsPath)
  ]);
  if (expectedDigest === actualDigest) {
    return null;
  }

  return (
    `Stale canonical tracked artifact: ${canonicalRelPath} ` +
    `(expected sha256=${expectedDigest}, actual sha256=${actualDigest})`
  );
}

async function compareCanonicalText(layer, expectedText) {
  const canonicalRelPath = canonicalPathForLayer(layer);
  if (!canonicalRelPath) {
    return null;
  }
  const canonicalAbsPath = toAbs(canonicalRelPath);
  if (!(await pathExists(canonicalAbsPath))) {
    return `Missing canonical tracked artifact: ${canonicalRelPath}`;
  }

  const actualText = await fs.readFile(canonicalAbsPath, "utf8");
  const expectedDigest = sha256Text(expectedText);
  const actualDigest = sha256Text(actualText);
  if (expectedDigest === actualDigest) {
    return null;
  }

  return (
    `Stale canonical tracked artifact: ${canonicalRelPath} ` +
    `(expected sha256=${expectedDigest}, actual sha256=${actualDigest})`
  );
}

async function writeCanonicalFile(layer, sourcePath) {
  const relPath = canonicalPathForLayer(layer);
  if (!relPath) {
    return false;
  }
  return maybeCopyFile(sourcePath, relPath);
}

async function writeCanonicalText(layer, text) {
  const relPath = canonicalPathForLayer(layer);
  if (!relPath) {
    return false;
  }
  return maybeWriteTextFile(relPath, text);
}

async function pruneLegacyLatestArtifacts() {
  for (const relPath of LEGACY_LATEST_PATHS) {
    const absPath = toAbs(relPath);
    if (!(await pathExists(absPath))) {
      continue;
    }
    await fs.rm(absPath, { recursive: true, force: true });
  }
}

async function stageLatestArtifacts() {
  const latestAbs = toAbs(CANONICAL_PATHS.latestDir);
  if (!(await pathExists(latestAbs))) {
    return 0;
  }
  runGit(["add", "-A", "--", CANONICAL_PATHS.latestDir]);
  return parseNewlineOutput(
    runGit(["diff", "--cached", "--name-only", "--", CANONICAL_PATHS.latestDir], {
      allowFailure: true
    })
  ).length;
}

async function assertRequiredArtifactsPresent(requiredArtifactPaths) {
  const missing = [];
  for (const relPath of requiredArtifactPaths) {
    if (!(await pathExists(toAbs(relPath)))) {
      missing.push(relPath);
    }
  }
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    [
      "Missing required canonical tracked artifacts:",
      ...missing.map((filePath) => `- ${filePath}`)
    ].join("\n")
  );
}

async function validateTransientStitch({ resolved, stitchForce, runStitchProgram }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "src-artifacts-stitch-"));
  try {
    await runStitchProgram([
      "--spine",
      resolved.spine,
      "--letters",
      resolved.letters,
      "--niqqud",
      resolved.niqqud,
      "--cant",
      resolved.cantillation,
      "--layout",
      resolved.layout,
      "--metadata",
      resolved.metadata,
      "--out",
      tempDir,
      ...(stitchForce ? ["--force=true"] : [])
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function summarizeLayers(layers) {
  return [...layers].sort((left, right) => left.localeCompare(right, "en")).join(",");
}

function assertCleanWorkingTree() {
  const dirty = listWorkingTreeChanges([...SOURCE_RELEVANT_PATHS, ...TRACKED_ARTIFACT_SCOPES]);
  if (dirty.length === 0) {
    return;
  }

  throw new Error(
    [
      "src-artifacts:recompute --check requires committed state for src/artifact paths.",
      ...dirty.map((filePath) => `- ${filePath}`),
      "Commit or stash these changes before running push-range verification."
    ].join("\n")
  );
}

async function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set([
    "--changed-only",
    "--full",
    "--staged",
    "--push-range",
    "--check",
    "--verbose",
    "--no-stage"
  ]);
  ensureKnownFlags(args, knownFlags);

  const changedOnly = args.includes("--changed-only");
  const full = args.includes("--full");
  const stagedOnly = args.includes("--staged");
  const pushRangeOnly = args.includes("--push-range");
  const checkOnly = args.includes("--check");
  const verbose = args.includes("--verbose");
  const stageOutputs = stagedOnly && !checkOnly && !args.includes("--no-stage");

  if (changedOnly && full) {
    throw new Error("--full and --changed-only cannot be used together.");
  }
  if (stagedOnly && pushRangeOnly) {
    throw new Error("Pass at most one selector: --staged or --push-range");
  }
  if (checkOnly && !stagedOnly) {
    assertCleanWorkingTree();
  }

  const runFull = full || !changedOnly;
  const changedFiles = runFull
    ? []
    : stagedOnly
      ? listStagedFiles()
      : pushRangeOnly
        ? resolvePushDiffFiles()
        : listChangedFiles();
  const directLayers = runFull ? new Set(LAYERS) : selectDirectLayers(changedFiles);

  if (!runFull && directLayers.size === 0) {
    if (verbose) {
      console.log("src-artifacts:recompute no relevant src-layer changes detected");
    }
    return;
  }

  const impactedLayers = expandImpactedLayers(directLayers);
  const requiredTrackedArtifacts = requiredTrackedArtifactsForLayers(impactedLayers);
  console.log(
    [
      "src-artifacts:recompute",
      `mode=${checkOnly ? "check" : "apply"}`,
      `impacted_layers=${summarizeLayers(impactedLayers)}`
    ].join(" ")
  );
  if (verbose && changedFiles.length > 0) {
    console.log(`src-artifacts:recompute changed_files=${changedFiles.length}`);
    for (const filePath of changedFiles) {
      console.log(`- ${filePath}`);
    }
  }

  runCommand(["npm", "run", "build:src"], { label: "npm run build:src" });

  const require = createRequire(import.meta.url);
  const cliBase = path.resolve(CWD, "dist/src/cli");
  const { runBuildSpine } = require(path.join(cliBase, "build-spine.js"));
  const { runBuildLayer } = require(path.join(cliBase, "build-layer.js"));
  const { runBuildLayerNiqqud } = require(path.join(cliBase, "build-layer-niqqud.js"));
  const { runBuildLayerMetadata } = require(path.join(cliBase, "build-layer-metadata.js"));
  const { runStitchProgram } = require(path.join(cliBase, "stitch-program.js"));

  const driftMessages = [];
  const resolved = {
    spine: null,
    letters: null,
    niqqud: null,
    cantillation: null,
    layout: null,
    metadata: null
  };

  if (impactedLayers.has("metadata")) {
    const metadataForce = forceLayerRebuild("metadata", directLayers);
    const metadataResult = await runBuildLayerMetadata([
      "--dataset",
      CANONICAL_PATHS.metadataDataset,
      "--torah-json",
      CANONICAL_PATHS.torahJson,
      "--out",
      "outputs/cache/metadata",
      ...(metadataForce ? ["--force=true"] : [])
    ]);
    const metadataJsonlText = await renderMetadataPlanJsonlText(metadataResult.metadataPlanPath);
    resolved.metadata = metadataResult.metadataPlanPath;
    if (checkOnly) {
      const drift = await compareCanonicalText("metadata", metadataJsonlText);
      if (drift) {
        driftMessages.push(drift);
      }
    } else {
      await writeCanonicalText("metadata", metadataJsonlText);
    }
  } else {
    resolved.metadata = await resolveExistingTrackedArtifact("metadata");
  }

  const needsSpine = [...STITCH_INPUT_LAYERS, "stitch"].some((layer) => impactedLayers.has(layer));
  if (needsSpine) {
    if (impactedLayers.has("spine")) {
      const spineForce = forceLayerRebuild("spine", directLayers);
      const spineResult = await runBuildSpine([
        "--input",
        CANONICAL_PATHS.torahJson,
        "--out",
        "outputs",
        ...(spineForce ? ["--force=true"] : [])
      ]);
      resolved.spine = spineResult.spinePath;
      if (checkOnly) {
        const drift = await compareCanonicalFile("spine", spineResult.spinePath);
        if (drift) {
          driftMessages.push(drift);
        }
      } else {
        await writeCanonicalFile("spine", spineResult.spinePath);
      }
    } else {
      resolved.spine = await resolveExistingTrackedArtifact("spine");
    }

    if (!resolved.spine) {
      throw new Error(
        "Unable to resolve spine input. Run a full apply: npm run src-artifacts:recompute -- --full"
      );
    }
  }

  if (impactedLayers.has("letters")) {
    const lettersForce = forceLayerRebuild("letters", directLayers);
    const lettersResult = await runBuildLayer([
      "--layer",
      "letters",
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/letters",
      ...(lettersForce ? ["--force=true"] : [])
    ]);
    if (!lettersResult || lettersResult.layer !== "letters") {
      throw new Error("build-layer did not return a letters result");
    }
    resolved.letters = lettersResult.lettersIrPath;
    if (checkOnly) {
      const drift = await compareCanonicalFile("letters", lettersResult.lettersIrPath);
      if (drift) {
        driftMessages.push(drift);
      }
    } else {
      await writeCanonicalFile("letters", lettersResult.lettersIrPath);
    }
  } else {
    resolved.letters = await resolveExistingTrackedArtifact("letters");
  }

  if (impactedLayers.has("niqqud")) {
    const niqqudForce = forceLayerRebuild("niqqud", directLayers);
    const niqqudResult = await runBuildLayerNiqqud([
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/niqqud",
      ...(niqqudForce ? ["--force=true"] : [])
    ]);
    resolved.niqqud = niqqudResult.niqqudIrPath;
    if (checkOnly) {
      const drift = await compareCanonicalFile("niqqud", niqqudResult.niqqudIrPath);
      if (drift) {
        driftMessages.push(drift);
      }
    } else {
      await writeCanonicalFile("niqqud", niqqudResult.niqqudIrPath);
    }
  } else {
    resolved.niqqud = await resolveExistingTrackedArtifact("niqqud");
  }

  if (impactedLayers.has("cantillation")) {
    const cantillationForce = forceLayerRebuild("cantillation", directLayers);
    const cantillationResult = await runBuildLayer([
      "--layer",
      "cantillation",
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/cantillation",
      ...(cantillationForce ? ["--force=true"] : [])
    ]);
    if (!cantillationResult || cantillationResult.layer !== "cantillation") {
      throw new Error("build-layer did not return a cantillation result");
    }
    resolved.cantillation = cantillationResult.cantillationIrPath;
    if (checkOnly) {
      const drift = await compareCanonicalFile(
        "cantillation",
        cantillationResult.cantillationIrPath
      );
      if (drift) {
        driftMessages.push(drift);
      }
    } else {
      await writeCanonicalFile("cantillation", cantillationResult.cantillationIrPath);
    }
  } else {
    resolved.cantillation = await resolveExistingTrackedArtifact("cantillation");
  }

  if (impactedLayers.has("layout")) {
    const layoutForce = forceLayerRebuild("layout", directLayers);
    const layoutResult = await runBuildLayer([
      "--layer",
      "layout",
      "--spine",
      resolved.spine,
      "--dataset",
      CANONICAL_PATHS.layoutDataset,
      "--out",
      "outputs/cache/layout",
      ...(layoutForce ? ["--force=true"] : [])
    ]);
    if (!layoutResult || layoutResult.layer !== "layout") {
      throw new Error("build-layer did not return a layout result");
    }
    resolved.layout = layoutResult.layoutIrPath;
    if (checkOnly) {
      const drift = await compareCanonicalFile("layout", layoutResult.layoutIrPath);
      if (drift) {
        driftMessages.push(drift);
      }
    } else {
      await writeCanonicalFile("layout", layoutResult.layoutIrPath);
    }
  } else {
    resolved.layout = await resolveExistingTrackedArtifact("layout");
  }

  if (impactedLayers.has("stitch")) {
    const missing = [];
    if (!resolved.spine) {
      missing.push("spine");
    }
    if (!resolved.letters) {
      missing.push("letters");
    }
    if (!resolved.niqqud) {
      missing.push("niqqud");
    }
    if (!resolved.cantillation) {
      missing.push("cantillation");
    }
    if (!resolved.layout) {
      missing.push("layout");
    }
    if (!resolved.metadata) {
      missing.push("metadata");
    }
    if (missing.length > 0) {
      throw new Error(
        `Unable to resolve stitch inputs for: ${missing.join(", ")}. Run a full apply first.`
      );
    }

    await validateTransientStitch({
      resolved,
      stitchForce: forceLayerRebuild("stitch", directLayers),
      runStitchProgram
    });
  }

  if (checkOnly) {
    if (driftMessages.length > 0) {
      throw new Error(
        [
          "Canonical latest jsonl outputs are stale or missing.",
          "Re-run `npm run src-artifacts:recompute -- --changed-only --staged` and commit the updated outputs.",
          ...driftMessages.map((message) => `- ${message}`)
        ].join("\n")
      );
    }

    console.log(
      [
        "src-artifacts:recompute ok",
        "mode=check",
        `layers=${summarizeLayers(impactedLayers)}`,
        `required_artifacts=${requiredTrackedArtifacts.length}`,
        `validated_stitch=${impactedLayers.has("stitch") ? "true" : "false"}`
      ].join(" ")
    );
    return;
  }

  await pruneLegacyLatestArtifacts();
  await assertRequiredArtifactsPresent(requiredTrackedArtifacts);

  let stagedCount = 0;
  if (stageOutputs) {
    stagedCount = await stageLatestArtifacts();
  }

  console.log(
    [
      "src-artifacts:recompute ok",
      "mode=apply",
      `layers=${summarizeLayers(impactedLayers)}`,
      `required_artifacts=${requiredTrackedArtifacts.length}`,
      `staged=${stagedCount}`,
      `validated_stitch=${impactedLayers.has("stitch") ? "true" : "false"}`
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(`src-artifacts:recompute error: ${String(error?.message ?? error)}`);
  process.exit(2);
});
