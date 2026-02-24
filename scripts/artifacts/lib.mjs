import crypto from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = process.cwd();
const GIT_OUTPUT_MAX_BUFFER = 128 * 1024 * 1024;

function errorFromCommandFailure(error, commandLabel) {
  const stderrRaw = error && typeof error === "object" ? error.stderr : "";
  const stderr = Buffer.isBuffer(stderrRaw)
    ? stderrRaw.toString("utf8").trim()
    : String(stderrRaw ?? "").trim();
  const suffix = stderr ? `: ${stderr}` : "";
  return new Error(`${commandLabel} failed${suffix}`);
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: GIT_OUTPUT_MAX_BUFFER
    });
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw errorFromCommandFailure(error, `git ${args.join(" ")}`);
  }
}

export function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function normalizeRelativePath(value) {
  let normalized = toPosixPath(String(value ?? "").trim());
  normalized = normalized.replace(/^\.\/+/u, "");
  normalized = normalized.replace(/^\/+/u, "");
  normalized = normalized.replace(/\/+/gu, "/");
  if (normalized === ".") {
    return "";
  }
  return normalized;
}

function toRepoRelativePath(value) {
  const normalizedInput = toPosixPath(String(value ?? "").trim());
  const absolutePath = path.isAbsolute(normalizedInput)
    ? normalizedInput
    : path.resolve(REPO_ROOT, normalizedInput);
  return normalizeRelativePath(path.relative(REPO_ROOT, absolutePath));
}

function uniqueSorted(paths) {
  return Array.from(new Set(paths.map(normalizeRelativePath).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

function parseNewlineOutput(output) {
  return uniqueSorted(String(output ?? "").split(/\r?\n/u));
}

function parseNullOutput(output) {
  return uniqueSorted(String(output ?? "").split("\0"));
}

function appendPathSpecs(baseArgs, pathSpecs) {
  const normalized = uniqueSorted(pathSpecs ?? []);
  if (normalized.length === 0) {
    return baseArgs;
  }
  return [...baseArgs, "--", ...normalized];
}

export function matchesPathSpec(filePath, spec) {
  const normalizedFile = normalizeRelativePath(filePath);
  const normalizedSpec = normalizeRelativePath(spec);
  if (!normalizedFile || !normalizedSpec) {
    return false;
  }
  if (normalizedFile === normalizedSpec) {
    return true;
  }
  return normalizedFile.startsWith(`${normalizedSpec}/`);
}

export function filterPathsBySpecs(paths, specs) {
  const normalizedSpecs = uniqueSorted(specs ?? []);
  return uniqueSorted(paths ?? []).filter((filePath) =>
    normalizedSpecs.some((spec) => matchesPathSpec(filePath, spec))
  );
}

export function listStagedFiles(pathSpecs) {
  return parseNewlineOutput(
    runGit(appendPathSpecs(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], pathSpecs))
  );
}

export function listUnstagedFiles(pathSpecs) {
  return parseNewlineOutput(
    runGit(appendPathSpecs(["diff", "--name-only", "--diff-filter=ACMR"], pathSpecs))
  );
}

export function listUntrackedFiles(pathSpecs) {
  return parseNewlineOutput(
    runGit(appendPathSpecs(["ls-files", "--others", "--exclude-standard"], pathSpecs))
  );
}

export function listChangedFiles(pathSpecs) {
  const staged = parseNewlineOutput(
    runGit(appendPathSpecs(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], pathSpecs))
  );
  const unstaged = parseNewlineOutput(
    runGit(appendPathSpecs(["diff", "--name-only", "--diff-filter=ACMR"], pathSpecs))
  );
  const untracked = parseNewlineOutput(
    runGit(appendPathSpecs(["ls-files", "--others", "--exclude-standard"], pathSpecs))
  );
  return uniqueSorted([...staged, ...unstaged, ...untracked]);
}

export function listWorkingTreeChanges(pathSpecs) {
  return uniqueSorted([
    ...listStagedFiles(pathSpecs),
    ...listUnstagedFiles(pathSpecs),
    ...listUntrackedFiles(pathSpecs)
  ]);
}

export function listTrackedFiles(pathSpecs) {
  const normalizedSpecs = uniqueSorted(pathSpecs ?? []);
  if (normalizedSpecs.length === 0) {
    return [];
  }
  return parseNullOutput(runGit(["ls-files", "-z", "--", ...normalizedSpecs]));
}

export function computeEngineInputsHash(pathSpecs) {
  const files = listTrackedFiles(pathSpecs);
  const hasher = crypto.createHash("sha256");
  hasher.update("engine-inputs-v1\0", "utf8");

  for (const relPath of files) {
    const absolutePath = path.resolve(REPO_ROOT, relPath);
    hasher.update(toPosixPath(relPath), "utf8");
    hasher.update("\0", "utf8");
    if (fs.existsSync(absolutePath)) {
      hasher.update(fs.readFileSync(absolutePath));
    } else {
      hasher.update("<missing>", "utf8");
    }
    hasher.update("\0", "utf8");
  }

  return {
    hash: hasher.digest("hex"),
    files
  };
}

export function sha256Text(value) {
  return crypto
    .createHash("sha256")
    .update(String(value ?? ""), "utf8")
    .digest("hex");
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value).sort((left, right) =>
    left[0].localeCompare(right[0], "en")
  );
  return `{${entries
    .map(([key, itemValue]) => `${JSON.stringify(key)}:${stableStringify(itemValue)}`)
    .join(",")}}`;
}

export function resolveRepoPath(relOrAbsPath) {
  if (path.isAbsolute(relOrAbsPath)) {
    return relOrAbsPath;
  }
  return path.resolve(REPO_ROOT, relOrAbsPath);
}

export function pathExists(relOrAbsPath) {
  return fs.existsSync(resolveRepoPath(relOrAbsPath));
}

export function readJsonFile(relOrAbsPath) {
  const absolutePath = resolveRepoPath(relOrAbsPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

export function writeJsonFile(relOrAbsPath, payload) {
  const absolutePath = resolveRepoPath(relOrAbsPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function getGitHeadShortSha() {
  const out = runGit(["rev-parse", "--short", "HEAD"], { allowFailure: true }).trim();
  return out.length > 0 ? out : null;
}

export function runCommand(commandWithArgs, { label = "" } = {}) {
  const command = commandWithArgs[0];
  const args = commandWithArgs.slice(1);
  const commandLabel = label || commandWithArgs.join(" ");
  const run = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (run.error) {
    throw new Error(`${commandLabel} failed: ${String(run.error.message ?? run.error)}`);
  }
  if (run.status !== 0) {
    throw new Error(`${commandLabel} failed with exit code ${String(run.status)}`);
  }
}

export function ensureKnownFlags(rawArgs, knownFlags) {
  const unknown = (rawArgs ?? []).filter((arg) => !knownFlags.has(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
  }
}

export function repoRelativeDisplay(relOrAbsPath) {
  return toRepoRelativePath(relOrAbsPath);
}
