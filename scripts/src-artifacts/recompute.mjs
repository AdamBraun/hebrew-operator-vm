#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsRaw from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ensureKnownFlags,
  listChangedFiles,
  listStagedFiles,
  runCommand
} from "../artifacts/lib.mjs";
import {
  CANONICAL_PATHS,
  LAYERS,
  expandImpactedLayers,
  forceLayerRebuild,
  requiredTrackedArtifactsForLayers,
  selectDirectLayers
} from "./config.mjs";

const CWD = process.cwd();
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
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

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function resolveFromAlias(aliasRelPath, key) {
  const aliasPath = toAbs(aliasRelPath);
  const parsed = await readJsonSafe(aliasPath);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const value = parsed[key];
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const resolved = toAbs(value);
  return (await pathExists(resolved)) ? resolved : null;
}

async function resolveFromCacheByContentHash(cacheRelDir, fileName, targetSha256) {
  if (typeof targetSha256 !== "string" || !/^[a-f0-9]{64}$/.test(targetSha256)) {
    return null;
  }

  const cacheDir = toAbs(cacheRelDir);
  let entries;
  try {
    entries = await fs.readdir(cacheDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(cacheDir, entry.name, fileName);
    if (!(await pathExists(candidate))) {
      continue;
    }
    const digest = await sha256File(candidate);
    if (digest !== targetSha256) {
      continue;
    }
    const stat = await fs.stat(candidate);
    matches.push({ candidate, mtimeMs: stat.mtimeMs });
  }

  if (matches.length === 0) {
    return null;
  }
  matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return matches[0].candidate;
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

async function readProgramMeta() {
  const metaPath = toAbs(CANONICAL_PATHS.stitchedMetaPath);
  const parsed = await readJsonSafe(metaPath);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return parsed;
}

async function resolveExistingLayerPath(layer, programMeta) {
  if (layer === "spine") {
    const fromMeta = await resolveFromCacheByContentHash(
      "outputs/cache/spine",
      "spine.jsonl",
      programMeta?.spineDigest
    );
    if (fromMeta) {
      return fromMeta;
    }
    return resolveFromAlias("outputs/runs/latest/manifests/spine.json", "spine_jsonl_path");
  }

  if (layer === "letters") {
    const fromMeta = await resolveFromCacheByContentHash(
      "outputs/cache/letters",
      "letters.ir.jsonl",
      programMeta?.lettersDigest
    );
    if (fromMeta) {
      return fromMeta;
    }
    return resolveFromAlias("outputs/runs/latest/manifests/letters.json", "letters_ir_jsonl_path");
  }

  if (layer === "niqqud") {
    return resolveFromCacheByContentHash(
      "outputs/cache/niqqud",
      "niqqud.ir.jsonl",
      programMeta?.niqqudDigest
    );
  }

  if (layer === "cantillation") {
    const fromMeta = await resolveFromCacheByContentHash(
      "outputs/cache/cantillation",
      "cantillation.ir.jsonl",
      programMeta?.cantDigest
    );
    if (fromMeta) {
      return fromMeta;
    }
    return resolveFromAlias(
      "outputs/runs/latest/manifests/cantillation.json",
      "cantillation_ir_jsonl_path"
    );
  }

  if (layer === "layout") {
    const fromMeta = await resolveFromCacheByContentHash(
      "outputs/cache/layout",
      "layout.ir.jsonl",
      programMeta?.layoutDigest
    );
    if (fromMeta) {
      return fromMeta;
    }
    return resolveFromAlias("outputs/runs/latest/manifests/layout.json", "layout_ir_jsonl_path");
  }

  return null;
}

async function resolveMetadataPath(programMeta) {
  const canonicalPath = toAbs(CANONICAL_PATHS.stitchedMetadataPlanPath);
  if (await pathExists(canonicalPath)) {
    if (typeof programMeta?.metadataDigest !== "string") {
      return canonicalPath;
    }
    const digest = await sha256File(canonicalPath);
    if (digest === programMeta.metadataDigest) {
      return canonicalPath;
    }
  }

  const fromCache = await resolveFromCacheByContentHash(
    "outputs/cache/metadata",
    "metadata.plan.json",
    programMeta?.metadataDigest
  );
  if (fromCache) {
    return fromCache;
  }

  return (await pathExists(canonicalPath)) ? canonicalPath : null;
}

function addStagePath(stageSet, filePath) {
  if (!filePath) {
    return;
  }
  stageSet.add(toAbs(filePath));
}

function addRunManifestPath(stageSet, layer, digest) {
  if (layer !== "letters" && layer !== "cantillation") {
    return;
  }
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) {
    return;
  }
  const fileName = layer === "letters" ? "letters.json" : "cantillation.json";
  const runManifestPath = path.resolve(CWD, "outputs", "runs", digest, "manifests", fileName);
  stageSet.add(runManifestPath);
}

function uniqueSorted(paths) {
  return [
    ...new Set((paths ?? []).map((entry) => toPosixPath(String(entry)).trim()).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, "en"));
}

async function stageArtifacts(pathsToStage) {
  const relPaths = uniqueSorted(
    [...pathsToStage].map((absPath) => {
      const relative = path.relative(CWD, absPath);
      return relative.startsWith("..") ? "" : relative;
    })
  );
  if (relPaths.length === 0) {
    return 0;
  }
  runGit(["add", "-A", "--", ...relPaths]);
  return relPaths.length;
}

async function assertRequiredArtifactsPresent(requiredArtifactPaths) {
  const missing = [];
  for (const relPath of requiredArtifactPaths) {
    if (!(await pathExists(toAbs(relPath)))) {
      missing.push(relPath);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      [
        "Missing required tracked artifacts after recompute:",
        ...missing.map((filePath) => `- ${filePath}`)
      ].join("\n")
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--changed-only", "--full", "--staged", "--verbose", "--no-stage"]);
  ensureKnownFlags(args, knownFlags);

  const changedOnly = args.includes("--changed-only");
  const full = args.includes("--full");
  const stagedOnly = args.includes("--staged");
  const verbose = args.includes("--verbose");
  const stageOutputs = stagedOnly && !args.includes("--no-stage");

  if (changedOnly && full) {
    throw new Error("--full and --changed-only cannot be used together.");
  }

  const runFull = full || !changedOnly;
  const changedFiles = runFull ? [] : stagedOnly ? listStagedFiles() : listChangedFiles();
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
    `src-artifacts:recompute impacted_layers=${[...impactedLayers]
      .sort((left, right) => left.localeCompare(right, "en"))
      .join(",")}`
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

  const outputsToStage = new Set();
  const programMeta = await readProgramMeta();
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
    const metadataArgs = [
      "--dataset",
      CANONICAL_PATHS.metadataDataset,
      "--torah-json",
      CANONICAL_PATHS.torahJson,
      "--out",
      "outputs/cache/metadata",
      ...(metadataForce ? ["--force=true"] : [])
    ];
    const metadataResult = await runBuildLayerMetadata(metadataArgs);
    await maybeCopyFile(metadataResult.metadataPlanPath, CANONICAL_PATHS.stitchedMetadataPlanPath);
    resolved.metadata = toAbs(CANONICAL_PATHS.stitchedMetadataPlanPath);
    addStagePath(outputsToStage, resolved.metadata);
  }

  const needsSpine = ["spine", "letters", "niqqud", "cantillation", "layout", "stitch"].some(
    (layer) => impactedLayers.has(layer)
  );

  if (needsSpine) {
    if (impactedLayers.has("spine")) {
      const spineForce = forceLayerRebuild("spine", directLayers);
      const spineArgs = [
        "--input",
        CANONICAL_PATHS.torahJson,
        "--out",
        "outputs",
        ...(spineForce ? ["--force=true"] : [])
      ];
      const spineResult = await runBuildSpine(spineArgs);
      resolved.spine = spineResult.spinePath;
      addStagePath(outputsToStage, spineResult.aliasPath);
    } else {
      resolved.spine = await resolveExistingLayerPath("spine", programMeta);
    }

    if (!resolved.spine) {
      throw new Error(
        "Unable to resolve spine input. Run a full recompute: npm run src-artifacts:recompute -- --full"
      );
    }
  }

  if (impactedLayers.has("letters")) {
    const lettersForce = forceLayerRebuild("letters", directLayers);
    const lettersArgs = [
      "--layer",
      "letters",
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/letters",
      ...(lettersForce ? ["--force=true"] : [])
    ];
    const lettersResult = await runBuildLayer(lettersArgs);
    if (!lettersResult || lettersResult.layer !== "letters") {
      throw new Error("build-layer did not return a letters result");
    }
    resolved.letters = lettersResult.lettersIrPath;
    addStagePath(outputsToStage, lettersResult.aliasPath);
    addRunManifestPath(outputsToStage, "letters", lettersResult.digest);
  }

  if (impactedLayers.has("niqqud")) {
    const niqqudForce = forceLayerRebuild("niqqud", directLayers);
    const niqqudArgs = [
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/niqqud",
      ...(niqqudForce ? ["--force=true"] : [])
    ];
    const niqqudResult = await runBuildLayerNiqqud(niqqudArgs);
    resolved.niqqud = niqqudResult.niqqudIrPath;
  }

  if (impactedLayers.has("cantillation")) {
    const cantillationForce = forceLayerRebuild("cantillation", directLayers);
    const cantillationArgs = [
      "--layer",
      "cantillation",
      "--spine",
      resolved.spine,
      "--out",
      "outputs/cache/cantillation",
      ...(cantillationForce ? ["--force=true"] : [])
    ];
    const cantillationResult = await runBuildLayer(cantillationArgs);
    if (!cantillationResult || cantillationResult.layer !== "cantillation") {
      throw new Error("build-layer did not return a cantillation result");
    }
    resolved.cantillation = cantillationResult.cantillationIrPath;
    addStagePath(outputsToStage, cantillationResult.aliasPath);
    addRunManifestPath(outputsToStage, "cantillation", cantillationResult.digest);
  }

  if (impactedLayers.has("layout")) {
    const layoutForce = forceLayerRebuild("layout", directLayers);
    const layoutArgs = [
      "--layer",
      "layout",
      "--spine",
      resolved.spine,
      "--dataset",
      CANONICAL_PATHS.layoutDataset,
      "--out",
      "outputs/cache/layout",
      ...(layoutForce ? ["--force=true"] : [])
    ];
    const layoutResult = await runBuildLayer(layoutArgs);
    if (!layoutResult || layoutResult.layer !== "layout") {
      throw new Error("build-layer did not return a layout result");
    }
    resolved.layout = layoutResult.layoutIrPath;
    addStagePath(outputsToStage, layoutResult.aliasPath);
  }

  if (impactedLayers.has("stitch")) {
    resolved.letters = resolved.letters ?? (await resolveExistingLayerPath("letters", programMeta));
    resolved.niqqud = resolved.niqqud ?? (await resolveExistingLayerPath("niqqud", programMeta));
    resolved.cantillation =
      resolved.cantillation ?? (await resolveExistingLayerPath("cantillation", programMeta));
    resolved.layout = resolved.layout ?? (await resolveExistingLayerPath("layout", programMeta));
    resolved.metadata = resolved.metadata ?? (await resolveMetadataPath(programMeta));

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
        `Unable to resolve stitch inputs for: ${missing.join(", ")}. Run a full recompute first.`
      );
    }

    const stitchForce = forceLayerRebuild("stitch", directLayers);
    const stitchArgs = [
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
      CANONICAL_PATHS.stitchedDir,
      ...(stitchForce ? ["--force=true"] : [])
    ];
    const stitchResult = await runStitchProgram(stitchArgs);
    addStagePath(outputsToStage, stitchResult.programPath);
    addStagePath(outputsToStage, stitchResult.metaPath);
    addStagePath(outputsToStage, stitchResult.manifestPath);
    if (resolved.metadata === toAbs(CANONICAL_PATHS.stitchedMetadataPlanPath)) {
      addStagePath(outputsToStage, resolved.metadata);
    }
  }

  for (const relPath of requiredTrackedArtifacts) {
    addStagePath(outputsToStage, relPath);
  }
  await assertRequiredArtifactsPresent(requiredTrackedArtifacts);

  let stagedCount = 0;
  if (stageOutputs) {
    stagedCount = await stageArtifacts(outputsToStage);
  }

  console.log(
    [
      "src-artifacts:recompute ok",
      `layers=${[...impactedLayers].sort((left, right) => left.localeCompare(right, "en")).join(",")}`,
      `required_artifacts=${requiredTrackedArtifacts.length}`,
      `staged=${stagedCount}`
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(`src-artifacts:recompute error: ${String(error?.message ?? error)}`);
  process.exit(2);
});
