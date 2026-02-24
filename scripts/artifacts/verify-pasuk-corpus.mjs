#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { PASUK_CORPUS_CANONICAL_ARGS, REPAIR_COMMAND_HINT } from "./config.mjs";
import { ensureKnownFlags, resolveRepoPath, sha256Text, stableStringify } from "./lib.mjs";

const PASUK_ROOT = "outputs/pasuk-trace-corpus/latest";
const DOT_SCHEMA = 2;
const REPORT_SCHEMA = 2;

function parseDotProvenance(dotText) {
  const out = {};
  const lines = String(dotText ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  for (const line of lines) {
    const match = line.match(/^\/\/\s*([a-z0-9_]+)\s*:\s*(.+)\s*$/u);
    if (!match) {
      continue;
    }
    const key = match[1];
    const rawValue = match[2].trim();
    if (key === "dot_schema") {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isFinite(parsed)) {
        out.dot_schema = parsed;
      }
      continue;
    }
    out[key] = rawValue;
  }
  return out;
}

function parseReportProvenance(reportText) {
  const out = {};
  const lines = String(reportText ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  for (const line of lines) {
    const match = line.match(/^#\s*([a-z0-9_]+)\s*:\s*(.+)\s*$/u);
    if (!match) {
      continue;
    }
    const key = match[1];
    const rawValue = match[2].trim();
    if (key === "report_schema") {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isFinite(parsed)) {
        out.report_schema = parsed;
      }
      continue;
    }
    out[key] = rawValue;
  }
  return out;
}

function canonicalGraphOptions() {
  return {
    theme: "light",
    mode: "full",
    boundary: "cluster",
    prune: "orphans",
    pruneKeepKinds: "",
    pruneKeepIds: "",
    layout: "boot",
    prettyIds: true,
    legend: true,
    wordsMode: "cluster"
  };
}

async function verifyRow(args) {
  const { outDir, row, expectedGraphOptsSha } = args;
  const failures = [];
  const baseLabel = row.ref_key ?? "(unknown-ref)";

  const traceRel = row?.output?.trace_json;
  const reportRel = row?.output?.trace_report;
  const dotRel = row?.output?.graph_dot;

  if (typeof traceRel !== "string" || traceRel.length === 0) {
    failures.push(`${baseLabel}: index row missing output.trace_json`);
    return failures;
  }
  if (typeof reportRel !== "string" || reportRel.length === 0) {
    failures.push(`${baseLabel}: index row missing output.trace_report`);
    return failures;
  }

  const tracePath = path.resolve(outDir, traceRel);
  const reportPath = path.resolve(outDir, reportRel);
  const dotPath =
    typeof dotRel === "string" && dotRel.length > 0 ? path.resolve(outDir, dotRel) : null;

  let traceText;
  let reportText;
  let dotText = null;
  try {
    traceText = await fs.readFile(tracePath, "utf8");
  } catch (error) {
    failures.push(`${baseLabel}: missing trace.json (${String(error?.message ?? error)})`);
    return failures;
  }
  try {
    reportText = await fs.readFile(reportPath, "utf8");
  } catch (error) {
    failures.push(`${baseLabel}: missing trace.txt (${String(error?.message ?? error)})`);
    return failures;
  }
  if (dotPath) {
    try {
      dotText = await fs.readFile(dotPath, "utf8");
    } catch (error) {
      failures.push(`${baseLabel}: missing graph.dot (${String(error?.message ?? error)})`);
      return failures;
    }
  }

  const traceSha = sha256Text(traceText);
  if (row?.sha256?.trace_json && row.sha256.trace_json !== traceSha) {
    failures.push(
      `${baseLabel}: index sha256.trace_json mismatch (expected ${row.sha256.trace_json}, got ${traceSha})`
    );
  }

  const reportProv = parseReportProvenance(reportText);
  if (reportProv.trace_file_sha256 !== traceSha) {
    failures.push(
      `${baseLabel}: report trace_file_sha256 mismatch (expected ${traceSha}, got ${String(reportProv.trace_file_sha256 ?? "")})`
    );
  }
  if (reportProv.report_schema !== REPORT_SCHEMA) {
    failures.push(
      `${baseLabel}: report_schema mismatch (expected ${REPORT_SCHEMA}, got ${String(reportProv.report_schema ?? "")})`
    );
  }
  if (row?.sha256?.trace_report && row.sha256.trace_report !== sha256Text(reportText)) {
    failures.push(`${baseLabel}: index sha256.trace_report mismatch`);
  }

  if (dotText !== null) {
    const dotProv = parseDotProvenance(dotText);
    if (dotProv.trace_file_sha256 !== traceSha) {
      failures.push(
        `${baseLabel}: dot trace_file_sha256 mismatch (expected ${traceSha}, got ${String(dotProv.trace_file_sha256 ?? "")})`
      );
    }
    if (dotProv.graph_opts_sha256 !== expectedGraphOptsSha) {
      failures.push(
        `${baseLabel}: dot graph_opts_sha256 mismatch (expected ${expectedGraphOptsSha}, got ${String(dotProv.graph_opts_sha256 ?? "")})`
      );
    }
    if (dotProv.dot_schema !== DOT_SCHEMA) {
      failures.push(
        `${baseLabel}: dot_schema mismatch (expected ${DOT_SCHEMA}, got ${String(dotProv.dot_schema ?? "")})`
      );
    }
    if (row?.sha256?.graph_dot && row.sha256.graph_dot !== sha256Text(dotText)) {
      failures.push(`${baseLabel}: index sha256.graph_dot mismatch`);
    }
  }

  return failures;
}

export async function verifyPasukCorpus({ verbose = false } = {}) {
  const outDir = resolveRepoPath(PASUK_ROOT);
  const indexPath = path.resolve(outDir, "refs", "index.json");
  const manifestPath = path.resolve(outDir, "manifest.json");
  const failures = [];

  let indexRows;
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    indexRows = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      failures: [
        `pasuk-corpus index missing or invalid at ${indexPath} (${String(error?.message ?? error)})`
      ],
      rowsChecked: 0
    };
  }

  if (!Array.isArray(indexRows)) {
    return {
      ok: false,
      failures: [`pasuk-corpus index must be an array at ${indexPath}`],
      rowsChecked: 0
    };
  }

  try {
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    if (!manifest || typeof manifest !== "object") {
      failures.push(`pasuk-corpus manifest must be object at ${manifestPath}`);
    }
  } catch (error) {
    failures.push(
      `pasuk-corpus manifest missing or invalid at ${manifestPath} (${String(error?.message ?? error)})`
    );
  }

  const graphOptsSha = sha256Text(stableStringify(canonicalGraphOptions()));

  for (const row of indexRows) {
    const rowFailures = await verifyRow({
      outDir,
      row,
      expectedGraphOptsSha: graphOptsSha
    });
    failures.push(...rowFailures);
  }

  if (verbose) {
    console.log(`artifacts:verify:pasuk rows=${indexRows.length}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    rowsChecked: indexRows.length,
    graphOptsSha
  };
}

async function main() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(["--verbose"]);
  ensureKnownFlags(args, knownFlags);
  const verbose = args.includes("--verbose");
  const result = await verifyPasukCorpus({ verbose });

  if (!result.ok) {
    console.error("artifacts:verify:pasuk failed");
    const limit = 40;
    for (const failure of result.failures.slice(0, limit)) {
      console.error(`- ${failure}`);
    }
    if (result.failures.length > limit) {
      console.error(`- ... ${result.failures.length - limit} additional failure(s)`);
    }
    console.error(
      `- canonical_pasuk_args_sha256=${sha256Text(PASUK_CORPUS_CANONICAL_ARGS.join("\n"))}`
    );
    console.error(`Fix: ${REPAIR_COMMAND_HINT}`);
    process.exit(1);
  }

  console.log(
    `artifacts:verify:pasuk ok rows=${result.rowsChecked} graph_opts_sha256=${result.graphOptsSha}`
  );
}

main().catch((error) => {
  console.error(`artifacts:verify:pasuk error: ${String(error?.message ?? error)}`);
  process.exit(2);
});
