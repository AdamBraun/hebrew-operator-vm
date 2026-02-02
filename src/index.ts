import { createInitialState, serializeState } from "./state/state";
import { runProgram, runProgramWithTrace } from "./vm/vm";

function printUsage(): void {
  console.log("Usage:");
  console.log("  node dist/index.js run \"<hebrew>\" [--json]");
  console.log("  node dist/index.js trace \"<hebrew>\"");
  console.log("  node dist/index.js \"<hebrew>\"");
}

function printSummary(stateJson: ReturnType<typeof serializeState>): void {
  console.log(`F: ${stateJson.vm.F}`);
  console.log(`R: ${stateJson.vm.R}`);
  console.log(`tau: ${stateJson.vm.tau}`);
  console.log("H:");
  console.log(JSON.stringify(stateJson.vm.H, null, 2));
}

function runCommand(program: string, json: boolean): void {
  const state = runProgram(program, createInitialState());
  const stateJson = serializeState(state);
  if (json) {
    console.log(JSON.stringify(stateJson, null, 2));
  } else {
    printSummary(stateJson);
  }
}

function runTrace(program: string): void {
  const { state, trace } = runProgramWithTrace(program, createInitialState());
  for (const entry of trace) {
    console.log(`${entry.token} | tau=${entry.tau} F=${entry.F} R=${entry.R} H=${entry.eventCount}`);
  }
  const stateJson = serializeState(state);
  printSummary(stateJson);
}

const args: string[] = process.argv.slice(2);

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

const command = args[0];

if (command === "run") {
  const program = args.slice(1).filter((arg) => arg !== "--json").join(" ");
  const json = args.includes("--json");
  if (!program) {
    printUsage();
    process.exit(1);
  }
  runCommand(program, json);
} else if (command === "trace") {
  const program = args.slice(1).join(" ");
  if (!program) {
    printUsage();
    process.exit(1);
  }
  runTrace(program);
} else {
  const program = args.join(" ");
  runCommand(program, false);
}
