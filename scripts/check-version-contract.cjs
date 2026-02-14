#!/usr/bin/env node
const childProcess = require("node:child_process");
const path = require("node:path");
const util = require("node:util");
const {
  VERSION_SOURCE_PATH,
  parseVersionContractSource,
  readVersionContractFromFileSync
} = require("./lib/version-contract.cjs");

const DEFAULT_MODE = "warn";
const DEFAULT_BASE_SHA = String(
  process.env.VERSION_CONTRACT_BASE_SHA ?? process.env.GUARDRAILS_BASE_SHA ?? ""
).trim();
const DEFAULT_HEAD_SHA = String(
  process.env.VERSION_CONTRACT_HEAD_SHA ??
    process.env.GUARDRAILS_HEAD_SHA ??
    process.env.GITHUB_SHA ??
    ""
).trim();
const execFileAsync = util.promisify(childProcess.execFile);

const RULES = [
  {
    key: "semantics_version",
    triggerPattern: /^registry\/token-semantics\.json$/u,
    triggerLabel: "registry/token-semantics.json"
  },
  {
    key: "semantics_version",
    triggerPattern: /^registry\/teamim\.classification\.json$/u,
    triggerLabel: "registry/teamim.classification.json"
  },
  {
    key: "render_version",
    triggerPattern: /^render\//u,
    triggerLabel: "render/"
  },
  {
    key: "trace_version",
    triggerPattern: /^spec\/70-TRACE-FORMAT\.schema\.json$/u,
    triggerLabel: "spec/70-TRACE-FORMAT.schema.json"
  }
];

function toPortablePath(value) {
  return String(value).split(path.sep).join("/");
}

function normalizeSha(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (/^0+$/u.test(trimmed)) {
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
    maxBuffer: 1024 * 1024 * 8
  });
  return result.stdout;
}

async function tryTouchedFromDiff(args) {
  try {
    return parseNullDelimitedPaths(await runGit(args));
  } catch {
    return null;
  }
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
    baseSha: DEFAULT_BASE_SHA,
    headSha: DEFAULT_HEAD_SHA,
    versionFilePath: VERSION_SOURCE_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log(
        "  node scripts/check-version-contract.cjs [--mode=warn|fail] [--base-sha=sha] [--head-sha=sha] [--version-file=path]"
      );
      process.exit(0);
    }

    const modeOpt = readOptionValue(argv, index, "--mode");
    if (modeOpt) {
      opts.mode = modeOpt.value;
      index = modeOpt.nextIndex;
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

    const versionFileOpt = readOptionValue(argv, index, "--version-file");
    if (versionFileOpt) {
      opts.versionFilePath = path.resolve(versionFileOpt.value);
      index = versionFileOpt.nextIndex;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (opts.mode !== "warn" && opts.mode !== "fail") {
    throw new Error(`Invalid --mode '${opts.mode}' (expected warn|fail)`);
  }

  return opts;
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

  return { files: touched, source };
}

function parseSemver(value) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) {
    throw new Error(`Invalid SemVer value '${value}'`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = a[index] - b[index];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

async function readVersionContractAtRef(ref, versionFilePath) {
  const versionFileRel = toPortablePath(path.relative(process.cwd(), versionFilePath));
  if (!versionFileRel || versionFileRel.startsWith("..")) {
    throw new Error(`Version file must be inside repo: ${versionFilePath}`);
  }
  const source = await runGit(["show", `${ref}:${versionFileRel}`]);
  return parseVersionContractSource(source);
}

function ruleTriggered(rule, touchedFiles) {
  for (const filePath of touchedFiles) {
    if (rule.triggerPattern.test(filePath)) {
      return true;
    }
  }
  return false;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const touched = await collectTouchedFiles(opts);
  const currentContract = readVersionContractFromFileSync(opts.versionFilePath);

  const baseRef = normalizeSha(opts.baseSha) || "HEAD";
  let baseContract = currentContract;
  try {
    baseContract = await readVersionContractAtRef(baseRef, opts.versionFilePath);
  } catch {
    if (normalizeSha(opts.baseSha)) {
      throw new Error(`Unable to read ${toPortablePath(opts.versionFilePath)} at ${baseRef}`);
    }
  }

  const checks = [];
  let blocking = 0;

  for (const rule of RULES) {
    if (!ruleTriggered(rule, touched.files)) {
      continue;
    }
    const current = currentContract[rule.key];
    const base = baseContract[rule.key];
    const bumped = compareSemver(current, base) > 0;
    checks.push({
      key: rule.key,
      trigger: rule.triggerLabel,
      base,
      current,
      bumped
    });
    if (!bumped) {
      blocking += 1;
      console.warn(
        `[version-contract:fail] ${rule.key} must bump when ${rule.triggerLabel} changes (base=${base} current=${current})`
      );
    } else {
      console.log(
        `[version-contract:ok] ${rule.key} bumped (${base} -> ${current}) for ${rule.triggerLabel}`
      );
    }
  }

  console.log(
    `version-contract: mode=${opts.mode} touched=${touched.files.size} checks=${checks.length} blocking=${blocking} source=${touched.source}`
  );

  if (opts.mode === "fail" && blocking > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(`[version-contract:error] ${err?.message ?? String(err)}`);
  process.exit(1);
});
