#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_MODE = "warn";
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), "reports", "ci_guardrails_baseline.md");
const DEFAULT_ALLOWLIST_PATH = path.resolve(process.cwd(), "config", "guardrails-allowlist.json");

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
    allowlistPath: DEFAULT_ALLOWLIST_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log(
        "  node scripts/ci-guardrails.cjs [--mode=warn|fail] [--report=path] [--allowlist=path]"
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

    throw new Error(`Unknown option: ${arg}`);
  }

  if (opts.mode !== "warn" && opts.mode !== "fail") {
    throw new Error(`Invalid --mode '${opts.mode}' (expected warn|fail)`);
  }

  return opts;
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

function evaluateMetric(value, threshold, allowlist, filePath) {
  if (value <= threshold) {
    return "pass";
  }
  return allowlist.has(filePath) ? "legacy_allowlisted" : "new_violation";
}

function renderReport({ opts, rows, counts }) {
  const lines = [
    "# CI Guardrails Baseline Report",
    "",
    `- mode: ${opts.mode}`,
    `- generated_at_utc: ${new Date().toISOString()}`,
    `- thresholds.max_bytes: ${THRESHOLDS.max_bytes}`,
    `- thresholds.max_complexity_score: ${THRESHOLDS.max_complexity_score}`,
    `- files_scanned: ${rows.length}`,
    `- legacy_allowlisted_violations: ${counts.legacy}`,
    `- new_violations: ${counts.new}`,
    "",
    "## File Metrics",
    "",
    "| file | bytes | complexity_score | bytes_status | complexity_status |",
    "|---|---:|---:|---|---|"
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.file} | ${row.bytes} | ${row.complexity_score} | ${row.bytes_status} | ${row.complexity_status} |`
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

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    const complexityScore = computeComplexityScore(content);
    const relativePath = workspaceRelativePath(filePath);

    const bytesStatus = evaluateMetric(
      bytes,
      THRESHOLDS.max_bytes,
      allowlist.max_bytes,
      relativePath
    );
    const complexityStatus = evaluateMetric(
      complexityScore,
      THRESHOLDS.max_complexity_score,
      allowlist.max_complexity_score,
      relativePath
    );

    if (bytesStatus === "new_violation" || complexityStatus === "new_violation") {
      newViolations += 1;
      console.warn(
        `[guardrails:new] ${relativePath} bytes=${bytes} complexity=${complexityScore} (bytes:${bytesStatus}, complexity:${complexityStatus})`
      );
    } else if (
      bytesStatus === "legacy_allowlisted" ||
      complexityStatus === "legacy_allowlisted"
    ) {
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
      complexity_status: complexityStatus
    });
  }

  rows.sort((left, right) => right.bytes - left.bytes || right.complexity_score - left.complexity_score);
  const report = renderReport({
    opts,
    rows,
    counts: {
      legacy: legacyViolations,
      new: newViolations
    }
  });

  await fs.mkdir(path.dirname(opts.reportPath), { recursive: true });
  await fs.writeFile(opts.reportPath, report, "utf8");

  const reportRel = workspaceRelativePath(opts.reportPath);
  console.log(
    `guardrails: mode=${opts.mode} files=${rows.length} legacy=${legacyViolations} new=${newViolations} report=${reportRel}`
  );

  if (opts.mode === "fail" && newViolations > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(`[guardrails:error] ${err?.message ?? String(err)}`);
  process.exit(1);
});
