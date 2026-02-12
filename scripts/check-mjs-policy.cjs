#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_MODE = "warn";
const DEFAULT_ALLOWLIST_PATH = path.resolve(process.cwd(), "config", "mjs-policy-allowlist.json");
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), "reports", "mjs_policy_violations.md");
const IGNORED_DIRS = new Set([".git", "node_modules", "dist"]);

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
    reportPath: DEFAULT_REPORT_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log(
        "  node scripts/check-mjs-policy.cjs [--mode=warn|fail] [--allowlist=path] [--report=path]"
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

    throw new Error(`Unknown option: ${arg}`);
  }

  if (opts.mode !== "warn" && opts.mode !== "fail") {
    throw new Error(`Invalid --mode '${opts.mode}' (expected warn|fail)`);
  }

  return opts;
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

function renderReport({ opts, rows, counts }) {
  const lines = [
    "# MJS Policy Violations (Warn Mode Baseline)",
    "",
    `- mode: ${opts.mode}`,
    `- generated_at_utc: ${new Date().toISOString()}`,
    `- files_scanned: ${rows.length}`,
    `- wrappers_detected: ${counts.wrappers}`,
    `- legacy_business_logic: ${counts.legacy}`,
    `- new_business_logic: ${counts.new}`,
    "",
    "## Classification",
    "",
    "| file | classification |",
    "|---|---|"
  ];

  for (const row of rows) {
    lines.push(`| ${row.file} | ${row.classification} |`);
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
  let newlyIntroduced = 0;

  for (const filePath of files) {
    const relativePath = workspaceRelativePath(filePath);
    const content = await fs.readFile(filePath, "utf8");

    let classification = "";
    if (allowlist.wrapperAllowlist.has(relativePath)) {
      classification = "wrapper_allowlisted";
      wrappers += 1;
    } else if (allowlist.legacyBusinessLogic.has(relativePath)) {
      classification = "legacy_business_logic";
      legacy += 1;
      console.warn(`[mjs-policy:legacy] ${relativePath}`);
    } else if (isLikelyWrapper(content)) {
      classification = "wrapper_detected";
      wrappers += 1;
    } else {
      classification = "new_business_logic";
      newlyIntroduced += 1;
      console.warn(`[mjs-policy:new] ${relativePath}`);
    }

    rows.push({
      file: relativePath,
      classification
    });
  }

  const report = renderReport({
    opts,
    rows,
    counts: {
      wrappers,
      legacy,
      new: newlyIntroduced
    }
  });

  await fs.mkdir(path.dirname(opts.reportPath), { recursive: true });
  await fs.writeFile(opts.reportPath, report, "utf8");

  const reportRel = workspaceRelativePath(opts.reportPath);
  console.log(
    `mjs-policy: mode=${opts.mode} files=${rows.length} wrappers=${wrappers} legacy=${legacy} new=${newlyIntroduced} report=${reportRel}`
  );

  if (opts.mode === "fail" && newlyIntroduced > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(`[mjs-policy:error] ${err?.message ?? String(err)}`);
  process.exit(1);
});
