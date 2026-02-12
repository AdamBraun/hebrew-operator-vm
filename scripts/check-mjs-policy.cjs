#!/usr/bin/env node
const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const util = require("node:util");

const DEFAULT_MODE = "warn";
const DEFAULT_ALLOWLIST_PATH = path.resolve(process.cwd(), "config", "mjs-policy-allowlist.json");
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), "reports", "mjs_policy_violations.md");
const DEFAULT_BASE_SHA = String(process.env.GUARDRAILS_BASE_SHA ?? "").trim();
const DEFAULT_HEAD_SHA = String(process.env.GUARDRAILS_HEAD_SHA ?? process.env.GITHUB_SHA ?? "").trim();
const IGNORED_DIRS = new Set([".git", "node_modules", "dist"]);
const execFileAsync = util.promisify(childProcess.execFile);

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
    allowlistPath: DEFAULT_ALLOWLIST_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    baseSha: DEFAULT_BASE_SHA,
    headSha: DEFAULT_HEAD_SHA
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log(
        "  node scripts/check-mjs-policy.cjs [--mode=warn|fail] [--allowlist=path] [--report=path] [--base-sha=sha] [--head-sha=sha]"
      );
      process.exit(0);
    }

    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.mode = modeOpt.value;
      index = modeOpt.nextIndex;
      continue;
    }

    const allowlistOpt = readOptionValue(argv, index, "--allowlist");
    if (allowlistOpt) {
      opts.allowlistPath = path.resolve(allowlistOpt.value);
      index = allowlistOpt.nextIndex;
      continue;
    }

    const reportOpt = readOptionValue(argv, index, "--report");
    if (reportOpt) {
      opts.reportPath = path.resolve(reportOpt.value);
      index = reportOpt.nextIndex;
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

async function walkMjsFiles(dirPath) {
  const out = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      out.push(...(await walkMjsFiles(full)));
      continue;
    }
    if (entry.isFile() && path.extname(entry.name) === ".mjs") {
      out.push(full);
    }
  }
  return out;
}

async function loadAllowlist(allowlistPath) {
  try {
    const raw = await fs.readFile(allowlistPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      legacyBusinessLogic: new Set((parsed?.legacy_business_logic ?? []).map((item) => String(item))),
      wrapperAllowlist: new Set((parsed?.wrapper_allowlist ?? []).map((item) => String(item)))
    };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return {
        legacyBusinessLogic: new Set(),
        wrapperAllowlist: new Set()
      };
    }
    throw err;
  }
}

function stripComments(line) {
  if (!line) {
    return "";
  }
  const trimmed = line.trim();
  if (trimmed.startsWith("//")) {
    return "";
  }
  return trimmed;
}

function isLikelyWrapper(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line, index) => (index === 0 ? line.replace(/^#!.*/, "").trim() : line))
    .map(stripComments)
    .filter(Boolean);

  if (lines.length === 0) {
    return true;
  }
  if (lines.length > 45) {
    return false;
  }

  const body = lines.join("\n");
  const hasModuleBoundary = /\bimport\b|\brequire\s*\(/.test(body);
  if (!hasModuleBoundary) {
    return false;
  }

  const hasHeavyControlFlow = /\bfor\b|\bwhile\b|\bswitch\b|\btry\b|\bcatch\b/.test(body);
  if (hasHeavyControlFlow) {
    return false;
  }

  const hasFunctionOrClass = /\bfunction\b|\bclass\b|=>/.test(body);
  if (hasFunctionOrClass) {
    return false;
  }

  const variableCount = (body.match(/\b(const|let|var)\b/g) ?? []).length;
  if (variableCount > 6) {
    return false;
  }

  return true;
}

function renderReport({ opts, rows, counts, touched }) {
  const lines = [
    "# MJS Policy Violations",
    "",
    `- mode: ${opts.mode}`,
    `- generated_at_utc: ${new Date().toISOString()}`,
    `- touched_source: ${touched.source}`,
    `- touched_files: ${touched.count}`,
    `- files_scanned: ${rows.length}`,
    `- wrappers_detected: ${counts.wrappers}`,
    `- legacy_business_logic: ${counts.legacy}`,
    `- touched_legacy_business_logic: ${counts.touchedLegacy}`,
    `- new_business_logic: ${counts.new}`,
    `- blocking_violations: ${counts.blocking}`,
    "",
    "## Classification",
    "",
    "| file | touched | classification |",
    "|---|---|---|"
  ];

  for (const row of rows) {
    lines.push(`| ${row.file} | ${row.touched ? "yes" : "no"} | ${row.classification} |`);
  }

  return lines.join("\n") + "\n";
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const allowlist = await loadAllowlist(opts.allowlistPath);
  const files = await walkMjsFiles(process.cwd());
  files.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

  const rows = [];
  let wrappers = 0;
  let legacy = 0;
  let touchedLegacy = 0;
  let newlyIntroduced = 0;
  let blockingViolations = 0;
  const touched = await collectTouchedFiles(opts);

  for (const filePath of files) {
    const relativePath = workspaceRelativePath(filePath);
    const content = await fs.readFile(filePath, "utf8");
    const isTouched = touched.files.has(relativePath);

    let classification = "";
    if (allowlist.wrapperAllowlist.has(relativePath)) {
      classification = "wrapper_allowlisted";
      wrappers += 1;
    } else if (allowlist.legacyBusinessLogic.has(relativePath)) {
      if (isTouched) {
        classification = "touched_legacy_business_logic";
        touchedLegacy += 1;
        blockingViolations += 1;
        console.warn(`[mjs-policy:touched-legacy] ${relativePath}`);
      } else {
        classification = "legacy_business_logic";
        legacy += 1;
        console.warn(`[mjs-policy:legacy] ${relativePath}`);
      }
    } else if (isLikelyWrapper(content)) {
      classification = "wrapper_detected";
      wrappers += 1;
    } else {
      classification = "new_business_logic";
      newlyIntroduced += 1;
      blockingViolations += 1;
      console.warn(`[mjs-policy:new] ${relativePath}`);
    }

    rows.push({
      file: relativePath,
      classification,
      touched: isTouched
    });
  }

  const report = renderReport({
    opts,
    rows,
    counts: {
      wrappers,
      legacy,
      touchedLegacy,
      new: newlyIntroduced,
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
    `mjs-policy: mode=${opts.mode} files=${rows.length} touched=${touched.files.size} wrappers=${wrappers} legacy=${legacy} touchedLegacy=${touchedLegacy} new=${newlyIntroduced} blocking=${blockingViolations} report=${reportRel}`
  );

  if (opts.mode === "fail" && blockingViolations > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(`[mjs-policy:error] ${err?.message ?? String(err)}`);
  process.exit(1);
});
