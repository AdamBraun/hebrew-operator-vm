#!/usr/bin/env node
const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const util = require("node:util");

const DEFAULT_MODE = "warn";
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), "reports", "ci_guardrails_baseline.md");
const DEFAULT_ALLOWLIST_PATH = path.resolve(process.cwd(), "config", "guardrails-allowlist.json");
const DEFAULT_BASE_SHA = String(process.env.GUARDRAILS_BASE_SHA ?? "").trim();
const DEFAULT_HEAD_SHA = String(process.env.GUARDRAILS_HEAD_SHA ?? process.env.GITHUB_SHA ?? "").trim();
const execFileAsync = util.promisify(childProcess.execFile);

const SOURCE_ROOTS = [
  path.resolve(process.cwd(), "impl", "reference", "src"),
  path.resolve(process.cwd(), "scripts")
];
const ALLOWED_EXTENSIONS = new Set([".ts", ".mjs"]);
const IGNORED_DIRS = new Set([".git", "node_modules", "dist"]);

const THRESHOLDS = {
  max_bytes: 30000,
  max_complexity_score: 220
};

function toPortablePath(value) {
  return String(value).split(path.sep).join("/");
}

function workspaceRelativePath(absPath) {
  const fullPath = path.resolve(absPath);
  const rel = path.relative(process.cwd(), fullPath);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    return toPortablePath(rel);
  }
  return toPortablePath(fullPath);
}

function readOptionValue(argv, index, optionName) {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return { value: argv[index + 1], nextIndex: index + 1 };
  }
  return null;
}

function parseArgs(argv) {
  const opts = {
    mode: DEFAULT_MODE,
    reportPath: DEFAULT_REPORT_PATH,
    allowlistPath: DEFAULT_ALLOWLIST_PATH,
    baseSha: DEFAULT_BASE_SHA,
    headSha: DEFAULT_HEAD_SHA
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log(
        "  node scripts/ci-guardrails.cjs [--mode=warn|fail] [--report=path] [--allowlist=path] [--base-sha=sha] [--head-sha=sha]"
      );
      process.exit(0);
    }

    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.mode = modeOpt.value;
      index = modeOpt.nextIndex;
      continue;
    }

    const reportOpt = readOptionValue(argv, index, "--report");
    if (reportOpt) {
      opts.reportPath = path.resolve(reportOpt.value);
      index = reportOpt.nextIndex;
      continue;
    }

    const allowlistOpt = readOptionValue(argv, index, "--allowlist");
    if (allowlistOpt) {
      opts.allowlistPath = path.resolve(allowlistOpt.value);
      index = allowlistOpt.nextIndex;
      continue;
    }

    const baseShaOpt = readOptionValue(argv, index, "--base-sha");
    if (baseShaOpt) {
      opts.baseSha = String(baseShaOpt.value ?? "").trim();
      index = baseShaOpt.nextIndex;
      continue;
    }

    const headShaOpt = readOptionValue(argv, index, "--head-sha");
    if (headShaOpt) {
      opts.headSha = String(headShaOpt.value ?? "").trim();
      index = headShaOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (opts.mode !== "warn" && opts.mode !== "fail") {
    throw new Error(`Invalid --mode '${opts.mode}' (expected warn|fail)`);
  }

  return opts;
}

function normalizeSha(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (/^0+$/.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function parseNullDelimitedPaths(output) {
  if (!output) {
    return [];
  }
  return String(output)
    .split("\u0000")
    .filter((entry) => entry.length > 0)
    .map((entry) => toPortablePath(entry));
}

async function runGit(args) {
  const result = await execFileAsync("git", args, {
    cwd: process.cwd(),
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16
  });
  return result.stdout;
}

async function tryTouchedFromDiff(args) {
  try {
    return parseNullDelimitedPaths(await runGit(args));
  } catch (err) {
    return null;
  }
}

async function collectTouchedFiles(opts) {
  const touched = new Set();
  const baseSha = normalizeSha(opts.baseSha);
  const headSha = normalizeSha(opts.headSha) || "HEAD";
  let source = "working_tree";

  if (baseSha) {
    const rangePaths =
      (await tryTouchedFromDiff(["diff", "--name-only", "--diff-filter=ACMR", "-z", `${baseSha}...${headSha}`])) ??
      (await tryTouchedFromDiff(["diff", "--name-only", "--diff-filter=ACMR", "-z", baseSha, headSha]));
    if (rangePaths) {
      for (const filePath of rangePaths) {
        touched.add(filePath);
      }
      source = `git_diff:${baseSha}...${headSha}`;
    }
  }

  if (source === "working_tree") {
    if (String(process.env.CI ?? "").toLowerCase() === "true") {
      const ciFallbackPaths =
        (await tryTouchedFromDiff(["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD~1", "HEAD"])) ??
        [];
      for (const filePath of ciFallbackPaths) {
        touched.add(filePath);
      }
    }

    const workingTreePaths =
      (await tryTouchedFromDiff(["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD"])) ?? [];
    for (const filePath of workingTreePaths) {
      touched.add(filePath);
    }

    const stagedPaths =
      (await tryTouchedFromDiff(["diff", "--name-only", "--diff-filter=ACMR", "--cached", "-z", "HEAD"])) ??
      [];
    for (const filePath of stagedPaths) {
      touched.add(filePath);
    }
  }

  const untrackedPaths =
    (await tryTouchedFromDiff(["ls-files", "--others", "--exclude-standard", "-z"])) ?? [];
  for (const filePath of untrackedPaths) {
    touched.add(filePath);
  }

  return {
    files: touched,
    source
  };
}

async function walkFiles(dirPath) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return out;
    }
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      out.push(...(await walkFiles(full)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function countMatches(input, pattern) {
  const matches = input.match(pattern);
  return matches ? matches.length : 0;
}

function computeComplexityScore(sourceText) {
  const patterns = [
    /\bif\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /&&/g,
    /\|\|/g
  ];
  let score = 1;
  for (const pattern of patterns) {
    score += countMatches(sourceText, pattern);
  }
  return score;
}

async function loadAllowlist(allowlistPath) {
  try {
    const raw = await fs.readFile(allowlistPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      max_bytes: new Set((parsed?.max_bytes ?? []).map((entry) => String(entry))),
      max_complexity_score: new Set(
        (parsed?.max_complexity_score ?? []).map((entry) => String(entry))
      )
    };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return {
        max_bytes: new Set(),
        max_complexity_score: new Set()
      };
    }
    throw err;
  }
}

function evaluateMetric(value, threshold, allowlist, filePath, touchedFiles) {
  if (value <= threshold) {
    return "pass";
  }
  if (!allowlist.has(filePath)) {
    return "new_violation";
  }
  if (touchedFiles.has(filePath)) {
    return "touched_legacy_violation";
  }
  return "legacy_allowlisted";
}

function renderReport({ opts, rows, counts, touched }) {
  const lines = [
    "# CI Guardrails Baseline Report",
    "",
    `- mode: ${opts.mode}`,
    `- generated_at_utc: ${new Date().toISOString()}`,
    `- touched_source: ${touched.source}`,
    `- touched_files: ${touched.count}`,
    `- thresholds.max_bytes: ${THRESHOLDS.max_bytes}`,
    `- thresholds.max_complexity_score: ${THRESHOLDS.max_complexity_score}`,
    `- files_scanned: ${rows.length}`,
    `- legacy_allowlisted_violations: ${counts.legacy}`,
    `- touched_legacy_violations: ${counts.touchedLegacy}`,
    `- new_violations: ${counts.new}`,
    `- blocking_violations: ${counts.blocking}`,
    "",
    "## File Metrics",
    "",
    "| file | touched | bytes | complexity_score | bytes_status | complexity_status |",
    "|---|---|---:|---:|---|---|"
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.file} | ${row.touched ? "yes" : "no"} | ${row.bytes} | ${row.complexity_score} | ${row.bytes_status} | ${row.complexity_status} |`
    );
  }

  return lines.join("\n") + "\n";
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const allowlist = await loadAllowlist(opts.allowlistPath);

  const files = (
    await Promise.all(SOURCE_ROOTS.map((root) => walkFiles(root)))
  ).flat();
  files.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

  const rows = [];
  let newViolations = 0;
  let legacyViolations = 0;
  let touchedLegacyViolations = 0;
  let blockingViolations = 0;
  const touched = await collectTouchedFiles(opts);

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    const complexityScore = computeComplexityScore(content);
    const relativePath = workspaceRelativePath(filePath);

    const bytesStatus = evaluateMetric(
      bytes,
      THRESHOLDS.max_bytes,
      allowlist.max_bytes,
      relativePath,
      touched.files
    );
    const complexityStatus = evaluateMetric(
      complexityScore,
      THRESHOLDS.max_complexity_score,
      allowlist.max_complexity_score,
      relativePath,
      touched.files
    );

    const hasNew = bytesStatus === "new_violation" || complexityStatus === "new_violation";
    const hasTouchedLegacy =
      bytesStatus === "touched_legacy_violation" || complexityStatus === "touched_legacy_violation";
    const hasLegacy =
      bytesStatus === "legacy_allowlisted" || complexityStatus === "legacy_allowlisted";

    if (hasNew) {
      newViolations += 1;
      blockingViolations += 1;
      console.warn(
        `[guardrails:new] ${relativePath} bytes=${bytes} complexity=${complexityScore} (bytes:${bytesStatus}, complexity:${complexityStatus})`
      );
    } else if (hasTouchedLegacy) {
      touchedLegacyViolations += 1;
      blockingViolations += 1;
      console.warn(
        `[guardrails:touched-legacy] ${relativePath} bytes=${bytes} complexity=${complexityScore} (bytes:${bytesStatus}, complexity:${complexityStatus})`
      );
    } else if (hasLegacy) {
      legacyViolations += 1;
      console.warn(
        `[guardrails:legacy] ${relativePath} bytes=${bytes} complexity=${complexityScore} (bytes:${bytesStatus}, complexity:${complexityStatus})`
      );
    }

    rows.push({
      file: relativePath,
      bytes,
      complexity_score: complexityScore,
      bytes_status: bytesStatus,
      complexity_status: complexityStatus,
      touched: touched.files.has(relativePath)
    });
  }

  rows.sort((left, right) => right.bytes - left.bytes || right.complexity_score - left.complexity_score);
  const report = renderReport({
    opts,
    rows,
    counts: {
      legacy: legacyViolations,
      touchedLegacy: touchedLegacyViolations,
      new: newViolations,
      blocking: blockingViolations
    },
    touched: {
      source: touched.source,
      count: touched.files.size
    }
  });

  await fs.mkdir(path.dirname(opts.reportPath), { recursive: true });
  await fs.writeFile(opts.reportPath, report, "utf8");

  const reportRel = workspaceRelativePath(opts.reportPath);
  console.log(
    `guardrails: mode=${opts.mode} files=${rows.length} touched=${touched.files.size} legacy=${legacyViolations} touchedLegacy=${touchedLegacyViolations} new=${newViolations} blocking=${blockingViolations} report=${reportRel}`
  );

  if (opts.mode === "fail" && blockingViolations > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(`[guardrails:error] ${err?.message ?? String(err)}`);
  process.exit(1);
});
