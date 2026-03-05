#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { ensureKnownFlags } from "../artifacts/lib.mjs";

const CWD = process.cwd();
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;
const LFS_POINTER_MAX_BYTES = 1024;
const LFS_POINTER_HEADER = "version https://git-lfs.github.com/spec/v1\n";

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

function uniqueSorted(values) {
  return [...new Set(values.map((entry) => String(entry).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

function parseNewlineOutput(value) {
  return uniqueSorted(String(value ?? "").split(/\r?\n/u));
}

function parseModeAndBlob(treeLine) {
  const trimmed = treeLine.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const tabIndex = trimmed.indexOf("\t");
  const meta = tabIndex >= 0 ? trimmed.slice(0, tabIndex) : trimmed;
  const parts = meta.split(/\s+/u);
  if (parts.length < 3) {
    return null;
  }
  const mode = parts[0] ?? "";
  const objectType = parts[1] ?? "";
  const blobOid = parts[2] ?? "";
  return { mode, objectType, blobOid };
}

function isLfsPointerText(content) {
  if (!content.startsWith(LFS_POINTER_HEADER)) {
    return false;
  }
  const lines = content.split("\n");
  const oidLine = lines.find((line) => line.startsWith("oid sha256:"));
  const sizeLine = lines.find((line) => line.startsWith("size "));
  if (!oidLine || !sizeLine) {
    return false;
  }
  return /^oid sha256:[a-f0-9]{64}$/u.test(oidLine) && /^size [0-9]+$/u.test(sizeLine);
}

function isPathLfsTracked(filePath) {
  const out = runGit(["check-attr", "filter", "--", filePath], { allowFailure: true }).trim();
  return out.endsWith(": filter: lfs");
}

function listStagedOutputFiles() {
  return parseNewlineOutput(
    runGit(["diff", "--cached", "--name-only", "--diff-filter=ACM", "--", "outputs"])
  );
}

function resolvePushRange() {
  const upstreamRef = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
    allowFailure: true
  }).trim();
  if (upstreamRef.length > 0) {
    return `${upstreamRef}...HEAD`;
  }
  const fallbackExists = runGit(["rev-parse", "--verify", "HEAD~1"], { allowFailure: true }).trim();
  return fallbackExists.length > 0 ? "HEAD~1..HEAD" : "HEAD";
}

function listPushCommits(rangeExpr) {
  if (rangeExpr === "HEAD") {
    return ["HEAD"];
  }
  return parseNewlineOutput(runGit(["rev-list", "--reverse", rangeExpr]));
}

function listChangedOutputsInCommit(commitOid) {
  return parseNewlineOutput(
    runGit([
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "--diff-filter=ACM",
      commitOid,
      "--",
      "outputs"
    ])
  );
}

function validateBlobObject(args) {
  const { mode, blobOid, label, filePath } = args;
  if (mode === "120000") {
    return [];
  }

  const type = runGit(["cat-file", "-t", blobOid], { allowFailure: true }).trim();
  if (type !== "blob") {
    return [
      {
        type: "blob-type",
        filePath,
        detail: `${label} expected blob object, got ${type || "unknown"}`
      }
    ];
  }

  const violations = [];
  if (!isPathLfsTracked(filePath)) {
    violations.push({
      type: "attr",
      filePath,
      detail: `${filePath} is not matched by an LFS filter rule`
    });
  }

  const rawSize = runGit(["cat-file", "-s", blobOid], { allowFailure: true }).trim();
  const sizeBytes = Number(rawSize);
  if (!Number.isFinite(sizeBytes)) {
    violations.push({
      type: "size",
      filePath,
      detail: `${label} has non-numeric blob size '${rawSize}'`
    });
    return violations;
  }

  if (sizeBytes > LFS_POINTER_MAX_BYTES) {
    violations.push({
      type: "pointer",
      filePath,
      detail: `${label} stores a non-pointer blob (${String(sizeBytes)} bytes)`
    });
    return violations;
  }

  const content = runGit(["cat-file", "-p", blobOid], { allowFailure: true });
  if (!isLfsPointerText(content)) {
    violations.push({
      type: "pointer",
      filePath,
      detail: `${label} does not contain a valid Git LFS pointer`
    });
  }

  return violations;
}

function validateBlobAtRef(refExpr, filePath) {
  const treeLine = runGit(["ls-tree", refExpr, "--", filePath], { allowFailure: true }).trim();
  const parsed = parseModeAndBlob(treeLine);
  if (!parsed) {
    return [];
  }
  return validateBlobObject({
    mode: parsed.mode,
    blobOid: parsed.blobOid,
    label: `${refExpr}:${filePath}`,
    filePath
  });
}

function validateStagedBlob(filePath) {
  const raw = runGit(["ls-files", "-s", "--", filePath], { allowFailure: true })
    .trim()
    .split(/\r?\n/u)
    .find((line) => line.trim().length > 0);
  if (!raw) {
    return [];
  }
  const match = raw.match(/^([0-9]{6})\s+([a-f0-9]{40,64})\s+[0-9]+\t/u);
  if (!match) {
    return [
      {
        type: "index",
        filePath,
        detail: `unable to parse staged index entry for ${filePath}`
      }
    ];
  }
  const mode = match[1] ?? "";
  const blobOid = match[2] ?? "";
  return validateBlobObject({
    mode,
    blobOid,
    label: `INDEX:${filePath}`,
    filePath
  });
}

function printViolations(violations) {
  console.error("src-artifacts:verify:lfs-outputs failed");
  console.error("Non-LFS output artifacts detected:");
  for (const violation of violations) {
    console.error(`- [${violation.type}] ${violation.detail}`);
  }
  console.error(
    'Fix: ensure outputs are LFS-tracked, then re-add or migrate history (e.g. `git lfs migrate import --include="outputs/**"`).'
  );
}

function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--staged", "--push-range", "--verbose"]);
  ensureKnownFlags(args, knownFlags);

  const stagedMode = args.includes("--staged");
  const pushRangeMode = args.includes("--push-range");
  const verbose = args.includes("--verbose");
  if ((stagedMode && pushRangeMode) || (!stagedMode && !pushRangeMode)) {
    throw new Error("Pass exactly one mode: --staged or --push-range");
  }

  const violations = [];
  if (stagedMode) {
    const stagedFiles = listStagedOutputFiles();
    if (verbose) {
      console.log(`src-artifacts:verify:lfs-outputs staged_files=${stagedFiles.length}`);
    }
    for (const filePath of stagedFiles) {
      violations.push(...validateStagedBlob(filePath));
    }
  } else {
    const rangeExpr = resolvePushRange();
    const commits = listPushCommits(rangeExpr);
    if (verbose) {
      console.log(`src-artifacts:verify:lfs-outputs push_range=${rangeExpr}`);
      console.log(`src-artifacts:verify:lfs-outputs commits=${commits.length}`);
    }
    for (const commitOid of commits) {
      const changedOutputFiles = listChangedOutputsInCommit(commitOid);
      for (const filePath of changedOutputFiles) {
        violations.push(...validateBlobAtRef(commitOid, filePath));
      }
    }
  }

  if (violations.length > 0) {
    printViolations(violations);
    process.exit(1);
  }

  console.log("src-artifacts:verify:lfs-outputs ok");
}

try {
  main();
} catch (error) {
  console.error(`src-artifacts:verify:lfs-outputs error: ${String(error?.message ?? error)}`);
  process.exit(2);
}
