import fs from "node:fs/promises";
import path from "node:path";

import {
  analyzeStableCursorExportDeadness,
  renderCursorExportDeadnessReport
} from "../shared/cursorExportDeadness";

export type CursorExportDeadnessOptions = {
  benchmark: string;
  input: string;
  outJson: string;
  outReport: string;
  printReport: boolean;
};

const DEFAULT_BENCHMARK = path.resolve(
  process.cwd(),
  "config",
  "cursor-consumer-benchmark.v1.json"
);
const DEFAULT_INPUT = path.resolve(process.cwd(), "data", "torah.json");
const DEFAULT_OUT_JSON = path.resolve(
  process.cwd(),
  ".tmp",
  "axis",
  "stable-cursor-export-deadness.json"
);
const DEFAULT_OUT_REPORT = path.resolve(
  process.cwd(),
  "reports",
  "stable_cursor_export_deadness_audit.md"
);

function readOptionValue(
  argv: string[],
  index: number,
  optionName: string
): { value: string; nextIndex: number } | null {
  const arg = argv[index] ?? "";
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }
  if (arg === optionName) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${optionName}`);
    }
    return { value: argv[index + 1] ?? "", nextIndex: index + 1 };
  }
  return null;
}

export function parseArgs(argv: string[]): CursorExportDeadnessOptions {
  const options: CursorExportDeadnessOptions = {
    benchmark: DEFAULT_BENCHMARK,
    input: DEFAULT_INPUT,
    outJson: DEFAULT_OUT_JSON,
    outReport: DEFAULT_OUT_REPORT,
    printReport: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const benchmarkOpt = readOptionValue(argv, index, "--benchmark");
    if (benchmarkOpt) {
      options.benchmark = path.resolve(benchmarkOpt.value);
      index = benchmarkOpt.nextIndex;
      continue;
    }

    const inputOpt = readOptionValue(argv, index, "--input");
    if (inputOpt) {
      options.input = path.resolve(inputOpt.value);
      index = inputOpt.nextIndex;
      continue;
    }

    const outJsonOpt = readOptionValue(argv, index, "--out-json");
    if (outJsonOpt) {
      options.outJson = path.resolve(outJsonOpt.value);
      index = outJsonOpt.nextIndex;
      continue;
    }

    const outReportOpt = readOptionValue(argv, index, "--out-report");
    if (outReportOpt) {
      options.outReport = path.resolve(outReportOpt.value);
      index = outReportOpt.nextIndex;
      continue;
    }

    if ((argv[index] ?? "") === "--no-print-report") {
      options.printReport = false;
      continue;
    }
  }

  return options;
}

export async function runCursorExportDeadness(
  options: CursorExportDeadnessOptions
): Promise<{ json: Record<string, unknown>; reportText: string }> {
  const summary = await analyzeStableCursorExportDeadness({
    benchmarkPath: options.benchmark,
    inputPath: options.input
  });
  const reportText = renderCursorExportDeadnessReport(summary);
  return {
    json: {
      ...summary,
      report_text: reportText
    },
    reportText
  };
}

export async function main(rawArgv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(rawArgv);
  const result = await runCursorExportDeadness(options);
  await fs.mkdir(path.dirname(options.outJson), { recursive: true });
  await fs.mkdir(path.dirname(options.outReport), { recursive: true });
  await fs.writeFile(options.outJson, JSON.stringify(result.json, null, 2), "utf8");
  await fs.writeFile(options.outReport, `${result.reportText}\n`, "utf8");
  if (options.printReport) {
    console.log(result.reportText);
  }
  console.log(
    `cursor-export-deadness: mode=isolated_stable cases=${(result.json.stable_case_count as number) ?? 0} json=${options.outJson} report=${options.outReport}`
  );
}
